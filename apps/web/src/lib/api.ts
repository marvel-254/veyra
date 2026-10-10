const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

// When true (default in dev), any API failure falls back to the in-browser
// mock backend so the frontend works end-to-end without the real API.
const MOCK_FALLBACK = process.env.NEXT_PUBLIC_MOCK_API !== 'false';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// ── Core Types ───────────────────────────────────────────────

export interface Movie {
  id: number;
  title: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  type: 'movie' | 'series';
  year?: number;
  duration?: number;
  rating?: string;
  imdbRating?: number;
  director?: string;
  cast?: string[];
  tags?: string[];
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  status: string;
  featured?: boolean;
  trending?: boolean;
  viewCount?: number;
  availableQualities?: string[];
  genres?: Genre[];
  series?: SeriesInfo;
  seasons?: Season[];
  mediaFiles?: MediaFile[];
  // TMDB fields
  tmdbId?: number;
  tmdbMediaType?: string;
  originalTitle?: string;
  originalLanguage?: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  posterPath?: string;
  backdropPath?: string;
  productionCountries?: string[];
  spokenLanguages?: string[];
  statusTmdb?: string;
  metadataUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Genre {
  id: number;
  name: string;
  slug: string;
}

export interface SeriesInfo {
  id: number;
  movieId: number;
  totalSeasons: number;
  totalEpisodes: number;
  status: string;
}

export interface Season {
  id: number;
  seriesId: number;
  seasonNumber: number;
  title?: string;
  description?: string;
  episodes?: Episode[];
}

export interface Episode {
  id: number;
  seasonId: number;
  episodeNumber: number;
  title: string;
  description?: string;
  duration?: number;
  thumbnailUrl?: string;
}

export interface MediaFile {
  id: number;
  movieId?: number;
  episodeId?: number;
  storageProvider: string;
  quality?: string;
  streamingEnabled: boolean;
  downloadEnabled: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Download Types ──────────────────────────────────────────

export interface DownloadQuality {
  label: string;
  value: string;
  sizeEstimate?: string;
}

export interface DownloadTask {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  estimatedTime?: number;
  url?: string;
  expiresAt?: string;
  error?: string;
  quality?: string;
  fileSize?: number;
}

// ── Mock fallback ────────────────────────────────────────────

class ApiClient {
  private baseUrl: string;
  private mockWarned = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  isMockFallback() {
    return MOCK_FALLBACK;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!MOCK_FALLBACK) {
      return this.realRequest<T>(endpoint, options);
    }

    try {
      return await this.realRequest<T>(endpoint, options);
    } catch (err) {
      if (!this.mockWarned) {
        console.warn(
          '[Veyra] API unreachable — falling back to in-browser mock data. ' +
            'Set NEXT_PUBLIC_MOCK_API=false to disable.',
          err
        );
        this.mockWarned = true;
      }
      const { mockRequest } = await import('@/lib/mock/api');
      const { body, headers, ...rest } = options as any;
      return mockRequest(endpoint, {
        method: rest.method,
        body: body instanceof FormData ? body : body ? JSON.parse(body) : undefined,
      });
    }
  }

  private async realRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ── Movies ─────────────────────────────────────────────────

  async getMovies(params?: {
    page?: number;
    limit?: number;
    genre?: number;
    type?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.genre) searchParams.set('genre', String(params.genre));
    if (params?.type) searchParams.set('type', params.type);

    const query = searchParams.toString();
    return this.request<{ movies: Movie[]; pagination: Pagination }>(
      `/api/movies${query ? `?${query}` : ''}`
    );
  }

  async getFeaturedMovies() {
    return this.request<{ movies: Movie[] }>('/api/movies/featured');
  }

  async getTrendingMovies(limit = 10) {
    return this.request<{ movies: Movie[] }>(`/api/movies/trending?limit=${limit}`);
  }

  async getMovie(slug: string) {
    return this.request<{ movie: Movie }>(`/api/movies/${slug}`);
  }

  // ── Search ─────────────────────────────────────────────────

  async search(query: string, params?: { page?: number; limit?: number }) {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    return this.request<{
      results: Movie[];
      query: string;
      pagination: Pagination;
    }>(`/api/search?${searchParams.toString()}`);
  }

  async getSearchSuggestions(query: string) {
    return this.request<{ suggestions: Movie[] }>(
      `/api/search/suggestions?q=${encodeURIComponent(query)}`
    );
  }

  // ── Genres ─────────────────────────────────────────────────

  async getGenres() {
    return this.request<{ genres: Genre[] }>('/api/genres');
  }

  // ── Download (yt-dlp via Cloudflare Worker) ──────────────────

