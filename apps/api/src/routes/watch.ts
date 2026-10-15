import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { movies, mediaFiles } from '../db/schema';
import { SourceResolver, type StreamSource } from '../lib/sources';
import { authorizeUrl, isOurHost } from '../lib/url-signer';
import type { AppContext } from '../index';

const watch = new Hono<AppContext>();

// Watch progress & history are now local to the device (no accounts).
// This route only exposes public streaming URLs — no authentication.

// GET /api/watch/streaming-url/:movieId - Get best streaming URL for a movie
// Priority: external sources (HLS/MP4) > YouTube/yt-dlp > R2 bucket
watch.get('/streaming-url/:movieId', async (c) => {
  const db = getDb(c.env.DATABASE_URL);
  const movieId = parseInt(c.req.param('movieId'));
  const quality = c.req.query('quality') || '1080';
  const preferSource = c.req.query('source') as StreamSource['source'] | undefined; // optional filter

  // Get movie
  const [movie] = await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1);

  if (!movie) {
    return c.json({ error: 'Movie not found', code: 'MOVIE_NOT_FOUND' }, 404);
  }

  // Build resolver and lookup
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

  // Resolve all external sources concurrently
  const [archiveSources, tmdbSources] = await Promise.all([
    // Internet Archive
    (async () => {
      if (preferSource && preferSource !== 'Archive') return [];
      try {
        const params = new URLSearchParams({
          q: `title:${lookup.title}${lookup.year ? ` ${lookup.year}` : ''} mediatype:movies OR mediatype:video`,
          fl: 'identifier,title,mediatype,downloadURL,format',
          output: 'json',
          rows: '5',
          sort: 'downloads desc',
        });
        const url = `https://archive.org/advancedsearch.php?${params.toString()}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return [];
        const data = await res.json() as { response?: { docs?: Array<{ downloadURL?: string; title?: string }> } };
        const docs = data.response?.docs ?? [];
        return docs
          .filter((d) => d.downloadURL && (d.downloadURL.toLowerCase().includes('mp4') || d.downloadURL.includes('archive.org/download')))
          .slice(0, 1)
          .map((d): StreamSource => ({
            url: d.downloadURL!,
            type: 'mp4',
            quality: '720',
            label: '720p (Archive)',
            source: 'Archive',
            title: d.title,
          }));
      } catch { return []; }
    })(),
    // TMDB / YouTube
    lookup.tmdbId
      ? (async () => {
          if (preferSource && preferSource !== 'TMDB' && preferSource !== 'YouTube') return [];
          try {
            const res = await fetch(
              `https://api.themoviedb.org/3/movie/${lookup.tmdbId}/videos?language=en-US`,
              { headers: { Authorization: `Bearer ${c.env.TMDB_API_READ_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(8000) }
            );
            if (!res.ok) return [];
            const data = await res.json() as { results?: Array<{ key?: string; site?: string; type?: string; name?: string; official?: boolean }> };
            const videos = (data.results ?? [])
              .filter((v) => v.site === 'YouTube' && v.key)
              .sort((a, b) => {
                if ((a.type === 'Trailer') !== (b.type === 'Trailer')) return a.type === 'Trailer' ? -1 : 1;
                if ((a.official ?? false) !== (b.official ?? false)) return a.official ? -1 : 1;
                return 0;
              });
            return videos.map((v): StreamSource => ({
              url: `https://www.youtube.com/watch?v=${v.key}`,
              type: 'youtube',
              quality: 'trailer',
              label: v.name ?? v.type ?? 'YouTube Trailer',
              source: 'TMDB',
            }));
          } catch { return []; }
        })()
      : Promise.resolve([]),
  ]);

  // Collect all sources
  const allSources: StreamSource[] = [
    ...archiveSources,
    ...tmdbSources.filter((s) => s.type === 'youtube'), // only YouTube trailers
  ];

  // Append R2 bucket sources as final fallback
  if (movie.streamingEnabled && c.env.R2_BUCKET) {
    const mediaRows = await db
      .select()
      .from(mediaFiles)
      .where(and(eq(mediaFiles.movieId, movieId), eq(mediaFiles.streamingEnabled, true)))
      .limit(10);

    for (const mf of mediaRows) {
      if (mf.objectPath) {
        const r2Url = mf.publicUrl ?? (c.env.R2_PUBLIC_DOMAIN ? `https://${c.env.R2_PUBLIC_DOMAIN}/${mf.objectPath}` : null);
        if (r2Url) {
          const isHLS = r2Url.includes('.m3u8') || r2Url.includes('manifest');
          allSources.push({
            url: r2Url,
            type: isHLS ? 'hls' : 'mp4',
            quality: mf.quality ?? 'unknown',
            label: mf.quality ? `${mf.quality}p` : 'Uploaded',
            source: 'R2',
          });
        }
      }
    }
  }

  // ── Separate and sign ──────────────────────────────────────────────────────
  // Sources we control (R2) get HMAC-signed. External URLs (archive.org,
  // YouTube, free providers) are passed through with exp metadata only.
  const trustedHosts = [
    c.env.R2_PUBLIC_DOMAIN,
    c.req.header('host') ?? undefined,
  ].filter(Boolean) as string[];

  const [ours, external] = allSources.reduce<[StreamSource[], StreamSource[]]>(
    ([yes, no], src) => {
      try { isOurHost(new URL(src.url).hostname, trustedHosts) ? yes.push(src) : no.push(src); }
      catch { no.push(src); }
      return [yes, no];
    },
    [[], []]
  );

  const signedOurs = await Promise.all(
    ours.map((src) => authorizeUrl(src.url, { secret: c.env.SIGNING_SECRET, trustedHosts }))
  );
  const expDefault = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

  const tagged = (src: StreamSource, i: number): StreamSource & { exp: number; signed: boolean } =>
    i < signedOurs.length
      ? { ...src, url: signedOurs[i].url, exp: signedOurs[i].exp, signed: signedOurs[i].signed }
      : { ...src, exp: expDefault, signed: false };

  const signedSources: (StreamSource & { exp: number; signed: boolean })[] = [
    ...ours.map(tagged),
    ...external.map((src) => ({ ...src, exp: expDefault, signed: false })),
  ];

  if (signedSources.length === 0) {
    return c.json({
      error: 'No stream sources found for this movie. It may not be locally uploaded and no external sources are available.',
      code: 'NO_SOURCES_FOUND',
      movieId,
      title: movie.title,
    }, 404);
  }

  // Pick best AFTER signing so the selected URL is the one the client will actually use
  const best = resolver.bestSource(signedSources);

  // Increment view count
  await db
    .update(movies)
    .set({ viewCount: (movie.viewCount || 0) + 1 })
    .where(eq(movies.id, movieId));

  // signedBest === best (same array); naming makes the response fields clear
  const signedBest = best as StreamSource & { exp: number; signed: boolean };

  return c.json({
    movieId,
    quality: signedBest.quality,
    streamingUrl: signedBest.url,
    exp: signedBest.exp,
    signed: signedBest.signed,
    type: signedBest.type,
    source: signedBest.source,
    label: signedBest.label,
    allSources: resolver.sortByPriority(signedSources).map((s) => {
      const src = s as StreamSource & { exp: number; signed: boolean };
      return {
        url: src.url,
        exp: src.exp,
        signed: src.signed,
        type: src.type,
        quality: src.quality,
        label: src.label,
        source: src.source,
        title: src.title,
      };
    }),
  });
});

export { watch as watchRoutes };
