'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import VideoPlayer from '@/components/VideoPlayer';
import { getProgress } from '@/lib/local-progress';
import {
  listDownloads,
  removeDownload,
  getStorageUsage,
  getDownloadObjectUrl,
  revokeDownloadObjectUrl,
  type DownloadedFile,
  type StorageUsage,
} from '@/lib/download-store';
import { WifiOff, Trash2, Play, Download, HardDrive } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
  } catch {
    return '—';
  }
}

/** Progress percentage 0-100 for a single movie. */
function progressPct(movieId: number): number {
  const p = getProgress(movieId);
  if (!p || !p.duration) return 0;
  return Math.min(100, Math.round((p.position / p.duration) * 100));
}

// ── Storage Header ───────────────────────────────────────────

function StorageHeader({ usage }: { usage: StorageUsage | null }) {
  if (!usage) return null;
  const pct = Math.min(100, usage.percent);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-2">
        <HardDrive size={14} />
        <span>
          {formatSize(usage.used)}
          {usage.quota && usage.supported
            ? ` of ${formatSize(usage.quota)}`
            : ' saved'}
          {usage.supported && pct > 0 ? ` · ${pct.toFixed(0)}% used` : ''}
        </span>
      </div>

      {usage.supported && (
        <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Offline Banner ───────────────────────────────────────────

function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container text-on-surface-variant text-sm rounded-xl mb-5">
      <WifiOff size={15} className="flex-shrink-0 text-on-surface-variant" />
      <span>You&apos;re offline — downloads play without internet</span>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 gap-4">
      <span className="text-6xl">📥</span>
      <h2 className="font-headline-md text-xl text-white">No downloads yet</h2>
      <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed">
        Find a movie and tap <strong className="text-white">Download</strong> — it&apos;ll
        appear here and play offline anytime.
      </p>
      <Link
        href="/"
        className="mt-2 flex items-center gap-2 bg-primary text-on-primary font-bold px-6 py-3 rounded-lg hover:bg-primary/90 transition-all min-h-[48px]"
      >
        <Download size={16} />
        Browse Movies
      </Link>
    </div>
  );
}

// ── Download Row ─────────────────────────────────────────────

interface DownloadRowProps {
  file: DownloadedFile;
  onPlay: (file: DownloadedFile) => void;
  onDelete: (movieId: number) => void;
}

function DownloadRow({ file, onPlay, onDelete }: DownloadRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pct = progressPct(file.movieId);
  const isStarted = pct > 0;

  const handleDelete = useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-cancel confirm after 3 s
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setConfirmDelete(false);
    onDelete(file.movieId);
  }, [confirmDelete, file.movieId, onDelete]);

  return (
    <div
      className="flex items-center gap-4 p-4 bg-surface-container rounded-xl border border-white/5 animate-fade-in group min-h-[88px]"
    >
      {/* Poster thumbnail */}
      <div className="flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-surface-variant">
        {file.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.posterUrl}
            alt={file.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
            <Download size={18} />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold text-sm truncate">{file.title}</h3>
        <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-variant">
          <span>{formatSize(file.sizeBytes)}</span>
          <span>·</span>
          <span>{formatDate(file.downloadedAt)}</span>
        </div>

        {/* Progress bar */}
        {isStarted && (
          <div className="mt-2">
            <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-on-surface-variant mt-0.5 block">{pct}% watched</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Play */}
        <button
          onClick={() => onPlay(file)}
          className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center hover:bg-primary/90 transition-all min-h-[44px]"
          aria-label={`Play ${file.title}`}
        >
          <Play size={16} fill="currentColor" />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all min-h-[44px] ${
            confirmDelete
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
              : 'text-on-surface-variant hover:text-red-400 hover:bg-white/5'
          }`}
          aria-label={confirmDelete ? 'Confirm delete' : `Delete ${file.title}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Downloads List ───────────────────────────────────────────

function DownloadsList() {
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [playing, setPlaying] = useState<DownloadedFile | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [dl, usage] = await Promise.all([listDownloads(), getStorageUsage()]);
    setFiles(dl);
    setStorage(usage);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePlay = useCallback(async (file: DownloadedFile) => {
    // Revoke previous player URL
    if (playerUrl) revokeDownloadObjectUrl(playerUrl);
    const url = await getDownloadObjectUrl(file.movieId);
    if (url) {
      setPlayerUrl(url);
      setPlaying(file);
    }
  }, [playerUrl]);

  const handleBack = useCallback(() => {
    setPlaying(null);
    if (playerUrl) {
      revokeDownloadObjectUrl(playerUrl);
      setPlayerUrl(null);
    }
  }, [playerUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerUrl) revokeDownloadObjectUrl(playerUrl);
    };
  }, [playerUrl]);

  const handleDelete = useCallback(async (movieId: number) => {
    // If deleting the currently playing video, clean up player first.
    if (playing?.movieId === movieId) {
      if (playerUrl) {
        revokeDownloadObjectUrl(playerUrl);
        setPlayerUrl(null);
      }
      setPlaying(null);
    }
    await removeDownload(movieId);
    load();
  }, [playing, playerUrl, load]);

  // ── Inline Player View ─────────────────────────────────────
  if (playing && playerUrl) {
    return (
      <div className="min-h-screen bg-black relative">
        <VideoPlayer
          src={playerUrl}
          title={playing.title}
          posterUrl={playing.posterUrl}
          onBack={handleBack}
          sourceLabel="Saved offline"
        />
      </div>
    );
  }

  // ── Downloads List ─────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-headline-md text-2xl text-white mb-6">My Downloads</h1>

      <OfflineBanner />
      <StorageHeader usage={storage} />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <DownloadRow
              key={file.movieId}
              file={file}
              onPlay={handlePlay}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DownloadsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        }
      >
        <DownloadsList />
      </Suspense>
    </div>
  );
}