  /**
   * Get available download qualities for a YouTube URL.
   * Returns a list of quality options with estimated file sizes.
   */
  async getDownloadQualities(url: string) {
    return this.request<{ qualities: DownloadQuality[] }>('/api/download/qualities', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  /**
   * Initiate a video download via yt-dlp.
   * Returns a task ID for polling download status.
   */
  async startDownload(params: {
    url: string;
    movieId?: number;
    quality?: string;
    title?: string;
  }) {
    return this.request<DownloadTask>('/api/download', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Poll the status of an in-progress or completed download.
   */
  async getDownloadStatus(taskId: string) {
    return this.request<DownloadTask>(`/api/download/${taskId}`);
  }

  /**
   * Cancel an in-progress download task.
   */
  async cancelDownload(taskId: string) {
    return this.request<{ success: boolean }>(`/api/download/${taskId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get the list of in-progress download tasks.
   */
  async getDownloadTasks() {
    return this.request<{ tasks: DownloadTask[] }>('/api/download/tasks');
  }

  // ── Streaming ─────────────────────────────────────────────────

  async getStreamingUrl(movieId: number, quality = '1080') {
    return this.request<{
      movieId: number;
      quality: string;
      streamingUrl: string;
      contentType?: string;
      fileSize?: number;
      duration?: number;
    }>(`/api/watch/streaming-url/${movieId}?quality=${quality}`);
  }

  // ── TMDB Discovery ──────────────────────────────────────────

  async discoverySearch(query: string, params?: { page?: number; media_type?: string }) {
    const searchParams = new URLSearchParams({ q: query });
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.media_type) searchParams.set('media_type', params.media_type);
    return this.request<DiscoverySearchResult>(
      `/api/discovery/search?${searchParams.toString()}`
    );
  }

  async discoverySuggestions(query: string, limit = 8) {
    return this.request<{ suggestions: DiscoverySuggestion[] }>(
      `/api/discovery/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  async getTrending(timeWindow: 'day' | 'week' = 'day', page = 1) {
    return this.request<DiscoveryListResult>(
      `/api/discovery/trending?time_window=${timeWindow}&page=${page}`
    );
  }

  async getPopular(mediaType: 'movie' | 'tv' = 'movie', page = 1) {
    return this.request<DiscoveryListResult>(
      `/api/discovery/popular?media_type=${mediaType}&page=${page}`
    );
  }

  async getDiscoveryMovie(tmdbId: number) {
    return this.request<DiscoveryMovieDetail>(`/api/discovery/movie/${tmdbId}`);
  }

  async getDiscoveryTV(tmdbId: number) {
    return this.request<DiscoveryTVDetail>(`/api/discovery/tv/${tmdbId}`);
  }

  async getMovieRecommendations(tmdbId: number) {
    return this.request<{ results: DiscoveryItem[] }>(
      `/api/discovery/movie/${tmdbId}/recommendations`
    );
  }

  async getTVRecommendations(tmdbId: number) {
    return this.request<{ results: DiscoveryItem[] }>(
      `/api/discovery/tv/${tmdbId}/recommendations`
    );
  }

  async getDiscoveryGenres() {
    return this.request<{ genres: Array<{ id: number; name: string }> }>(
      '/api/discovery/genres'
    );
  }
}

// ── Discovery Types ─────────────────────────────────────────

export interface DiscoveryItem {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  originalTitle?: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  originalLanguage?: string;
  genreIds?: number[];
  posterPath?: string;
  backdropPath?: string;
  posterUrl?: string;
  backdropUrl?: string;
}

export interface DiscoverySearchResult {
  page: number;
  results: DiscoveryItem[];
  total_results?: number;
  total_pages?: number;
  query: string;
}

export interface DiscoveryListResult {
  page: number;
  results: DiscoveryItem[];
  totalPages?: number;
  totalResults?: number;
}

export interface DiscoverySuggestion {
  tmdbId: number;
  mediaType: string;
  title: string;
  posterPath?: string;
  releaseDate?: string;
  voteAverage?: number;
}

export interface DiscoveryMovieDetail {
  tmdbId: number;
  title: string;
  originalTitle?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  runtime?: number;
  genres?: string[];
  productionCountries?: string[];
  spokenLanguages?: string[];
  status?: string;
  tagline?: string;
  originalLanguage?: string;
  posterUrl?: string;
  backdropUrl?: string;
  trailer?: string;
  cast?: Array<{ name: string; character: string; profileUrl?: string }>;
  director?: string;
}

export interface DiscoveryTVDetail extends DiscoveryMovieDetail {
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: Array<{
    seasonNumber: number;
    name: string;
    overview?: string;
    posterPath?: string;
    airDate?: string;
    episodeCount?: number;
  }>;
}

export type { Season, Episode, Pagination };
export const api = new ApiClient(API_URL);