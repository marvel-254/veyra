/**
 * Error Taxonomy — Veyra Observability
 * ====================================
 * These codes cover every failure mode across ingest, encoding, CDN, and
 * playback pipelines. Every error emitted from the API passes through
 * `normalizeError()` so callers always get { error, code, requestId }.
 *
 * Code               | Stage      | Trigger
 * -------------------|------------|--------------------------------------
 * INGEST_FETCH_FAILED| Ingest     | Source URL unreachable / timeout
 * ENCODE_UNAVAILABLE | Encoding   | yt-dlp / ytdlp service is down / 5xx
 * CDN_SIGNED_URL_EXPIRED| CDN   | Signed/R2 URL past expiry
 * CDN_SIGNED_URL_INVALID| CDN    | Signature mismatch or bad token
 * PLAYBACK_HLS_FATAL | Playback   | hls.js fatal error (network/media/unknown)
 * PLAYBACK_STALL     | Playback   | Playback stalled > 10 s
 * SOURCE_EMPTY       | Ingest     | All source resolvers returned nothing
 * CORS_REJECTED      | Network    | CORS preflight or header blocked
 * INTERNAL_ERROR      | Server     | Unhandled exception / uncaught path
 */

export const ErrorCodes = {
  INGEST_FETCH_FAILED: 'INGEST_FETCH_FAILED',
  ENCODE_UNAVAILABLE: 'ENCODE_UNAVAILABLE',
  CDN_SIGNED_URL_EXPIRED: 'CDN_SIGNED_URL_EXPIRED',
  CDN_SIGNED_URL_INVALID: 'CDN_SIGNED_URL_INVALID',
  PLAYBACK_HLS_FATAL: 'PLAYBACK_HLS_FATAL',
  PLAYBACK_STALL: 'PLAYBACK_STALL',
  SOURCE_EMPTY: 'SOURCE_EMPTY',
  CORS_REJECTED: 'CORS_REJECTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ErrorEvent {
  code: ErrorCode;
  error: string; // sanitised message, never raw Error.toString()
  requestId: string;
  timestamp: string;
  route?: string;
  movieId?: number;
  source?: string;
  latencyMs?: number;
  // No PII fields allowed here (no userId, IP, tokens, etc.)
}

// ── Ring buffer ─────────────────────────────────────────────────────────────

const RING_CAPACITY = 100;
const _eventLog: ErrorEvent[] = [];
let _writeIdx = 0;

export function pushError(event: ErrorEvent): void {
  if (_eventLog.length < RING_CAPACITY) {
    _eventLog.push(event);
  } else {
    _eventLog[_writeIdx % RING_CAPACITY] = event;
    _writeIdx++;
  }
}

export function getRecentErrors(limit = 100): ErrorEvent[] {
  if (_eventLog.length < RING_CAPACITY) {
    return [..._eventLog].slice(-limit);
  }
  const tail = _writeIdx % RING_CAPACITY;
  const slice =
    _eventLog.slice(tail).concat(_eventLog.slice(0, tail));
  return slice.slice(-Math.min(limit, RING_CAPACITY));
}

// ── Structured logger (console JSON) ────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  route?: string;
  movieId?: number;
  source?: string;
  latencyMs?: number;
  code?: ErrorCode;
  error?: string;
  requestId: string;
  timestamp: string;
  extra?: Record<string, unknown>;
}

export function structuredLog(entry: Omit<LogEntry, 'timestamp'>): void {
  const full: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  if (full.level === 'error') {
    console.error(JSON.stringify(full));
  } else if (full.level === 'warn') {
    console.warn(JSON.stringify(full));
  } else if (full.level === 'info') {
    console.info(JSON.stringify(full));
  } else {
    console.debug(JSON.stringify(full));
  }
}

// ── Error normalisation ──────────────────────────────────────────────────────

export interface NormalisedError {
  error: string;     // safe for API response: no stack, no internal paths
  code: ErrorCode;
  requestId: string;
}

/**
 * Map an unknown caught value to a NormalisedError with the given code.
 * Strips stack traces and internal paths — only human-readable messages.
 */
export function normalizeError(
  err: unknown,
  code: ErrorCode,
  requestId: string,
): NormalisedError {
  let message = String(err ?? 'Unknown error');

  // Remove file paths, stack frames, and internal module names from message
  message = message
    .replace(/at [^\n]+/g, '')
    .replace(/https?:\/\/[^\s]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Guard against overly long messages from third-party libs
  if (message.length > 300) message = message.slice(0, 300) + '…';

  // Emit to structured log
  structuredLog({ level: 'error', code, error: message, requestId });

  return { error: message, code, requestId };
}

// ── Request ID middleware ────────────────────────────────────────────────────

/**
 * Hono middleware that:
 *  1. Reads or generates a UUID v4 for x-request-id.
 *  2. Sets the header on every response.
 *  3. Stores it in c.get('requestId') for downstream use.
 */
export function requestIdMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const existing = c.req.header('x-request-id');
    const id =
      existing && isUuidV4(existing)
        ? existing
        : crypto.randomUUID();
    c.set('requestId', id);
    await next();
  };
}

function isUuidV4(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

// ── Health check helpers ──────────────────────────────────────────────────────

export interface HealthChecks {
  tmdb: boolean;
  ytdlp: boolean;
}

export function buildHealthChecks(env: { TMDB_API_READ_ACCESS_TOKEN?: string; YT_DLP_SERVICE_URL?: string }): HealthChecks {
  return {
    // Presence of the env var is sufficient — no network call needed.
    tmdb: Boolean(env.TMDB_API_READ_ACCESS_TOKEN?.trim()),
    ytdlp: Boolean(env.YT_DLP_SERVICE_URL?.trim()),
  };
}