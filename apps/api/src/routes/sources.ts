import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { movies, mediaFiles } from '../db/schema';
import { SourceResolver, type StreamSource } from '../lib/sources';
import { authorizeUrl, isOurHost } from '../lib/url-signer';
import type { Env } from '../index';

const sourcesRouter = new Hono<{ Bindings: Env }>();

// GET /api/sources/search — search sources by title (no DB record required)
// Registered before /:movieId so Hono's router matches it first.
sourcesRouter.get('/search', async (c) => {
  const query = c.req.query('q')?.trim();
  const year = c.req.query('year');
  const tmdbId = c.req.query('tmdbId');

  if (!query && !tmdbId) {
    return c.json(
      { error: 'Missing "q" (title) or "tmdbId" query parameter', code: 'INVALID_PARAMS' },
      400
    );
  }

  const resolver = new SourceResolver(
    c.env.TMDB_API_READ_ACCESS_TOKEN ?? '',
    c.env.R2_PUBLIC_DOMAIN
  );

  const lookup = {
    title: query ?? 'Unknown',
    year: year ? parseInt(year) : undefined,
    tmdbId: tmdbId ? parseInt(tmdbId) : undefined,
  };

  const sources = await resolver.resolveSources(lookup);

  // ── Sign our own URLs (R2 / yt-dlp service); leave third-party URLs unsigned ─
  const trustedHosts = [
    c.env.R2_PUBLIC_DOMAIN,
    c.req.header('host') ?? undefined,
    c.env.YT_DLP_SERVICE_URL ? new URL(c.env.YT_DLP_SERVICE_URL).hostname : undefined,
  ].filter(Boolean) as string[];

  const expDefault = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

  const signedSources = await Promise.all(
    sources.map(async (src) => {
      if (!isOurHost(new URL(src.url).hostname, trustedHosts)) {
        return { ...src, exp: expDefault, signed: false };
      }
      const auth = await authorizeUrl(src.url, { secret: c.env.SIGNING_SECRET, trustedHosts });
      return { ...src, url: auth.url, exp: auth.exp, signed: auth.signed };
    })
  );

  return c.json({
    sources: resolver.sortByPriority(signedSources).map((s) => {
      const src = s as typeof s & { exp: number; signed: boolean };
      return {
        ...s,
        url: src.url,
        exp: src.exp,
        signed: src.signed,
      };
    }),
    movie: {
      title: query ?? 'Unknown',
      year: year ? parseInt(year) : undefined,
    },
  });
});

// GET /api/sources/:movieId — query all streaming sources for a movie by its local DB ID
sourcesRouter.get('/:movieId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const movieId = parseInt(c.req.param('movieId'));

  // Get movie from local DB
  const [movie] = await db.select().from(movies).where(eq(movies.id, movieId)).limit(1);

  if (!movie) {
    return c.json({ error: 'Movie not found', code: 'MOVIE_NOT_FOUND' }, 404);
  }

  const resolver = new SourceResolver(
    c.env.TMDB_API_READ_ACCESS_TOKEN ?? '',
    c.env.R2_PUBLIC_DOMAIN
  );

  const lookup = {
    id: movie.id,
    title: movie.title,
    year: movie.year ?? undefined,
    tmdbId: movie.tmdbId ?? undefined,
    posterUrl: movie.posterUrl ?? undefined,
  };

  const sources = await resolver.resolveSources(lookup);

  // Attach local R2 sources for uploaded media files
  if (c.env.R2_BUCKET) {
    const localMedia = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.movieId, movieId))
      .limit(10);

    for (const mf of localMedia) {
      if (mf.objectPath && mf.streamingEnabled) {
        const url =
          mf.publicUrl ??
          (c.env.R2_PUBLIC_DOMAIN ? `https://${c.env.R2_PUBLIC_DOMAIN}/${mf.objectPath}` : null);

        if (url) {
          const isHLS = url.includes('.m3u8') || url.includes('manifest');
          sources.push({
            url,
            type: isHLS ? 'hls' : 'mp4',
            quality: mf.quality ?? 'unknown',
            label: mf.quality ? `${mf.quality}p` : 'Uploaded',
            source: 'R2',
          });
        }
      }
    }
  }

  // ── Sign our own URLs (R2 / yt-dlp service); leave third-party URLs unsigned ─
  const trustedHosts = [
    c.env.R2_PUBLIC_DOMAIN,
    c.req.header('host') ?? undefined,
    c.env.YT_DLP_SERVICE_URL ? new URL(c.env.YT_DLP_SERVICE_URL).hostname : undefined,
  ].filter(Boolean) as string[];

  const expDefault = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

  const signedSources = await Promise.all(
    sources.map(async (src) => {
      let ours = false;
      try {
        ours = isOurHost(new URL(src.url).hostname, trustedHosts);
      } catch {
        // Unparseable URL — pass through untouched
      }
      if (!ours) return { ...src, exp: expDefault, signed: false };
      const auth = await authorizeUrl(src.url, { secret: c.env.SIGNING_SECRET, trustedHosts });
      return { ...src, url: auth.url, exp: auth.exp, signed: auth.signed };
    })
  );

  return c.json({
    sources: resolver.sortByPriority(signedSources).map((s) => {
      const src = s as typeof s & { exp: number; signed: boolean };
      return {
        ...s,
        url: src.url,
        exp: src.exp,
        signed: src.signed,
      };
    }),
    movie: {
      id: movie.id,
      title: movie.title,
      posterUrl: movie.posterUrl ?? null,
    },
  });
});

export { sourcesRouter as sourceRoutes };
