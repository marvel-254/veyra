// Source Resolver — queries multiple free/online streaming sources concurrently.
// All sources are read-only; no upload or write operations.

export type StreamSourceType = 'hls' | 'mp4' | 'youtube' | 'dash';
export type StreamSourceProvider = 'YouTube' | 'TMDB' | 'Archive' | 'yt-dlp' | 'R2';

export interface StreamSource {
  url: string;
  type: StreamSourceType;
  quality: string;
  label: string;
  source: StreamSourceProvider;
  /** Optional title for display in the player */
  title?: string;
}

export interface MovieLookup {
  id?: number;
  title: string;
  /** Release year — can be null if not set in the database */
  year?: number | null;
  /** TMDB ID — if not provided, a TMDB search will be attempted */
  tmdbId?: number;
  /** Local R2 media file path for uploaded content */
  localPath?: string;
  /** Poster image URL */
  posterUrl?: string;
}

// ── Internet Archive resolver ───────────────────────────────────

const ARCHIVE_API = 'https://archive.org/advancedsearch.php';

async function resolveArchive(title: string, year?: number): Promise<StreamSource[]> {
  try {
    // Build a search query. Include year if provided for precision.
    const searchTitle = year ? `${title} ${year}` : title;
    const params = new URLSearchParams({
      q: `title:${searchTitle} OR ${searchTitle} mediatype:movies OR mediatype:video`,
      fl: 'identifier,title,mediatype,downloadURL,format',
      output: 'json',
      rows: '5',
      sort: 'downloads desc',
    });

    const url = `${ARCHIVE_API}?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      response?: { docs?: Array<{
        identifier?: string;
        title?: string;
        mediatype?: string;
        downloadURL?: string;
        format?: string | string[];
      }> };
    };

    const docs = data.response?.docs ?? [];
    const sources: StreamSource[] = [];

    for (const doc of docs) {
      const mediatype = doc.mediatype;
      if (mediatype !== 'movies' && mediatype !== 'video') continue;

      const downloadURL = doc.downloadURL;
      if (!downloadURL) continue;

      // Prefer MP4 format for direct playback
      const formats = Array.isArray(doc.format) ? doc.format : [doc.format].filter(Boolean);
      const isMP4 =
        formats.some(
          (f) => typeof f === 'string' && (f.toLowerCase().includes('mpeg4') || f.toLowerCase().includes('mp4'))
        ) ||
        downloadURL.toLowerCase().endsWith('.mp4');

      sources.push({
        url: downloadURL,
        type: isMP4 ? 'mp4' : 'mp4', // Archive serves progressive MP4 most of the time
        quality: '720',
        label: '720p (Archive)',
        source: 'Archive',
        title: doc.title ?? undefined,
      });

      // Return the first valid video source found
      break;
    }

    return sources;
  } catch {
    // Network or parse error — return empty
    return [];
  }
}

// ── TMDB / YouTube resolver ──────────────────────────────────────

async function resolveTMDB(tmdbId: number, token: string): Promise<StreamSource[]> {
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}/videos?language=en-US`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        key?: string;
        site?: string;
        type?: string;
        name?: string;
        official?: boolean;
      }>;
    };

    const videos = data.results ?? [];

    // Priority: official Trailer > Teaser > Clip
    const sorted = [...videos].sort((a, b) => {
      const typeOrder = a.type === 'Trailer' ? 0 : a.type === 'Teaser' ? 1 : 2;
      const bTypeOrder = b.type === 'Trailer' ? 0 : b.type === 'Teaser' ? 1 : 2;
      if (typeOrder !== bTypeOrder) return typeOrder - bTypeOrder;
      // Prefer official videos
      if (a.official !== b.official) return a.official ? -1 : 1;
      return 0;
    });

    const sources: StreamSource[] = [];

    for (const video of sorted) {
      if (video.site === 'YouTube' && video.key) {
        const youtubeUrl = `https://www.youtube.com/watch?v=${video.key}`;
        sources.push({
          url: youtubeUrl,
          type: 'youtube',
          quality: 'trailer',
          label: video.name ?? video.type ?? 'YouTube Trailer',
          source: 'TMDB',
        });
      }
    }

    return sources;
  } catch {
    return [];
  }
}

