'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import VideoPlayer from '@/components/VideoPlayer';
import { api, type Movie } from '@/lib/api';
import {
  saveProgress,
  getProgress,
  type LocalProgress,
} from '@/lib/local-progress';

const SAVE_DEBOUNCE_MS = 5_000; // save every 5 seconds

function WatchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const movieId = parseInt(searchParams.get('id') || '', 10);

  const [movie, setMovie] = useState<Movie | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState('1080');
  const [initialPosition, setInitialPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Restore local progress on mount ─────────────────────────
  useEffect(() => {
    if (!movieId) return;
    const saved: LocalProgress | null = getProgress(movieId);
    if (saved && saved.position > 0 && !saved.completed) {
      setInitialPosition(saved.position);
    }
  }, [movieId]);

  // ── Fetch streaming URL ─────────────────────────────────────
  useEffect(() => {
    const fetchStream = async () => {
      try {
        const data = await api.getStreamingUrl(movieId, quality);
        setStreamingUrl(data.streamingUrl);
      } catch (err: any) {
        setError(
          err?.message || 'Streaming is not available for this title.'
        );
      } finally {
        setLoading(false);
      }
    };

    if (movieId) fetchStream();
  }, [movieId, quality]);

  // ── Fetch movie metadata for the title overlay ──────────────
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const res = await api.getMovies({ limit: 50 });
        const found = res.movies.find((m) => m.id === movieId);
        if (found) setMovie(found);
      } catch {
        // Not critical — movie data is purely decorative here.
      }
    };
    if (movieId) fetchMovie();
  }, [movieId]);

  // ── Save progress locally ────────────────────────────────────
  const handleProgress = useCallback(
    (position: number, duration: number) => {
      if (!movieId || position <= 0 || duration <= 0) return;
      saveProgress(movieId, position, duration);
    },
    [movieId]
  );

  // ── Quality change handler ───────────────────────────────────
  const handleQualityChange = useCallback(
    (q: string) => {
      const video = document.querySelector('video');
      const currentPosition = video?.currentTime || 0;
      setInitialPosition(currentPosition);
      setQuality(q);
    },
    []
  );

  // ── Back navigation ─────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (movie?.slug) {
      router.push(`/movie?slug=${movie.slug}`);
    } else {
      router.back();
    }
  }, [movie, router]);

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-on-surface-variant text-sm">Loading video...</p>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-6">
        <span className="text-5xl">⚠️</span>
        <h1 className="text-2xl font-bold text-white">Playback Error</h1>
        <p className="text-on-surface-variant text-center max-w-md">{error}</p>
        <Link
          href={movie?.slug ? `/movie?slug=${movie.slug}` : '/'}
          className="bg-primary text-on-primary px-6 py-3 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
        >
          {movie?.slug ? 'Back to Movie' : 'Back to Home'}
        </Link>
      </div>
    );
  }

  // ── Player ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black">
      {streamingUrl ? (
        <VideoPlayer
          src={streamingUrl}
          title={movie?.title}
          posterUrl={movie?.backdropUrl || movie?.posterUrl}
          quality={quality}
          onQualityChange={handleQualityChange}
          qualities={['480', '720', '1080']}
          onProgress={handleProgress}
          initialPosition={initialPosition}
          onBack={handleBack}
        />
      ) : (
        <div className="w-full h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-on-surface-variant">Loading video...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// useSearchParams requires a Suspense boundary for static export.
export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  );
}
