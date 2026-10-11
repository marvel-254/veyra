import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { movies, mediaFiles } from '../db/schema';
import { SourceResolver, type StreamSource } from '../lib/sources';
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
    c.env.YT_DLP_SERVICE_URL ?? '',
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
  const [archiveSources, tmdbSources, ytdlpSources] = await Promise.all([
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
    // yt-dlp — we need the YouTube URL from TMDB first, so handle inline below
    Promise.resolve<StreamSource[]>([]),
  ]);

  // yt-dlp: use the best YouTube URL found above
  const youtubeUrl = tmdbSources.find((s) => s.type === 'youtube')?.url;
  let ytdlpResolved: StreamSource[] = [];
  if (youtubeUrl && c.env.YT_DLP_SERVICE_URL && (!preferSource || preferSource === 'yt-dlp')) {
    try {
      const res = await fetch(`${c.env.YT_DLP_SERVICE_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json() as { url?: string; directUrl?: string };
        const directUrl = data.url ?? data.directUrl;
        if (directUrl) {
          const isHLS = directUrl.includes('.m3u8');
          ytdlpResolved = [{
            url: directUrl,
            type: isHLS ? 'hls' : 'mp4',
            quality: 'best',
            label: isHLS ? 'Auto (HLS)' : 'Best Available',
            source: 'yt-dlp',
          }];
        }
      }
    } catch { /* ignore yt-dlp failures */ }
  }

  // Collect all sources
  const allSources: StreamSource[] = [
    ...archiveSources,
    ...ytdlpResolved,
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

  // Pick the best source
  const best = resolver.bestSource(allSources);

  if (!best) {
    return c.json({
      error: 'No stream sources found for this movie. It may not be locally uploaded and no external sources are available.',
      code: 'NO_SOURCES_FOUND',
      movieId,
      title: movie.title,
    }, 404);
  }

  // Increment view count
  await db
    .update(movies)
    .set({ viewCount: (movie.viewCount || 0) + 1 })
    .where(eq(movies.id, movieId));

  return c.json({
    movieId,
    quality: best.quality,
    streamingUrl: best.url,
    type: best.type,
    source: best.source,
    label: best.label,
    allSources: resolver.sortByPriority(allSources),
  });
});

export { watch as watchRoutes };
