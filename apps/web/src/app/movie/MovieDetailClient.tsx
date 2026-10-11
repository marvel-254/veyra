'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Download, Play, Share2, Clock, Calendar, Star, ChevronDown, X, Loader2 } from 'lucide-react';
import { api, type Movie, type DownloadTask, type DownloadQuality } from '@/lib/api';

type DownloadStatus = 'idle' | 'queued' | 'processing' | 'saving' | 'completed' | 'failed';

export default function MovieDetailClient() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') || '';

  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Download state
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
  const [downloadTask, setDownloadTask] = useState<DownloadTask | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [qualities, setQualities] = useState<DownloadQuality[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('1080p');
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const { movie: data } = await api.getMovie(slug);
        setMovie(data);
      } catch {
        setError('Movie not found');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchMovie();
  }, [slug]);

  const fetchQualities = useCallback(async (url: string) => {
    try {
      const data = await api.getDownloadQualities(url);
      setQualities(data.qualities);
      if (data.qualities.length > 0) {
        // Prefer 1080p, fall back to first option
        const preferred = data.qualities.find((q) => q.value === '1080p') || data.qualities[0];
        setSelectedQuality(preferred.value);
      }
    } catch {
      // No qualities available — user can still initiate download
    }
  }, []);

  const handleStartDownload = async () => {
    if (!movie) return;
    setDownloadStatus('queued');
    setDownloadError(null);

    try {
      // Use the movie's YouTube URL or TMDB trailer
      let videoUrl = movie.trailerUrl;
      if (!videoUrl) {
        setDownloadError('No download source available for this title.');
        setDownloadStatus('failed');
        return;
      }

      const task = await api.startDownload({
        url: videoUrl,
        movieId: movie.id,
        quality: selectedQuality,
        title: movie.title,
      });

      setDownloadTask(task);

      if (task.status === 'completed' && task.url) {
        setDownloadStatus('completed');
        triggerDownload(task.url, movie.title);
        return;
      }

      setDownloadStatus('processing');

      // Poll for completion (simple polling — in production use WebSocket/SSE)
      pollDownloadStatus(task.taskId);
    } catch (err: any) {
      setDownloadError(err.message || 'Failed to start download');
      setDownloadStatus('failed');
    }
  };

  const pollDownloadStatus = async (taskId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      if (downloadStatus === 'failed' || downloadStatus === 'completed') return;

      try {
        const task = await api.getDownloadStatus(taskId);
        setDownloadTask(task);

        if (task.status === 'completed' && task.url) {
          setDownloadStatus('completed');
          if (movie) triggerDownload(task.url, movie.title);
          return;
        }

        if (task.status === 'failed') {
          setDownloadError(task.error || 'Download failed');
          setDownloadStatus('failed');
          return;
        }

        if (task.progress !== undefined) {
          setDownloadProgress(task.progress);
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setDownloadError('Download timed out. Please try again.');
          setDownloadStatus('failed');
        }
      } catch {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setDownloadError('Lost connection to download server.');
          setDownloadStatus('failed');
        }
      }
    };

    setTimeout(poll, 2000);
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.mp4`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = () => {
    if (!movie) return;
    const url = `${window.location.origin}/movie?slug=${movie.slug}`;
    if (navigator.share) {
      navigator.share({ title: movie.title, text: movie.shortDescription, url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
    if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)}MB`;
    return `${(bytes / 1e3).toFixed(0)}KB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <span className="text-5xl">🎬</span>
          <h1 className="text-2xl font-bold text-white">Movie Not Found</h1>
          <Link href="/" className="btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const rating = movie.voteAverage || movie.imdbRating;
  const canDownload = !!movie.trailerUrl;

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── Hero Backdrop ──────────────────────────────────────────── */}
      <div className="relative w-full h-[75vh] min-h-[500px] max-h-[800px]">
        {movie.backdropUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${movie.backdropUrl}')` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-surface" />
        )}

        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background/80 to-transparent" />
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 md:px-16 pb-10 md:pb-14">
          <div className="max-w-4xl">
            {/* Title */}
            <h1 className="font-display-xl text-4xl md:text-6xl lg:text-7xl text-white mb-4 drop-shadow-2xl">
              {movie.title}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {rating && (
                <div className="flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                  <Star size={15} className="text-yellow-400" fill="currentColor" />
                  <span className="text-white font-bold text-sm">{rating}</span>
                  <span className="text-on-surface-variant text-xs">/10</span>
                </div>
              )}
              {movie.year && (
                <span className="flex items-center gap-1 text-on-surface-variant text-sm">
                  <Calendar size={14} />
                  {movie.year}
                </span>
              )}
              {movie.duration && (
                <span className="flex items-center gap-1 text-on-surface-variant text-sm">
                  <Clock size={14} />
                  {formatDuration(movie.duration)}
                </span>
              )}
              {movie.rating && (
                <span className="px-2.5 py-1 bg-white/10 backdrop-blur-sm text-white text-xs font-bold rounded border border-white/20 uppercase tracking-wider">
                  {movie.rating}
                </span>
              )}
              {movie.type === 'series' && (
                <span className="px-2.5 py-1 bg-primary/20 text-primary text-xs font-bold rounded border border-primary/30">
                  Series
                </span>
              )}
              {movie.originalLanguage && (
                <span className="text-on-surface-variant text-xs">
                  {movie.originalLanguage.toUpperCase()}
                </span>
              )}
            </div>

            {/* Genres */}
            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {movie.genres.map((genre) => (
                  <Link
                    key={genre.id}
                    href={`/?genre=${genre.id}`}
                    className="px-3 py-1.5 bg-white/5 backdrop-blur-sm text-on-surface-variant text-xs font-medium rounded-full border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-on-surface-variant text-base md:text-lg mb-6 max-w-2xl leading-relaxed">
              {movie.description || movie.shortDescription}
            </p>

            {/* ── Action Buttons: Watch (stream) + Download (local) ─── */}
            <div className="flex flex-wrap gap-3">
              {/* Watch — streams via the in-app player */}
              <Link
                href={`/watch?id=${movie.id}`}
                className="group flex items-center gap-2.5 bg-white text-black font-bold px-7 py-3.5 rounded-lg hover:bg-white/90 transition-all duration-200 shadow-lg shadow-white/10"
              >
                <Play size={22} fill="black" className="text-black" />
                <span>Watch</span>
              </Link>
              {/* Download Button — saves the video to the device */}
              <div className="relative">
                <button
                  onClick={canDownload ? handleStartDownload : undefined}
                  disabled={!canDownload || downloadStatus === 'queued' || downloadStatus === 'processing'}
                  className={`flex items-center gap-2.5 font-bold px-7 py-3.5 rounded-lg transition-all duration-200 shadow-lg ${
                    canDownload
                      ? 'bg-tertiary text-on-tertiary hover:bg-tertiary/90 shadow-tertiary/20'
                      : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
                  }`}
                >
                  {downloadStatus === 'queued' || downloadStatus === 'processing' ? (
                    <>
                      <Loader2 size={22} className="animate-spin" />
                      <span>
                        {downloadStatus === 'queued' ? 'Queued...' : `${downloadProgress}%`}
                      </span>
                    </>
                  ) : downloadStatus === 'completed' ? (
                    <>
                      <Download size={22} />
                      <span>Downloaded</span>
                    </>
                  ) : downloadStatus === 'failed' ? (
                    <>
                      <X size={22} />
                      <span>Retry</span>
                    </>
                  ) : (
                    <>
                      <Download size={22} />
                      <span>Download</span>
                    </>
                  )}
                </button>

                {/* Quality picker (only show when idle */}
                {canDownload && downloadStatus === 'idle' && qualities.length > 0 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQualityPicker(!showQualityPicker);
                      }}
                      className="absolute right-12 top-1/2 -translate-y-1/2 text-on-tertiary hover:text-on-tertiary/80 transition-colors"
                      aria-label="Choose quality"
                    >
                      <ChevronDown size={16} />
                    </button>

                    {showQualityPicker && (
                      <div className="absolute bottom-full mb-2 right-0 w-44 glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl z-30">
                        {qualities.map((q) => (
                          <button
                            key={q.value}
                            onClick={() => {
                              setSelectedQuality(q.value);
                              setShowQualityPicker(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              selectedQuality === q.value
                                ? 'bg-tertiary/20 text-tertiary font-semibold'
                                : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <span className="block">{q.label}</span>
                            {q.sizeEstimate && (
                              <span className="block text-xs opacity-60 mt-0.5">{q.sizeEstimate}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Download Progress Bar */}
              {(downloadStatus === 'processing') && (
                <div className="flex flex-col gap-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="text-tertiary animate-spin" />
                    <span className="text-xs text-on-surface-variant">
                      {downloadTask?.estimatedTime
                        ? `~${Math.ceil(downloadTask.estimatedTime / 60)} min left`
                        : 'Processing...'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tertiary rounded-full transition-all duration-500"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm text-white font-bold px-6 py-3.5 rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-200"
              >
                <Share2 size={20} />
                Share
              </button>
            </div>

            {/* Download Error */}
            {downloadError && downloadStatus === 'failed' && (
              <p className="mt-3 text-sm text-red-400 flex items-center gap-1.5">
                <X size={14} />
                {downloadError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Details Section ────────────────────────────────────────── */}
      <main className="relative z-20 px-5 md:px-16 py-10 md:py-14">
        <div className="max-w-4xl space-y-10">
          {/* Director & Cast */}
          {(movie.director || (movie.cast && movie.cast.length > 0)) && (
            <section>
              <h2 className="font-headline-md text-xl text-white mb-4">Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {movie.director && (
                  <div className="p-4 bg-surface-container rounded-xl">
                    <span className="font-label-caps text-xs text-on-surface-variant block mb-1">
                      Director
                    </span>
                    <span className="text-white font-medium">{movie.director}</span>
                  </div>
                )}
                {movie.cast && movie.cast.length > 0 && (
                  <div className="p-4 bg-surface-container rounded-xl">
                    <span className="font-label-caps text-xs text-on-surface-variant block mb-1">
                      Cast
                    </span>
                    <span className="text-white font-medium">{movie.cast.join(', ')}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Trailer */}
          {movie.trailerUrl && (
            <section>
              <h2 className="font-headline-md text-xl text-white mb-4">Trailer</h2>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/5">
                <iframe
                  src={`https://www.youtube.com/embed/${
                    movie.trailerUrl.includes('v=')
                      ? movie.trailerUrl.split('v=')[1]?.split('&')[0]
                      : movie.trailerUrl.includes('youtu.be/')
                        ? movie.trailerUrl.split('youtu.be/')[1]?.split('?')[0]
                        : movie.trailerUrl
                  }`}
                  title="Trailer"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </section>
          )}

          {/* TMDB Metadata */}
          {movie.tmdbId && (
            <section className="p-4 bg-surface-container rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-on-surface-variant text-xs mb-1">TMDB Metadata</p>
                  <p className="text-white text-sm">
                    ID: {movie.tmdbId} ·{' '}
                    {movie.tmdbMediaType === 'tv' ? 'TV Show' : 'Movie'}
                    {movie.releaseDate ? ` · Released ${movie.releaseDate}` : ''}
                  </p>
                </div>
                <a
                  href={`https://www.themoviedb.org/${movie.tmdbMediaType || 'movie'}/${movie.tmdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm hover:underline font-medium"
                >
                  View on TMDB →
                </a>
              </div>
            </section>
          )}

          {/* Download Info (free, no account needed) */}
          <section className="p-5 bg-surface-container rounded-xl border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-tertiary/20 flex items-center justify-center flex-shrink-0">
                <Download size={20} className="text-tertiary" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Free Download</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  Download this title directly to your device — no account required.
                  All downloads are sourced from publicly available content and are free
                  to use.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}