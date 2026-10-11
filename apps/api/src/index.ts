import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { movieRoutes } from './routes/movies';
import { searchRoutes } from './routes/search';
import { watchRoutes } from './routes/watch';
import { genreRoutes } from './routes/genres';
import { discoveryRoutes } from './routes/discovery';
import { downloadRoutes } from './routes/download';
import { sourceRoutes } from './routes/sources';
import {
  requestIdMiddleware,
  getRecentErrors,
  buildHealthChecks,
  pushError,
  normalizeError,
  type ErrorEvent,
  type ErrorCode,
} from './lib/observability';

// Environment bindings
export interface Env {
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
  R2_BUCKET?: R2Bucket;
  R2_PUBLIC_DOMAIN?: string;
  TMDB_API_READ_ACCESS_TOKEN: string;
  /** Base URL of the yt-dlp download service (Render Docker service). */
  YT_DLP_SERVICE_URL?: string;
  /** Secret used to HMAC-sign time-limited stream/download URLs. Set via `wrangler secret put SIGNING_SECRET`. */
  SIGNING_SECRET?: string;
}

export type AppContext = { Bindings: Env };

// Create the main app
const app = new Hono<AppContext>();

// Explicit CORS allowlist — no wildcard reflection. Additional origins may be
// configured per-environment via the CORS_ORIGIN binding, but only values that
// are exact `scheme://host` strings are accepted (see isSafeOrigin()).
const BASE_ALLOWLIST: ReadonlyArray<string> = [
  'http://localhost:3000',
  'capacitor://localhost',
  'https://localhost',
  'https://veyra.pages.dev',
  'https://marvel-254.github.io',
];

const MAX_CORS_ORIGIN_LEN = 128;

function isSafeOrigin(origin: string): boolean {
  if (origin.length === 0 || origin.length > MAX_CORS_ORIGIN_LEN) return false;
  // Standard safe origin: scheme + bare host with optional port.
  // Workers-dev suffix: any subdomain of workers.dev (Cloudflare Worker URL).
  return (
    /^([a-z][a-z0-9+.-]*:\/\/[a-z0-9.-]+(?::\d{1,5})?|capacitor:\/\/localhost)$/i.test(origin) ||
    /^([a-z][a-z0-9+.-]*:\/\/)[a-z0-9.-]+\.workers\.dev$/i.test(origin)
  );
}

/**
 * Build the effective CORS allowlist: static base origins plus any additional
 * origins from the CORS_ORIGIN binding that pass isSafeOrigin(). Exported for
 * unit-testing; the binding can never inject a wildcard or open redirect.
 */
export function getCorsAllowlist(envOrigin?: string): ReadonlyArray<string> {
  const allowlist = new Set(BASE_ALLOWLIST);
  if (envOrigin) {
    for (const entry of envOrigin.split(',')) {
      const origin = entry.trim();
      if (!origin) continue;
      if (!isSafeOrigin(origin)) {
        console.warn(`[CORS] ignoring unsafe origin from CORS_ORIGIN binding: ${origin.slice(0, 64)}`);
        continue;
      }
      allowlist.add(origin);
    }
  }
  return [...allowlist];
}

// CORS middleware — explicit allowlist only. Rejected origins get NO
// Access-Control-Allow-Origin header (hono/cors returns null for them) and a
// console.warn; credentials are only ever sent with an allowlisted origin.
app.use('*', cors({
  origin: (origin, c) => {
    const allowlist = getCorsAllowlist(c.env?.CORS_ORIGIN);
    if (allowlist.includes(origin)) return origin;
    if (origin) console.warn(`[CORS] rejected origin: ${origin}`);
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));

// Request ID — inject x-request-id on every response
app.use(requestIdMiddleware());

// Health check
app.get('/', (c) => c.json({
  name: 'veyra-api',
  version: '0.3.0',
  status: 'ok',
  environment: c.env.ENVIRONMENT || 'development',
}));

app.get('/health', (c) => {
  const checks = buildHealthChecks({
    TMDB_API_READ_ACCESS_TOKEN: c.env.TMDB_API_READ_ACCESS_TOKEN,
    YT_DLP_SERVICE_URL: c.env.YT_DLP_SERVICE_URL,
  });
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.3.0',
    checks,
  });
});

// GET /api/health/errors — in-memory ring buffer of last 100 error events
const errorsRouter = new Hono();
errorsRouter.get('/', (c) => {
  return c.json({ errors: getRecentErrors(100), count: getRecentErrors(100).length });
});
errorsRouter.post('/', async (c) => {
  // Validate incoming beacon from clients (no PII expected)
  const body = await c.req.json<{
    type?: string;
    message?: string;
    context?: string;
    url?: string;
    ts?: number;
  }>();
  const event: ErrorEvent = {
    code: (body.type as ErrorCode) ?? 'INTERNAL_ERROR',
    error: body.message ?? 'unknown',
    requestId: c.req.header('x-request-id') ?? 'client:' + Date.now().toString(36),
    timestamp: body.ts ? new Date(body.ts).toISOString() : new Date().toISOString(),
    route: body.url,
    source: body.context,
  };
  pushError(event);
  return c.json({ ok: true });
});
app.route('/api/health/errors', errorsRouter);

// Public routes
app.route('/api/movies', movieRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/genres', genreRoutes);
app.route('/api/discovery', discoveryRoutes);
app.route('/api/watch', watchRoutes);
app.route('/api/download', downloadRoutes);
app.route('/api/sources', sourceRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  const requestId = (c.get('requestId') as string | undefined) ?? 'unknown';
  const normalised = normalizeError(err, 'INTERNAL_ERROR', requestId);
  // Log to console as structured JSON (handled inside normalizeError)
  return c.json({ error: normalised.error, code: normalised.code, requestId }, 500);
});

export default app;
