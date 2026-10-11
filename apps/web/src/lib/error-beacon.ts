/**
 * error-beacon — lightweight client-side error/stall reporter for Veyra.
 *
 * POSTs a minimal, PII-free payload to /api/health/errors.
 * Falls back to console.error when the request fails (offline, CDN error, etc.)
 * so failures are never silently swallowed.
 *
 * No external dependencies. No Sentry, no third-party SDK.
 */

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787')
    : '';

export type BeaconErrorType =
  | 'playback_error'
  | 'hls_fatal'
  | 'playback_stall'
  | 'unhandled_error'
  | 'unhandled_rejection';

export interface BeaconPayload {
  type: BeaconErrorType;
  message: string;
  context?: string;
  url: string;
  ts: number;
}

function sendBeacon(payload: BeaconPayload): void {
  const body = JSON.stringify(payload);
  if (!navigator.onLine) {
    // Queue in sessionStorage so a future online event can retry.
    try {
      const queue = JSON.parse(sessionStorage.getItem('veyra_error_queue') ?? '[]') as BeaconPayload[];
      queue.push(payload);
      sessionStorage.setItem('veyra_error_queue', JSON.stringify(queue));
    } catch {
      // sessionStorage may be unavailable in restricted contexts
    }
    console.warn('[error-beacon] offline — event queued:', body);
    return;
  }

  fetch(`${API_BASE}/api/health/errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    // keepalive lets the beacon survive page navigations / unload.
    keepalive: true,
  }).catch((err) => {
    // Never throw — this function is fire-and-forget.
    console.error('[error-beacon] failed to report event:', err);
  });
}

/**
 * Retry any events that were queued while offline.
 * Call this once when the app comes back online.
 */
export function flushErrorQueue(): void {
  if (!navigator.onLine) return;
  try {
    const raw = sessionStorage.getItem('veyra_error_queue');
    if (!raw) return;
    const queue: BeaconPayload[] = JSON.parse(raw);
    sessionStorage.removeItem('veyra_error_queue');
    for (const payload of queue) sendBeacon(payload);
  } catch {
    // If parsing fails, abandon the queue — don't loop forever.
    sessionStorage.removeItem('veyra_error_queue');
  }
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

export function beaconPlaybackError(message: string, context?: string): void {
  sendBeacon({
    type: 'playback_error',
    message,
    context,
    url: window.location.href,
    ts: Date.now(),
  });
}

export function beaconHlsFatal(message: string, context?: string): void {
  sendBeacon({
    type: 'hls_fatal',
    message,
    context,
    url: window.location.href,
    ts: Date.now(),
  });
}

export function beaconStall(durationMs: number, context?: string): void {
  sendBeacon({
    type: 'playback_stall',
    message: `stall:${durationMs}ms`,
    context,
    url: window.location.href,
    ts: Date.now(),
  });
}

export function beaconUnhandledError(
  message: string,
  context?: string,
): void {
  sendBeacon({
    type: 'unhandled_error',
    message,
    context,
    url: window.location.href,
    ts: Date.now(),
  });
}

export function beaconUnhandledRejection(
  reason: unknown,
  context?: string,
): void {
  const msg = reason instanceof Error ? reason.message : String(reason);
  sendBeacon({
    type: 'unhandled_rejection',
    message: msg,
    context,
    url: window.location.href,
    ts: Date.now(),
  });
}