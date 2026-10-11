'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Volume1,
  Maximize, Minimize, SkipBack, SkipForward,
  Settings, ChevronLeft, Globe,
} from 'lucide-react';

// ── Stream Source Types ──────────────────────────────────────────

export type StreamType = 'hls' | 'mp4' | 'dash' | 'youtube';

export interface StreamSource {
  url: string;
  type?: StreamType;
  quality?: string;
  label?: string; // e.g. "1080p", "720p", "Auto"
}

export type QualityOption = { value: string; label: string };

interface VideoPlayerProps {
  /** A plain URL string, or a full StreamSource descriptor. */
  src: string | StreamSource;
  title?: string;
  posterUrl?: string;
  quality?: string;
  onQualityChange?: (q: string) => void;
  /** Quality list: plain strings ("1080") or {value,label} objects. */
  qualities?: (string | QualityOption)[];
  onProgress?: (position: number, duration: number) => void;
  initialPosition?: number;
  onBack?: () => void;
  /** Human-readable name of the active provider, e.g. "Internet Archive". */
  sourceLabel?: string;
}

// ── Stream detection helpers ─────────────────────────────────────

function detectStreamType(url: string): StreamType {
  const u = url.toLowerCase();
  if (u.includes('.m3u8') || u.includes('application/vnd.apple.mpegurl')) return 'hls';
  if (u.includes('.mpd') || u.includes('application/dash+xml')) return 'dash';
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('googlevideo.com')) {
    return 'youtube';
  }
  return 'mp4';
}

function streamTypeLabel(type: StreamType): string {
  switch (type) {
    case 'hls':
      return 'HLS Stream';
    case 'dash':
      return 'DASH Stream';
    case 'youtube':
      return 'YouTube';
    default:
      return 'Direct Video';
  }
}

// ── Component ────────────────────────────────────────────────────

