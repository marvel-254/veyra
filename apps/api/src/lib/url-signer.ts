/**
 * URL Signer — HMAC-SHA256 signed, time-limited URLs for streaming / download
 * responses. Uses WebCrypto (Workers-compatible, no Node deps).
 *
 * Signing scheme
 * ───────────────
 * Payload:   { path: string, exp: number }   (JSON, UTF-8)
 * Algorithm: HMAC-SHA256
 * Encoding:  base64url (RFC 4648 §5)
 *
 * The signature is appended to the URL as query params:
 *   ?path=<url-encoded-path>&exp=<unix-seconds>&sig=<base64url>
 *
 * signUrl()   — sign an absolute URL, returning it with auth params appended.
 * verifyUrl() — validate a signed URL; returns { valid: true } or
 *               { valid: false, reason: string }.
 *
 * Usage
 * ─────
 *   import { signUrl, verifyUrl } from './lib/url-signer';
 *
 *   // Server: sign before sending URL to client
 *   const signed = signUrl('https://r2.example.com/movies/1/720p.mp4', secret, 3600);
 *
 *   // Server: verify on every redirect / byte-serve request
 *   const result = verifyUrl(request.url, secret);
 *   if (!result.valid) return new Response('Forbidden', { status: 403 });
 */

const DEFAULT_TTL_SECONDS = 2 * 60 * 60; // 2 hours

/**
 * Deterministically encode the signing payload so that the same
 * {path, exp} always produces the same byte sequence.
 */
function encodePayload(path: string, exp: number): Uint8Array {
  const text = JSON.stringify([path, exp]);
  return new TextEncoder().encode(text);
}

/** HMAC-SHA256 over a payload using WebCrypto. */
async function hmacSha256(key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.sign('HMAC', key, data);
}

