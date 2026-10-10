import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { movies, mediaFiles } from '../db/schema';
import type { AppContext } from '../index';

const watch = new Hono<AppContext>();

// Watch progress & history are now local to the device (no accounts).
// This route only exposes public streaming URLs — no authentication.

// GET /api/watch/streaming-url/:movieId - Get streaming URL for a movie from R2
watch.get('/streaming-url/:movieId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const movieId = parseInt(c.req.param('movieId'));
  const quality = c.req.query('quality') || '1080';

  // Get movie
  const [movie] = await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!movie) {
    return c.json({ error: 'Movie not found' }, 404);
  }

  if (!movie.streamingEnabled) {
    return c.json({ error: 'Streaming not enabled for this title' }, 403);
  }

  // Get the media file for this quality from R2
  const [mediaFile] = await db
    .select()
    .from(mediaFiles)
    .where(
      and(
        eq(mediaFiles.movieId, movieId),
        eq(mediaFiles.quality, quality as any),
        eq(mediaFiles.streamingEnabled, true)
      )
    )
    .limit(1);

  if (!mediaFile || !mediaFile.objectPath) {
    return c.json({ error: 'Media file not found for requested quality' }, 404);
  }

  // Get the public URL from R2
  const streamingUrl =
    mediaFile.publicUrl ||
    (c.env.R2_PUBLIC_DOMAIN
      ? `https://${c.env.R2_PUBLIC_DOMAIN}/${mediaFile.objectPath}`
      : null);

  if (!streamingUrl) {
    return c.json({ error: 'Streaming URL not available' }, 500);
  }

  // Increment view count
  await db
    .update(movies)
    .set({ viewCount: (movie.viewCount || 0) + 1 })
    .where(eq(movies.id, movieId));

  return c.json({
    movieId,
    quality,
    streamingUrl,
    contentType: mediaFile.mimeType,
    fileSize: mediaFile.fileSize,
    duration: mediaFile.duration,
  });
});

export { watch as watchRoutes };
