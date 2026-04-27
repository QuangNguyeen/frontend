/**
 * YoutubePlayer v2 — YouTube-like player with Audio-Only mode.
 *
 * The iframe is NEVER removed from the DOM — audio-only mode hides it with
 * CSS (opacity) so playback continues uninterrupted.
 *
 * Imperative API (via ref):
 *   playerHandle.current.play()
 *   playerHandle.current.pause()
 *   playerHandle.current.seekTo(seconds)
 *   playerHandle.current.setRate(rate)
 *
 * Keyboard shortcuts (skipped when a text input is focused):
 *   Space / K  →  Play / Pause
 *   ← / →      →  Seek ±5 s
 *   ↑ / ↓      →  Volume ±10 %
 *   M          →  Mute toggle
 *   F          →  Fullscreen toggle
 *   A          →  Audio-only toggle
 */

import {
  forwardRef, useImperativeHandle, useRef,
  useState, useEffect, useCallback,
} from 'react';
import ReactPlayer from 'react-player';
import type { SyntheticEvent } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize, Minimize,
  Loader2, Headphones, Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayerPrefsStore } from '../hooks/usePlayerPrefsStore';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface YoutubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setRate: (rate: number) => void;
  getCurrentTime: () => number;
}

interface YoutubePlayerProps {
  videoId: string;
  endTime?: number | null;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayChange?: (playing: boolean) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const HIDE_AFTER = 3000; // ms of inactivity before controls hide

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Animated waveform bars shown in audio-only mode while playing */
function Waveform({ active }: { active: boolean }) {
  const heights = [40, 75, 55, 90, 45, 70, 50, 80, 40];
  return (
    <>
      {/* keyframes injected once */}
      <style>{`
        @keyframes yt-wave {
          0%, 100% { transform: scaleY(0.35); }
          50%       { transform: scaleY(1);    }
        }
      `}</style>
      <div className="flex items-end justify-center gap-[3px] h-10">
        {heights.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-white/80"
            style={{
              height: `${h}%`,
              transformOrigin: 'bottom',
              animation: active
                ? `yt-wave ${0.55 + (i % 4) * 0.12}s ease-in-out ${i * 0.07}s infinite`
                : 'none',
              transform: active ? undefined : 'scaleY(0.25)',
              transition: 'transform 0.3s ease',
            }}
          />
        ))}
      </div>
    </>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export const YoutubePlayer = forwardRef<YoutubePlayerHandle, YoutubePlayerProps>(
  ({ videoId, endTime, onTimeUpdate, onPlayChange, className }, ref) => {
    const innerRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Refs for stable keyboard-shortcut closure
    const currentTimeRef = useRef(0);
    const durationRef = useRef(0);

    // ── Persisted preferences (Zustand) ──────────────────────────────────────
    const volume = usePlayerPrefsStore((s) => s.volume);
    const setVolume = usePlayerPrefsStore((s) => s.setVolume);
    const muted = usePlayerPrefsStore((s) => s.muted);
    const setMuted = usePlayerPrefsStore((s) => s.setMuted);
    const toggleMuted = usePlayerPrefsStore((s) => s.toggleMuted);
    const rate = usePlayerPrefsStore((s) => s.rate);
    const setRateState = usePlayerPrefsStore((s) => s.setRate);
    const audioOnly = usePlayerPrefsStore((s) => s.audioOnly);
    const toggleAudioOnly = usePlayerPrefsStore((s) => s.toggleAudioOnly);

    // ── Ephemeral player state (local) ────────────────────────────────────────
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffering, setBuffering] = useState(false);

    // ── Ephemeral UI state (local) ────────────────────────────────────────────
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showVolSlider, setShowVolSlider] = useState(false);
    const [hoverPct, setHoverPct] = useState<number | null>(null);
    const [thumbFailed, setThumbFailed] = useState(false);

    // ── Derived ───────────────────────────────────────────────────────────────
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const effectiveVolume = muted ? 0 : volume;
    const controlsVisible = showControls || !playing || showSpeedMenu || showVolSlider || audioOnly;
    const thumbUrl = thumbFailed
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // Keep refs in sync for keyboard handler
    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
    useEffect(() => { durationRef.current = duration; }, [duration]);

    // ── Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      play() { setPlaying(true); },
      pause() { setPlaying(false); },
      seekTo(s: number) {
        if (innerRef.current) innerRef.current.currentTime = s;
        setCurrentTime(s);
      },
      setRate(r: number) {
        setRateState(r);
        if (innerRef.current) innerRef.current.playbackRate = r;
      },
      getCurrentTime() { return currentTimeRef.current; },
    }));

    // ── Sync playback rate ────────────────────────────────────────────────────
    useEffect(() => {
      if (innerRef.current) innerRef.current.playbackRate = rate;
    }, [rate, playing]);

    // ── Sentence-boundary time guard ─────────────────────────────────────────
    // YouTube iframe doesn't fire native timeupdate events reliably.
    // Poll at 100ms to emit onTimeUpdate and auto-pause at endTime boundary.
    useEffect(() => {
      if (!playing) return;
      const id = setInterval(() => {
        const el = innerRef.current;
        if (!el) return;
        const t = typeof el.currentTime === 'number' ? el.currentTime : 0;
        setCurrentTime(t);
        currentTimeRef.current = t;
        onTimeUpdate?.(t);
        if (endTime != null && t >= endTime) {
          setPlaying(false);
          onPlayChange?.(false);
          clearInterval(id);
        }
      }, 100);
      return () => clearInterval(id);
    }, [playing, endTime, onTimeUpdate, onPlayChange]);

    // ── Fullscreen detection ──────────────────────────────────────────────────
    useEffect(() => {
      const h = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', h);
      return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    // ── Auto-hide controls ────────────────────────────────────────────────────
    const resetHideTimer = useCallback(() => {
      clearTimeout(hideTimerRef.current);
      setShowControls(true);
      // In audio-only mode controls always stay visible
      if (playing && !audioOnly) {
        hideTimerRef.current = setTimeout(() => setShowControls(false), HIDE_AFTER);
      }
    }, [playing, audioOnly]);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
      if (!playing || audioOnly) {
        clearTimeout(hideTimerRef.current);
        setShowControls(true);
      } else {
        hideTimerRef.current = setTimeout(() => setShowControls(false), HIDE_AFTER);
      }
      return () => clearTimeout(hideTimerRef.current);
    }, [playing, audioOnly]);
    /* eslint-enable react-hooks/set-state-in-effect */

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    const toggleFullscreen = useCallback(async () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen().catch(() => { });
      } else {
        await document.exitFullscreen().catch(() => { });
      }
    }, []);

    const seekAbsolute = useCallback((t: number) => {
      if (!innerRef.current) return;
      const clamped = Math.max(0, Math.min(durationRef.current, t));
      innerRef.current.currentTime = clamped;
      setCurrentTime(clamped);
    }, []);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        switch (e.key) {
          case ' ':
          case 'k':
          case 'K':
            e.preventDefault();
            setPlaying((p) => { onPlayChange?.(!p); return !p; });
            break;
          case 'ArrowLeft':
            e.preventDefault();
            seekAbsolute(currentTimeRef.current - 5);
            break;
          case 'ArrowRight':
            e.preventDefault();
            seekAbsolute(currentTimeRef.current + 5);
            break;
          case 'ArrowUp':
            e.preventDefault();
            // Read latest volume directly from store — avoids stale closure
            setVolume(parseFloat(Math.min(1, usePlayerPrefsStore.getState().volume + 0.1).toFixed(2)));
            setMuted(false);
            break;
          case 'ArrowDown':
            e.preventDefault();
            setVolume(parseFloat(Math.max(0, usePlayerPrefsStore.getState().volume - 0.1).toFixed(2)));
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            toggleMuted();
            break;
          case 'f':
          case 'F':
            e.preventDefault();
            toggleFullscreen();
            break;
          case 'a':
          case 'A':
            e.preventDefault();
            toggleAudioOnly();
            break;
        }
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
      // Zustand actions (toggleMuted, toggleAudioOnly, setMuted, setVolume) are stable references
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onPlayChange, seekAbsolute, toggleFullscreen]);

    // ── Event handlers ────────────────────────────────────────────────────────

    const togglePlay = useCallback(() => {
      setPlaying((p) => { onPlayChange?.(!p); return !p; });
    }, [onPlayChange]);

    const handleTimeUpdate = useCallback(
      (e: SyntheticEvent<HTMLVideoElement>) => {
        const t = e.currentTarget.currentTime;
        setCurrentTime(t);
        onTimeUpdate?.(t);
      },
      [onTimeUpdate],
    );

    const seekRelative = useCallback(
      (delta: number) => {
        seekAbsolute(currentTimeRef.current + delta);
        resetHideTimer();
      },
      [seekAbsolute, resetHideTimer],
    );

    const seekToRatio = useCallback(
      (ratio: number) => {
        seekAbsolute(ratio * durationRef.current);
      },
      [seekAbsolute],
    );

    const handleProgressClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current) return;
        const r = progressBarRef.current.getBoundingClientRect();
        seekToRatio(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      },
      [seekToRatio],
    );

    const handleProgressMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current) return;
        const r = progressBarRef.current.getBoundingClientRect();
        setHoverPct(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100);
      },
      [],
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative aspect-video bg-black rounded-2xl overflow-hidden select-none outline-none',
          className,
        )}
        onMouseMove={resetHideTimer}
        onMouseLeave={() => playing && !audioOnly && setShowControls(false)}
      >
        {/* ── YouTube iframe (always mounted — never removed from DOM) ──────────
            In audio-only mode we hide it with opacity so the audio track keeps
            playing. pointer-events-none on the iframe lets our overlay intercept
            all mouse events.                                                   */}
        <div
          className={cn(
            'absolute inset-0 [&_iframe]:pointer-events-none transition-opacity duration-500',
            audioOnly ? 'opacity-0' : 'opacity-100',
          )}
        >
          <ReactPlayer
            ref={innerRef}
            src={`https://www.youtube.com/watch?v=${videoId}`}
            playing={playing}
            controls={false}
            volume={effectiveVolume}
            playbackRate={rate}
            width="100%"
            height="100%"
            config={{
              youtube: {
                rel: 0,
                iv_load_policy: 3,
                disablekb: 1,
                cc_load_policy: 0,
              },
            }}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onReady={() => {
              try {
                // Disable captions via the YouTube Player API after load
                const proxy = innerRef.current as unknown as { getInternalPlayer?: () => { unloadModule?: (m: string) => void } };
                const yt = proxy?.getInternalPlayer?.();
                yt?.unloadModule?.('captions');
                yt?.unloadModule?.('cc');
              } catch { /* ignore */ }
            }}
            onPlay={() => { setPlaying(true); setBuffering(false); onPlayChange?.(true); }}
            onPause={() => { setPlaying(false); onPlayChange?.(false); }}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onEnded={() => { setPlaying(false); onPlayChange?.(false); }}
          />
        </div>

        {/* ── Audio-only overlay ────────────────────────────────────────────────
            Fades in when audioOnly is true. The iframe underneath keeps audio
            playing — this is purely cosmetic.                                  */}
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-500 pointer-events-none',
            audioOnly ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* Blurred thumbnail background */}
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={thumbUrl}
              onError={() => setThumbFailed(true)}
              className="w-full h-full object-cover scale-110 blur-2xl brightness-40"
              alt=""
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>

          {/* Center: thumbnail card + waveform */}
          <div className="absolute inset-0 flex items-center justify-center gap-6">
            <div className="relative shrink-0">
              <img
                src={thumbUrl}
                onError={() => setThumbFailed(true)}
                className="w-48 h-[108px] sm:w-64 sm:h-[144px] object-cover rounded-xl shadow-2xl border border-white/10"
                alt="Video thumbnail"
              />
              {/* Play indicator overlay on thumbnail */}
              {!playing && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                  <Play className="h-6 w-6 text-white fill-white" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-white/70 shrink-0" />
                <span className="text-white/70 text-xs font-medium tracking-wide uppercase">Audio Only</span>
              </div>
              <Waveform active={playing} />
              <span className="text-white/50 text-xs tabular-nums">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* ── Click-capture layer ───────────────────────────────────────────────
            z-10: above the iframe / audio overlay, below controls (z-30).
            Single click = play/pause. Double click = fullscreen.              */}
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />

        {/* ── Buffering spinner ─────────────────────────────────────────────── */}
        {buffering && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <Loader2 className="h-12 w-12 text-white/70 animate-spin drop-shadow-lg" />
          </div>
        )}

        {/* ── Centre play indicator (video mode only) ───────────────────────── */}
        {!audioOnly && !buffering && !playing && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="h-20 w-20 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm shadow-2xl">
              <Play className="h-9 w-9 text-white fill-white ml-1" />
            </div>
          </div>
        )}

        {/* ── Controls overlay ──────────────────────────────────────────────── */}
        <div
          className={cn(
            'absolute inset-0 z-30 flex flex-col justify-end transition-opacity duration-300',
            controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Bottom gradient */}
          <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

          <div className="relative z-10 px-4 pb-3 pt-2 flex flex-col gap-2">

            {/* ── Progress bar ─────────────────────────────────────────────── */}
            <div
              ref={progressBarRef}
              className="group/bar relative h-1 hover:h-3 transition-[height] duration-150 rounded-full bg-white/25 cursor-pointer"
              onClick={handleProgressClick}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={() => setHoverPct(null)}
            >
              <div
                className="absolute inset-y-0 left-0 bg-red-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-red-500 rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity"
                style={{ left: `${progress}%` }}
              />
              {hoverPct !== null && duration > 0 && (
                <div
                  className="absolute bottom-5 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap pointer-events-none shadow"
                  style={{ left: `${hoverPct}%` }}
                >
                  {fmtTime((hoverPct / 100) * duration)}
                </div>
              )}
            </div>

            {/* ── Button row ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 text-white">

              {/* Rewind 5 s */}
              <button
                onClick={() => seekRelative(-5)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                title="Rewind 5s  (←)"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                title={playing ? 'Pause  (Space / K)' : 'Play  (Space / K)'}
              >
                {playing
                  ? <Pause className="h-5 w-5 fill-white" />
                  : <Play className="h-5 w-5 fill-white" />}
              </button>

              {/* Forward 5 s */}
              <button
                onClick={() => seekRelative(5)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                title="Forward 5s  (→)"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              {/* Volume */}
              <div
                className="flex items-center gap-1.5"
                onMouseEnter={() => setShowVolSlider(true)}
                onMouseLeave={() => setShowVolSlider(false)}
              >
                <button
                  onClick={toggleMuted}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                  title={muted ? 'Unmute  (M)' : 'Mute  (M)'}
                >
                  {muted || volume === 0
                    ? <VolumeX className="h-4 w-4" />
                    : <Volume2 className="h-4 w-4" />}
                </button>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-200',
                    showVolSlider ? 'w-20 opacity-100' : 'w-0 opacity-0',
                  )}
                >
                  <input
                    type="range"
                    min={0} max={1} step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
                    className="w-20 accent-white cursor-pointer"
                    style={{ height: '3px' }}
                    title="Volume  (↑ / ↓)"
                  />
                </div>
              </div>

              {/* Time */}
              <span className="text-xs tabular-nums text-white/90 ml-1 whitespace-nowrap">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>

              <div className="flex-1" />

              {/* Audio-only toggle */}
              <button
                onClick={toggleAudioOnly}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold border transition-colors',
                  audioOnly
                    ? 'bg-white/20 border-white/40 text-white hover:bg-white/30'
                    : 'border-white/25 text-white/80 hover:bg-white/15',
                )}
                title={audioOnly ? 'Switch to Video  (A)' : 'Audio Only  (A)'}
              >
                {audioOnly
                  ? <><Video className="h-3.5 w-3.5" /> Video</>
                  : <><Headphones className="h-3.5 w-3.5" /> Audio</>}
              </button>

              {/* Playback speed */}
              <div className="relative">
                <button
                  onClick={() => { setShowSpeedMenu((s) => !s); setShowVolSlider(false); }}
                  className="px-2 py-1 text-xs font-semibold rounded-md border border-white/25 hover:bg-white/15 transition-colors whitespace-nowrap"
                  aria-haspopup="menu"
                  aria-expanded={showSpeedMenu}
                  title="Playback speed"
                >
                  {rate === 1 ? 'Normal' : `${rate}×`}
                </button>

                {showSpeedMenu && (
                  <div
                    className="absolute bottom-full right-0 mb-2 bg-zinc-900/95 backdrop-blur-md rounded-xl py-1.5 min-w-[130px] shadow-2xl border border-white/10"
                    role="menu"
                  >
                    <p className="text-white/40 text-[10px] px-3 pb-1 font-semibold uppercase tracking-widest">Speed</p>
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        role="menuitem"
                        onClick={() => { setRateState(s); setShowSpeedMenu(false); }}
                        className={cn(
                          'flex items-center justify-between w-full px-3 py-1.5 text-sm transition-colors hover:bg-white/10',
                          rate === s ? 'text-white font-semibold' : 'text-white/70',
                        )}
                      >
                        <span>{s === 1 ? 'Normal' : `${s}×`}</span>
                        {rate === s && <span className="text-blue-400 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                title={isFullscreen ? 'Exit fullscreen  (F)' : 'Fullscreen  (F)'}
              >
                {isFullscreen
                  ? <Minimize className="h-4 w-4" />
                  : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

YoutubePlayer.displayName = 'YoutubePlayer';