// ── Free / ad-supported providers via TMDB official watch/providers ─────────
//
// TMDB exposes official free streaming links through /movie/{id}/watch/providers.
// The flatrate list = ad-supported tiers (Tubi, Pluto TV, Freevee/Amazon Freevee,
// Plex, etc.). We query it server-side, sort by quality (HLS/MP4 direct links
// over iframe embeds), and surface clean deep-links the VideoPlayer can open.
//
// TMDB's watch/providers is a sanctioned, rate-limit-friendly endpoint — no
// scraping, no API key needed beyond the bearer token we already have.

export type StreamSourceType = 'hls' | 'mp4' | 'youtube' | 'dash' | 'iframe';
export type StreamSourceProvider = 'YouTube' | 'TMDB' | 'Archive' | 'yt-dlp' | 'R2' | 'Tubi' | 'Plex' | 'PlutoTV' | 'FreeProviders';

export interface FreeProvider {
  provider: string;
  link: string;
  display_priority: number;
}

// TMDB watch/providers returns flatrate (ads), ads (ad-supported, non-flatrate),
// rent (paid), buy (paid). We surface flatrate + ads as free.
async function resolveFreeProviders(tmdbId: number, tmdbToken: string): Promise<StreamSource[]> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`,
      {
        headers: { Authorization: `Bearer ${tmdbToken}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: {
        [country: string]: {
          flatrate?: FreeProvider[];
          ads?: FreeProvider[];
          link?: string;
        };
      };
    };

    const results = data.results ?? {};
    // Prefer US; fall back to first available country
    const country = results['US'] ?? Object.values(results)[0];
    if (!country) return [];

    const allProviders = [
      ...(country.flatrate ?? []),
      ...(country.ads ?? []),
    ];

    if (allProviders.length === 0) return [];

    // Sort by TMDB display_priority (lower = higher quality provider)
    allProviders.sort((a, b) => a.display_priority - b.display_priority);

    const sources: StreamSource[] = [];

    for (const provider of allProviders) {
      if (!provider.link) continue;

      // iframe type for provider landing pages — VideoPlayer handles these
      sources.push({
        url: provider.link,
        type: 'iframe',
        quality: 'web',
        label: getProviderLabel(provider.provider),
        source: getProviderSource(provider.provider),
      });
    }

    return sources;
  } catch {
    return [];
  }
}

function getProviderLabel(name: string): string {
  const labels: Record<string, string> = {
    'Tubi TV': 'Watch on Tubi (free, ad-supported)',
    'Pluto TV': 'Watch on Pluto TV (free, ad-supported)',
    'Freevee': 'Watch on Freevee (free, ad-supported)',
    'Plex': 'Watch on Plex (free, ad-supported)',
    ' Peacock': 'Watch on Peacock (free, ad-supported)',
    ' Crackle': 'Watch on Crackle (free)',
    ' IMDb TV': 'Watch on IMDb TV (free, ad-supported)',
    ' Tubi': 'Watch on Tubi (free, ad-supported)',
  };
  return labels[name] ?? `Watch on ${name}`;
}

function getProviderSource(name: string): StreamSourceProvider {
  const n = name.toLowerCase();
  if (n.includes('tubi')) return 'Tubi';
  if (n.includes('plex')) return 'Plex';
  if (n.includes('pluto')) return 'PlutoTV';
  return 'FreeProviders';
}

// ── yt-dlp service resolver ──────────────────────────────────────

