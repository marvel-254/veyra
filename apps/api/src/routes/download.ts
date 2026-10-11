import { Hono } from 'hono';
import { getDb } from '../lib/db';
import { movies, genres, movieGenres, mediaFiles, episodes } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import type { AppContext } from '../index';

const download = new Hono<AppContext>();

// Base URL for the yt-dlp Render service
// In production this is: https://ytdlp.veyra.dev
// For staging use the Render service URL directly
const YT_DLP_BASE =
  process.env.YT_DLP_SERVICE_URL || 'http://localhost:8000';

// ── Helpers ────────────────────────────────────────────────────────────────

const YOUTUBE_HOSTS = new Set([
  'www.youtube.com', 'youtube.com', 'youtu.be', 'www.youtu.be',
  'm.youtube.com', 'music.youtube.com',
]);

function isValidYouTubeUrl(url: string): boolean {
  try {
    const { URL } = require('url');
    const u = new URL(url);
    return YOUTUBE_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function generateTaskId(): string {
  return `veyra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── POST /api/download ──────────────────────────────────────────────────────
download.post('/', async (c) => {
  const body = await c.req.json<{
    url?: string;
    quality?: string;
    movieId?: number;
    title?: string;
  }>();

  const { url, quality = '720p', movieId, title } = body;

  if (!url) {
    return c.json({ error: 'url is required' }, 400);
  }

  if (!isValidYouTubeUrl(url)) {
    return c.json({
      error: 'Only YouTube URLs are supported for downloads.',
    }, 400);
  }

  if (!['1080p', '720p', '480p', 'best'].includes(quality)) {
    return c.json({ error: 'quality must be one of: 1080p, 720p, 480p, best' }, 400);
  }

  const taskId = generateTaskId();

  // Proxy the request to the yt-dlp Render service
  try {
    const ytRes = await fetch(`${YT_DLP_BASE}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, quality, movieId, title }),
      // 20s timeout for the proxy call (download itself is async on the service)
      signal: AbortSignal.timeout(20_000),
    });

    if (!ytRes.ok) {
      const err = await ytRes.json().catch(() => ({ error: 'yt-dlp service error' }));
      return c.json({ error: err.error || 'yt-dlp service error', taskId }, ytRes.status);
    }

    const result = await ytRes.json();
    return c.json({ taskId, status: result.status || 'queued' }, 202);
  } catch (err: any) {
    // Fallback: if the yt-dlp service is down, return a helpful error
    if (err.cause?.name === 'TimeoutError') {
      return c.json({ error: 'Download service is taking too long. Try again.' }, 504);
    }
    console.error('Download proxy error:', err);
    return c.json({
      error: 'Download service is currently unavailable. Please try again later.',
    }, 503);
  }
});

// ── GET /api/download/:taskId ────────────────────────────────────────────────
download.get('/:taskId', async (c) => {
  const { taskId } = c.req.param();

  try {
    const ytRes = await fetch(`${YT_DLP_BASE}/download/${taskId}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!ytRes.ok) {
      if (ytRes.status === 404) {
        return c.json({ error: 'Download task not found' }, 404);
      }
      return c.json({ error: 'Download service error' }, ytRes.status);
    }

    const result = await ytRes.json();
    return c.json(result);
  } catch (err: any) {
    if (err.cause?.name === 'TimeoutError') {
      return c.json({ error: 'Download service timeout. Try again.' }, 504);
    }
    console.error('Download status proxy error:', err);
    return c.json({ error: 'Download service unavailable' }, 503);
  }
});

// ── DELETE /api/download/:taskId (cancel) ────────────────────────────────────
download.delete('/:taskId', async (c) => {
  const { taskId } = c.req.param();

  try {
    const ytRes = await fetch(`${YT_DLP_BASE}/download/${taskId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10_000),
    });

    if (!ytRes.ok) {
      return c.json({ error: 'Failed to cancel download' }, ytRes.status);
    }

    const result = await ytRes.json();
    return c.json(result);
  } catch (err: any) {
    console.error('Cancel download error:', err);
    return c.json({ error: 'Download service unavailable' }, 503);
  }
});

// ── POST /api/download/qualities ─────────────────────────────────────────────
download.post('/qualities', async (c) => {
  const body = await c.req.json<{ url?: string }>();
  const { url } = body;

  if (!url) {
    return c.json({ error: 'url is required' }, 400);
  }

  if (!isValidYouTubeUrl(url)) {
    return c.json({ error: 'Invalid YouTube URL' }, 400);
  }

  try {
    const ytRes = await fetch(`${YT_DLP_BASE}/qualities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!ytRes.ok) {
      return c.json({ error: 'Could not fetch quality options' }, ytRes.status);
    }

    return c.json(await ytRes.json());
  } catch (err: any) {
    // Fallback: return standard quality options
    return c.json({
      qualities: [
        { label: '1080p', value: '1080p', sizeEstimate: '~1.2 GB' },
        { label: '720p',   value: '720p',   sizeEstimate: '~650 MB' },
        { label: '480p',   value: '480p',   sizeEstimate: '~350 MB' },
      ],
    });
  }
});

// ── GET /api/download/tasks ──────────────────────────────────────────────────
download.get('/', async (c) => {
  // For now, return an empty list (tasks are tracked client-side).
  // In production, track tasks in a KV store or Durable Object.
  return c.json({ tasks: [] });
});

export { download as downloadRoutes };