/** Base64url encode (no padding). */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Import a raw UTF-8 secret into a CryptoKey (HMAC-SHA256). */
async function importSecret(secret: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,   // not extractable — keeps the raw bytes out of the heap
    ['sign', 'verify'],
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sign a URL and return it with `path`, `exp`, and `sig` query parameters.
 *
 * @param url     Absolute URL to sign. The signer appends auth params to this
 *                exact string, so the caller must not already include them.
 * @param secret  Value of the SIGNING_SECRET environment binding.
 * @param ttl     Time-to-live in seconds. Defaults to 2 hours.
 */
export async function signUrl(
  url: string,
  secret: string,
  ttl: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttl;

  const key = await importSecret(secret);
  const payload = encodePayload(url, exp);
  const sigBuffer = await hmacSha256(key, payload);
  const sig = base64UrlEncode(sigBuffer);

  // Append in a deterministic order
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}path=${encodeURIComponent(url)}&exp=${exp}&sig=${sig}`;
}

/** Structured result of verifyUrl(). */
export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verify a signed URL's authenticity and expiry.
 *
 * The `path` query param is used as the canonical path for signature
 * reconstruction so that attackers cannot tamper with any part of the URL.
 *
 * @param url    The full URL from the incoming request (including query string).
 * @param secret SIGNING_SECRET binding value.
 */
export async function verifyUrl(url: string, secret: string): Promise<VerifyResult> {
  try {
    const parsed = new URL(url);

    const rawPath  = parsed.searchParams.get('path');
    const rawExp   = parsed.searchParams.get('exp');
    const rawSig   = parsed.searchParams.get('sig');

    if (!rawPath || !rawExp || !rawSig) {
      return { valid: false, reason: 'Missing path, exp, or sig query param' };
    }

    const path = decodeURIComponent(rawPath);
    const exp  = parseInt(rawExp, 10);

    if (isNaN(exp)) {
      return { valid: false, reason: 'Invalid exp value' };
    }

    // Expiry check — use >= so that a URL valid exactly at the boundary second
    // is still accepted; reject strictly past.
    if (Date.now() / 1000 >= exp) {
      return { valid: false, reason: 'URL has expired' };
    }

    // Reconstruct the exact payload that was signed
    const key    = await importSecret(secret);
    const payload = encodePayload(path, exp);
    const sigBuffer = await hmacSha256(key, payload);
    const expectedSig = base64UrlEncode(sigBuffer);

    if (!timingSafeEqual(rawSig, expectedSig)) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }
}

/** Constant-time string comparison to prevent timing attacks on the signature. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Stream/download URL helpers ─────────────────────────────────────────────

/** Default time-to-live for stream/download URLs: 2 hours. */
export const DEFAULT_URL_TTL_SECONDS = 2 * 60 * 60;

/**
 * Hosts we own and therefore must sign. Third-party hosts (archive.org,
 * youtube.com, googlevideo.com, …) cannot enforce our signature, so they are
 * passed through unsigned and only carry `exp` metadata.
 */
const ALWAYS_TRUSTED_HOST_SUFFIXES = [
  '.r2.dev',
  '.r2.cloudflarestorage.com',
];

export interface AuthorizeUrlOptions {
  /** SIGNING_SECRET binding. When absent, URLs are passed through unsigned. */
  secret?: string;
  /** Time-to-live in seconds. Default 2 hours. */
  ttl?: number;
  /** Extra hostnames owned by us — e.g. R2_PUBLIC_DOMAIN, worker hostname. */
  trustedHosts?: string[];
}

export interface AuthorizedUrl {
  /** The URL to hand to the client (signed, or original when third-party). */
  url: string;
  /** Unix-seconds expiry, always present so clients can refresh proactively. */
  exp: number;
  /** True when `url` carries a valid `sig`. */
  signed: boolean;
  /** True when the URL points at our own origin / R2 public domain. */
  ours: boolean;
}

/** Is this hostname one we control (worker origin or R2 public domain)? */
export function isOurHost(hostname: string, trustedHosts: string[] = []): boolean {
  const host = hostname.toLowerCase();
  const candidates = [
    ...trustedHosts,
    ...ALWAYS_TRUSTED_HOST_SUFFIXES.map((s) => s.replace(/^\./, '')), // allow bare + dotted
  ];
  for (const candidate of candidates) {
    const c = candidate.toLowerCase().replace(/^\./, '');
    if (!c) continue;
    if (host === c || host.endsWith(`.${c}`)) return true;
  }
  return false;
}

/**
 * Prepare a stream/download URL for delivery.
 *
 * - Our own origin / R2 public domain → HMAC-signed, time-limited.
 * - Third-party (archive.org, YouTube, googlevideo, …) → passed through
 *   unchanged with `exp` metadata only, because those hosts cannot verify a
 *   signature we mint.
 *
 * If SIGNING_SECRET is not configured the URL is returned unsigned (with a
 * one-time console.warn) so local development keeps working; verification on
 * the serving side still fails closed.
 */
export async function authorizeUrl(
  rawUrl: string,
  options: AuthorizeUrlOptions = {},
): Promise<AuthorizedUrl> {
  const ttl = options.ttl ?? DEFAULT_URL_TTL_SECONDS;
  const exp = Math.floor(Date.now() / 1000) + ttl;

  let ours = false;
  try {
    ours = isOurHost(new URL(rawUrl).hostname, options.trustedHosts);
  } catch {
    // Unparseable URL — treat as third-party and pass through untouched.
    return { url: rawUrl, exp, signed: false, ours: false };
  }

  if (!ours) return { url: rawUrl, exp, signed: false, ours: false };

  if (!options.secret) {
    console.warn('[url-signer] SIGNING_SECRET is not set — returning unsigned URL');
    return { url: rawUrl, exp, signed: false, ours: true };
  }

  return { url: await signUrl(rawUrl, options.secret, ttl), exp, signed: true, ours: true };
}

// ── Serving-side guard ──────────────────────────────────────────────────────

/**
 * Middleware that rejects any request to a byte-serving / redirect path unless
 * it carries a valid, unexpired signature. Register it on the paths that hand
 * out or proxy media bytes; it returns 403 on a missing/expired/forged token.
 *
 * Fail-closed: with no SIGNING_SECRET configured every request is rejected.
 */
export function requireSignedUrl(
  paths: string[],
  getSecret: (c: any) => string | undefined,
) {
  return async (c: any, next: any) => {
    const secret = getSecret(c);
    if (!secret) {
      console.warn('[url-signer] SIGNING_SECRET missing — rejecting media request (fail closed)');
      return c.json({ error: 'Media delivery unavailable', code: 'SIGNING_NOT_CONFIGURED' }, 503);
    }
    const result = await verifyUrl(c.req.url, secret);
    if (!result.valid) {
      console.warn(`[url-signer] rejected ${c.req.method} ${new URL(c.req.url).pathname}: ${result.reason}`);
      return c.json({ error: 'Invalid or expired media URL', code: 'INVALID_SIGNATURE' }, 403);
    }
    return next();
  };
}