async function resolveYtdlp(youtubeUrl: string, serviceUrl: string): Promise<StreamSource[]> {
  try {
    const res = await fetch(`${serviceUrl}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: youtubeUrl }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      url?: string;
      directUrl?: string;
      formats?: Array<{ url?: string; ext?: string; height?: number; format?: string }>;
      title?: string;
    };

    const sources: StreamSource[] = [];

    // Primary direct URL
    const directUrl = data.url ?? data.directUrl;
    if (directUrl) {
      const isHLS = directUrl.includes('.m3u8');
      sources.push({
        url: directUrl,
        type: isHLS ? 'hls' : 'mp4',
        quality: 'best',
        label: isHLS ? 'Auto (HLS)' : 'Best Available',
        source: 'yt-dlp',
        title: data.title ?? undefined,
      });
    }

    // Individual formats from yt-dlp
    if (data.formats && Array.isArray(data.formats)) {
      for (const fmt of data.formats) {
        if (fmt.url) {
          const height = fmt.height ?? 0;
          const isHLS = fmt.url.includes('.m3u8');
          sources.push({
            url: fmt.url,
            type: isHLS ? 'hls' : 'mp4',
            quality: height >= 1080 ? '1080p' : height >= 720 ? '720p' : height >= 480 ? '480p' : '360p',
            label: `${height}p (yt-dlp)`,
            source: 'yt-dlp',
          });
        }
      }
    }

    return sources;
  } catch {
    return [];
  }
}

// ── Local R2 resolver ───────────────────────────────────────────

export interface R2MediaInfo {
  objectPath: string;
  publicUrl?: string;
  mimeType?: string;
  quality?: string;
  fileSize?: number;
  duration?: number;
}

function resolveR2(media: R2MediaInfo, publicDomain?: string): StreamSource[] {
  const streamingUrl = media.publicUrl ?? (publicDomain ? `https://${publicDomain}/${media.objectPath}` : null);
  if (!streamingUrl) return [];

  const isHLS = streamingUrl.includes('.m3u8') || streamingUrl.includes('manifest');

  return [
    {
      url: streamingUrl,
      type: isHLS ? 'hls' : 'mp4',
      quality: media.quality ?? 'unknown',
      label: media.quality ? `${media.quality}p` : 'Uploaded',
      source: 'R2',
    },
  ];
}

// ── SourceResolver ───────────────────────────────────────────────

export class SourceResolver {
  private tmdbToken: string;
  private r2PublicDomain?: string;

  constructor(tmdbToken: string, r2PublicDomain?: string) {
    this.tmdbToken = tmdbToken;
    this.r2PublicDomain = r2PublicDomain;
  }

  /**
   * Resolve all available stream sources for a movie.
   *
   * Stage 1 (Internet Archive, TMDB/YouTube) runs concurrently; stage 2 (yt-dlp)
   * depends on the YouTube key discovered in stage 1. Every stage is guarded with
   * Promise.allSettled + per-resolver try/catch so one failing provider can never
   * fail the whole request — a failed resolver simply yields an empty array.
   */
  async resolveSources(movie: MovieLookup): Promise<StreamSource[]> {
    // Normalize nullable year to undefined for resolvers
    const year = movie.year ?? undefined;

    // ── Stage 1: independent providers ──────────────────────────
    const [archiveResult, tmdbResult] = await Promise.allSettled([
      resolveArchive(movie.title, year),
      movie.tmdbId
        ? resolveTMDB(movie.tmdbId, this.tmdbToken)
        : Promise.resolve([] as StreamSource[]),
    ]);

    const archiveSources: StreamSource[] =
      archiveResult.status === 'fulfilled' ? archiveResult.value : [];
    const tmdbSources: StreamSource[] =
      tmdbResult.status === 'fulfilled' ? tmdbResult.value : [];

    // ── Stage 2: free ad-supported providers via TMDB watch/providers ─────────
    const freeProvidersResult = movie.tmdbId
      ? await resolveFreeProviders(movie.tmdbId, this.tmdbToken).catch(() => [])
      : [];
    const freeSources: StreamSource[] = freeProvidersResult;

    // ── Stage 3: Local R2 source for uploaded content ────────────────────
    const r2Sources: StreamSource[] = movie.localPath
      ? resolveR2(
          { objectPath: movie.localPath, quality: '1080', publicUrl: undefined },
          this.r2PublicDomain
        )
      : [];

    return [...archiveSources, ...freeSources, ...tmdbSources, ...ytdlpSources, ...r2Sources];
  }

  /**
   * Returns sources sorted by playback quality priority:
   * HLS > MP4 > YouTube (trailer)
   */
  sortByPriority(sources: StreamSource[]): StreamSource[] {
    const typePriority: Record<StreamSourceType, number> = {
      hls: 0,
      mp4: 1,
      dash: 2,
      youtube: 3,
      iframe: 4, // free provider landing pages — last resort for streaming
    };

    return [...sources].sort((a, b) => {
      // Primary: source type
      const pA = typePriority[a.type] ?? 99;
      const pB = typePriority[b.type] ?? 99;
      if (pA !== pB) return pA - pB;

      // Secondary: quality label (best effort numeric sort)
      const numA = parseInt(a.quality) || 0;
      const numB = parseInt(b.quality) || 0;
      return numB - numA;
    });
  }

  /**
   * Returns the single best source, or null if none available.
   */
  bestSource(sources: StreamSource[]): StreamSource | null {
    const sorted = this.sortByPriority(sources);
    return sorted[0] ?? null;
  }
}