export default function VideoPlayer({
  src,
  title,
  posterUrl,
  quality = 'Auto',
  onQualityChange,
  qualities = [],
  onProgress,
  initialPosition = 0,
  onBack,
  sourceLabel,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // hls.js instance — typed loosely since hls.js is loaded via dynamic import.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);

  // ── Normalise the src prop into {url, type} ──────────────────
  const resolvedSrc = typeof src === 'string' ? src : src.url;
  const resolvedType: StreamType =
    typeof src === 'string'
      ? detectStreamType(src)
      : (src.type ?? detectStreamType(src.url));

  const isHls = resolvedType === 'hls';
  // YouTube embeds are not playable in a bare <video> tag.
  const needsExternalPlayer = resolvedType === 'youtube';

  // ── Quality options (strings or objects → normalised) ────────
  const qualityOptions: QualityOption[] = qualities.map((q) =>
    typeof q === 'string' ? { value: q, label: `${q}p` } : q,
  );

  // ── Video state ───────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // ── UI state ──────────────────────────────────────────────────
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  // ── HLS state ─────────────────────────────────────────────────
  // Levels discovered from the manifest, used by the quality switcher.
  const [hlsLevels, setHlsLevels] = useState<{ index: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 === Auto (ABR)

  const video = videoRef.current;

  // ── Format helpers ────────────────────────────────────────────
  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ── Media accessors (work for both native and HLS) ───────────
  const getMedia = (): HTMLVideoElement | null => {
    if (isHls && hlsRef.current?.media) return hlsRef.current.media as HTMLVideoElement;
    return videoRef.current;
  };

  // ── Play / Pause ──────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const el = getMedia();
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsPlaying(true);
      if (!hasStarted) setHasStarted(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, [hasStarted, isHls]);

  // ── Volume ────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const el = getMedia();
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  }, [isHls]);

  const handleVolumeChange = useCallback((val: number) => {
    const el = getMedia();
    if (!el) return;
    const clamped = Math.max(0, Math.min(1, val));
    el.volume = clamped;
    el.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  }, [isHls]);

  // ── Seek ──────────────────────────────────────────────────────
  const seekTo = useCallback(
    (time: number) => {
      const el = getMedia();
      if (!el) return;
      el.currentTime = Math.max(0, Math.min(time, el.duration || 0));
      setCurrentTime(el.currentTime);
    },
    [isHls],
  );

  const skip = useCallback(
    (seconds: number) => {
      const el = getMedia();
      if (!el) return;
      seekTo(el.currentTime + seconds);
    },
    [seekTo, isHls],
  );

  // ── Progress bar ──────────────────────────────────────────────
  const handleProgressClick = useCallback(
    (e: React.MouseEvent) => {
      const el = getMedia();
      if (!progressRef.current || !el) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(pct * (el.duration || 0));
    },
    [seekTo, isHls],
  );

  const handleProgressHover = useCallback(
    (e: React.MouseEvent) => {
      const el = getMedia();
      if (!progressRef.current || !el) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverTime(pct * (el.duration || 0));
      setHoverX(e.clientX - rect.left);
    },
    [isHls],
  );

  // ── Volume bar ────────────────────────────────────────────────
  const handleVolumeClick = useCallback(
    (e: React.MouseEvent) => {
      if (!volumeRef.current) return;
      const rect = volumeRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      handleVolumeChange(pct);
    },
    [handleVolumeChange],
  );

  // ── Fullscreen ────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, []);

  // ── Playback rate ─────────────────────────────────────────────
  const cyclePlaybackRate = useCallback(() => {
    const el = getMedia();
    if (!el) return;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = rates.indexOf(playbackRate);
    const next = rates[(idx + 1) % rates.length];
    el.playbackRate = next;
    setPlaybackRate(next);
  }, [playbackRate, isHls]);

  // ── Controls visibility ───────────────────────────────────────
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  // ── Quality switching ─────────────────────────────────────────
  // For HLS we drive hls.js directly; for other stream types we only
  // notify the parent so it can swap the source URL.
  const handleQualitySelect = useCallback(
    (levelIndex: number) => {
      if (isHls) {
        const hls = hlsRef.current;
        if (!hls) return;
        // -1 restores adaptive bitrate (Auto).
        hls.currentLevel = levelIndex;
        setCurrentLevel(levelIndex);
        const lvl = levelIndex >= 0 ? hls.levels?.[levelIndex] : undefined;
        onQualityChange?.(lvl?.height ? `${lvl.height}p` : 'Auto');
      } else {
        const match = qualityOptions[levelIndex];
        if (!match) return;
        setCurrentLevel(levelIndex);
        onQualityChange?.(match.value);
      }
      setShowSettings(false);
    },
    [isHls, onQualityChange, qualityOptions],
  );

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
      }
      showControlsTemporarily();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    togglePlay,
    skip,
    volume,
    handleVolumeChange,
    toggleFullscreen,
    toggleMute,
    showControlsTemporarily,
  ]);

  // ── hls.js setup / teardown ───────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!isHls || !resolvedSrc || !el) return;

    let cancelled = false;

    (async () => {
      const { default: Hls } = await import('hls.js');
      if (cancelled) return;

      // Safari plays HLS natively — no library needed.
      const nativeSupport = el.canPlayType('application/vnd.apple.mpegurl') !== '';
      if (nativeSupport) {
        el.src = resolvedSrc;
        return;
      }

      if (!Hls.isSupported()) {
        console.warn('[VideoPlayer] HLS is not supported on this device.');
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        // Start on the lowest rendition, then let ABR climb.
        startLevel: -1,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;
        const levels = hls.levels ?? [];
        setHlsLevels(
          levels.map((l, i) => ({
            index: i,
            label: l.height ? `${l.height}p` : `Level ${i}`,
          })),
        );
        setCurrentLevel(-1);
        // Autoplay muted — browsers block unmuted autoplay.
        el.muted = true;
        setIsMuted(true);
        setIsBuffering(false);
        el.play().then(() => setHasStarted(true)).catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
        if (cancelled) return;
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        // Attempt recovery from fatal errors before giving up.
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            hlsRef.current = null;
            break;
        }
      });

      hls.loadSource(resolvedSrc);
      hls.attachMedia(el);
    })();

    return () => {
      cancelled = true;
      const hls = hlsRef.current;
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSrc, isHls]);

  // ── Video event listeners ─────────────────────────────────────
  useEffect(() => {
    const el = getMedia();
    if (!el) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      onProgress?.(Math.floor(el.currentTime), Math.floor(el.duration || 0));
    };
    const onLoadedMetadata = () => {
      setDuration(el.duration);
      setIsBuffering(false);
      // Restore the saved position, guarding against end-of-video.
      if (initialPosition > 0 && initialPosition < el.duration * 0.95) {
        el.currentTime = initialPosition;
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onDurationChange = () => {
      if (isFinite(el.duration)) setDuration(el.duration);
    };
    const onBufferProgress = () => {
      if (el.buffered.length > 0) {
        setBuffered(el.buffered.end(el.buffered.length - 1));
      }
    };
    const onEnded = () => setIsPlaying(false);

    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('progress', onBufferProgress);
    el.addEventListener('ended', onEnded);

    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('progress', onBufferProgress);
      el.removeEventListener('ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosition, onProgress, isHls, resolvedSrc]);

  // ── Fullscreen change listener ────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Mouse move to show controls ───────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = () => showControlsTemporarily();
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [showControlsTemporarily]);

  // ── Progress percentages ──────────────────────────────────────
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // ── Volume icon ───────────────────────────────────────────────
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // ── Quality list shown in settings ────────────────────────────
  // HLS drives its own level list from the manifest; everything else
  // falls back to the `qualities` prop.
  const qualityMenu: QualityOption[] = isHls
    ? [
        { value: '-1', label: 'Auto' },
        ...hlsLevels.map((l) => ({ value: String(l.index), label: l.label })),
      ]
    : qualityOptions;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black select-none group cursor-none"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* ── Video Element ─────────────────────────────────────── */}
      {needsExternalPlayer ? (
        <iframe
          src={resolvedSrc}
          title={title || 'Video player'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0 bg-black"
        />
      ) : (
        <video
          ref={videoRef}
          // hls.js attaches its own MediaSource, so we must not set src there.
          src={isHls ? undefined : resolvedSrc}
          poster={posterUrl}
          className="w-full h-full object-contain"
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />
      )}

      {/* ── Buffering Spinner ─────────────────────────────────── */}
      {isBuffering && hasStarted && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-14 h-14 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* ── Big Center Play Button (before first play) ────────── */}
      {!hasStarted && !isBuffering && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-20"
        >
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all duration-200 hover:scale-105">
            <Play size={36} className="text-white ml-2" fill="white" />
          </div>
        </button>
      )}

      {/* ── Controls Overlay ──────────────────────────────────── */}
      <div
        className={`absolute inset-0 z-30 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top gradient */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

        {/* ── Top Bar ─────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 md:px-8 py-4">
          {/* Back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
            <span className="text-sm font-medium hidden md:inline">Back</span>
          </button>

          {/* Title */}
          {title && (
            <h1 className="text-white font-semibold text-sm md:text-base truncate max-w-md mx-4">
              {title}
            </h1>
          )}

          {/* Spacer */}
          <div className="w-20" />
        </div>

        {/* ── Center Play/Pause Button ────────────────────────── */}
        {isBuffering ? null : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={togglePlay}
              className="pointer-events-auto w-16 h-16 md:w-18 md:h-18 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all duration-150 hover:scale-105"
            >
              {isPlaying ? (
                <Pause size={30} className="text-white" fill="white" />
              ) : (
                <Play size={30} className="text-white ml-1" fill="white" />
              )}
            </button>
          </div>
        )}

        {/* ── Skip Buttons (visible on mobile) ────────────────── */}
        <div className="absolute inset-0 flex items-center justify-between px-8 md:hidden pointer-events-none">
          <button
            onClick={() => skip(-10)}
            className="pointer-events-auto w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <SkipBack size={20} className="text-white" />
          </button>
          <button
            onClick={() => skip(10)}
            className="pointer-events-auto w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
          >
            <SkipForward size={20} className="text-white" />
          </button>
        </div>

        {/* ── Bottom Controls ─────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-4 md:pb-6">
          {/* Progress Bar */}
          <div
            ref={progressRef}
            className="relative w-full h-6 md:h-8 flex items-center cursor-pointer group/progress mb-1"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Track background */}
            <div className="absolute left-0 right-0 h-1 md:h-1.5 bg-white/20 rounded-full group-hover/progress:h-2 md:group-hover/progress:h-2.5 transition-all duration-150">
              {/* Buffered */}
              <div
                className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
                style={{ width: `${bufferedPct}%` }}
              />
              {/* Progress */}
              <div
                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-[height] duration-150"
                style={{ width: `${progressPct}%` }}
              />
              {/* Scrubber */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 bg-primary rounded-full shadow-lg shadow-primary/40 opacity-0 group-hover/progress:opacity-100 transition-opacity duration-150 pointer-events-none"
                style={{ left: `calc(${progressPct}% - 7px)` }}
              />
            </div>

            {/* Hover time tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute -top-8 -translate-x-1/2 px-2 py-1 bg-surface-container/90 backdrop-blur-sm text-white text-xs rounded font-medium pointer-events-none"
                style={{ left: `${hoverX}px` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between">
            {/* Left controls */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={20} fill="white" />
                ) : (
                  <Play size={20} className="ml-0.5" fill="white" />
                )}
              </button>

              {/* Skip back 10s */}
              <button
                onClick={() => skip(-10)}
                className="hidden md:flex w-9 h-9 md:w-10 md:h-10 rounded-full items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Skip back 10 seconds"
              >
                <SkipBack size={18} />
              </button>

              {/* Skip forward 10s */}
              <button
                onClick={() => skip(10)}
                className="hidden md:flex w-9 h-9 md:w-10 md:h-10 rounded-full items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward size={18} />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <button
                  onClick={toggleMute}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  <VolumeIcon size={20} />
                </button>

                {/* Volume slider */}
                <div
                  ref={volumeRef}
                  className="w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-200 cursor-pointer"
                  onClick={handleVolumeClick}
                >
                  <div className="relative h-1 bg-white/20 rounded-full mx-2">
                    <div
                      className="absolute top-0 left-0 h-full bg-white rounded-full"
                      style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Time display */}
              <div className="text-white/70 text-xs md:text-sm font-mono ml-2 hidden sm:block">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-white/40">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Playback speed */}
              <button
                onClick={cyclePlaybackRate}
                className="hidden md:flex h-8 px-2.5 rounded-md items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-bold"
                aria-label="Playback speed"
              >
                {playbackRate}x
              </button>

              {/* Settings */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings((v) => !v)}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Settings"
                >
                  <Settings size={18} />
                </button>

                {/* Settings dropdown */}
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 glass-panel border border-white/10 rounded-xl py-2 animate-slide-up">
                    {/* Active source */}
                    <div className="px-4 py-2 border-b border-white/10">
                      <p className="text-on-surface-variant text-xs uppercase tracking-wider font-medium flex items-center gap-1.5">
                        <Globe size={10} />
                        Source
                      </p>
                      <p className="text-sm text-white font-medium truncate mt-0.5">
                        {sourceLabel || streamTypeLabel(resolvedType)}
                      </p>
                    </div>

                    {/* Quality */}
                    {qualityMenu.length > 0 && (
                      <div className="px-4 py-2">
                        <p className="text-on-surface-variant text-xs mb-2 uppercase tracking-wider font-medium">
                          Quality
                        </p>
                        <div className="space-y-1">
                          {qualityMenu.map((q, i) => {
                            const isActive = isHls
                              ? currentLevel === Number(q.value)
                              : quality === q.value;
                            return (
                              <button
                                key={q.value}
                                onClick={() => handleQualitySelect(isHls ? Number(q.value) : i)}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                  isActive
                                    ? 'bg-primary/20 text-primary font-medium'
                                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                                }`}
                              >
                                {q.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}