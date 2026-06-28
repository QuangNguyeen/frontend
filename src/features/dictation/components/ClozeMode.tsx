import { useState, useRef, useCallback, useEffect, useMemo, startTransition } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Lightbulb,
} from 'lucide-react';
import { AppSelect } from '@/components/ui/app-select';
import { YoutubePlayer } from './YoutubePlayer';
import type { YoutubePlayerHandle } from './YoutubePlayer';
import { FullClozeView } from './FullClozeView';
import { WordPopover } from './WordPopover';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';
import { vocabularyKeys } from '@/features/vocabulary/hooks/useVocabulary';
import { useQueryClient } from '@tanstack/react-query';
import { useClozeFullData } from '../hooks/useDictation';
import { usePlayerPrefsStore } from '../hooks/usePlayerPrefsStore';
import { cleanForSave } from '../hooks/useWordSave';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ALT_KEY_LABEL } from '@/shared/lib/platform';
import type { ClozeDifficulty, WordPreviewResponse } from '@/shared/types/api';

interface ClozeModeProps {
  video: { title: string; youtube_id: string };
  videoId: string;
  sessionId: string | null;
  difficulty: ClozeDifficulty;
  playerHandle: React.RefObject<YoutubePlayerHandle | null>;
  onCompleted: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_OPTIONS = SPEEDS.map((s) => ({
  value: String(s),
  label: s === 1 ? 'Normal' : `${s}×`,
}));

type PlaybackTarget = {
  play?: () => void | Promise<void>;
  pause?: () => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
};

export function ClozeMode({
  video,
  videoId,
  sessionId,
  difficulty,
  playerHandle,
  onCompleted,
}: ClozeModeProps) {
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<{ word: string; context: string; startTime: number } | null>(null);
  const [previewResult, setPreviewResult] = useState<WordPreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSavingWord, setIsSavingWord] = useState(false);
  const previewRequestId = useRef(0);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);
  const [clozeProgress, setClozeProgress] = useState({ filled: 0, total: 0, activeBlankIdx: -1 });

  const rate = usePlayerPrefsStore((s) => s.rate);
  const setRate = usePlayerPrefsStore((s) => s.setRate);

  // Fetch segments for navigation (React Query deduplicates with FullClozeView)
  const { data: clozeData } = useClozeFullData(sessionId, difficulty);
  const segments = useMemo(() => clozeData?.segments ?? [], [clozeData?.segments]);

  const activeSegmentIdx = useMemo(() => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start_time) return i;
    }
    return -1;
  }, [segments, currentTime]);

  const lastTimeRef = useRef(0);
  const handleTimeUpdate = useCallback((time: number) => {
    // Throttle state updates: only re-render if time jumped > 250ms
    if (Math.abs(time - lastTimeRef.current) < 0.25) return;
    lastTimeRef.current = time;
    startTransition(() => setCurrentTime(time));
  }, []);

  const handlePlayChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleTimeSeek = useCallback((timeSec: number) => {
    if (!playerHandle.current) return;
    playerHandle.current.seekTo(timeSec);
    playerHandle.current.play();
  }, [playerHandle]);

  const handleCompleted = useCallback(() => {
    onCompleted();
  }, [onCompleted]);

  const handleWordClick = useCallback(async (word: string, contextSentence: string, audioStartTime: number, anchorEl?: HTMLElement) => {
    if (savedWords.has(word)) return;
    // Toggle off if same word clicked
    if (previewData?.word === word) {
      setPopoverAnchorEl(null);
      setPreviewData(null);
      setPreviewResult(null);
      return;
    }
    const requestId = ++previewRequestId.current;
    setPopoverAnchorEl(anchorEl ?? null);
    setPreviewData({ word, context: contextSentence, startTime: audioStartTime });
    setPreviewResult(null);
    setIsPreviewLoading(true);
    try {
      const result = await vocabularyService.previewWord(word, contextSentence);
      if (previewRequestId.current !== requestId) return;
      setPreviewResult(result);
    } catch (err) {
      if (previewRequestId.current !== requestId) return;
      console.error('[ClozeMode] Preview fetch failed:', err);
    } finally {
      if (previewRequestId.current === requestId) {
        setIsPreviewLoading(false);
      }
    }
  }, [savedWords, previewData?.word]);

  const handleSaveFromPreview = useCallback(async () => {
    if (!previewData || isSavingWord) return;
    const wasSaved = previewResult?.is_saved ?? false;
    setIsSavingWord(true);
    try {
      await vocabularyService.saveWord({
        word: previewData.word.toLowerCase(),
        video_id: videoId,
        context_sentence: previewData.context,
        audio_start_time: previewData.startTime,
        source: 'cloze',
        audio_url: previewResult?.audio_url ?? undefined,
        phonetic: previewResult?.phonetic ?? undefined,
        meaning: previewResult?.meaning ?? undefined,
        context_translation: previewResult?.context_translation ?? undefined,
        part_of_speech: previewResult?.part_of_speech ?? undefined,
      });
      setSavedWords(prev => {
        const next = new Set(prev);
        next.add(cleanForSave(previewData.word));
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      toast.success(wasSaved ? 'Word updated with new context' : 'Word saved to flashcards');
      setPreviewData(null);
      setPreviewResult(null);
    } catch (err) {
      console.error('[ClozeMode] Word save failed:', err);
      toast.error('Failed to save word');
    } finally {
      setIsSavingWord(false);
    }
  }, [previewData, previewResult, isSavingWord, videoId, queryClient]);

  const handleDismissPreview = useCallback(() => {
    setPopoverAnchorEl(null);
    setPreviewData(null);
    setPreviewResult(null);
  }, []);

  const handlePlayAudio = useCallback(() => {}, []);

  // ── Playback controls ──────────────────────────────────────────────────────

  const pausePlayback = useCallback(() => {
    const player = playerHandle.current as PlaybackTarget | null;
    player?.pause?.();
    player?.pauseVideo?.();
    setIsPlaying(false);
  }, [playerHandle]);

  const resumePlayback = useCallback(() => {
    const player = playerHandle.current as PlaybackTarget | null;
    const playResult = player?.play?.();
    if (playResult && typeof (playResult as Promise<void>).catch === 'function') {
      void (playResult as Promise<void>).catch(() => setIsPlaying(false));
    }
    player?.playVideo?.();
    setIsPlaying(true);
  }, [playerHandle]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
    } else {
      if (activeSegmentIdx >= 0 && segments[activeSegmentIdx]) {
        playerHandle.current?.seekTo(segments[activeSegmentIdx].start_time);
      }
      resumePlayback();
    }
  }, [playerHandle, isPlaying, activeSegmentIdx, segments, pausePlayback, resumePlayback]);

  const handlePrevSegment = useCallback(() => {
    const prevIdx = activeSegmentIdx - 1;
    if (prevIdx >= 0 && segments[prevIdx]) {
      playerHandle.current?.seekTo(segments[prevIdx].start_time);
      playerHandle.current?.play();
      setIsPlaying(true);
    } else if (segments[0]) {
      playerHandle.current?.seekTo(segments[0].start_time);
      playerHandle.current?.play();
      setIsPlaying(true);
    }
  }, [playerHandle, activeSegmentIdx, segments]);

  const handleNextSegment = useCallback(() => {
    const nextIdx = activeSegmentIdx + 1;
    if (nextIdx < segments.length) {
      playerHandle.current?.seekTo(segments[nextIdx].start_time);
      playerHandle.current?.play();
      setIsPlaying(true);
    }
  }, [playerHandle, activeSegmentIdx, segments]);

  const handleSpeedChange = useCallback((speed: string) => {
    const num = Number(speed);
    setRate(num);
    playerHandle.current?.setRate(num);
  }, [playerHandle, setRate]);

  const handleRetry = useCallback(() => {
    pausePlayback();
    playerHandle.current?.seekTo(0);
    setPopoverAnchorEl(null);
    setPreviewData(null);
    setPreviewResult(null);
  }, [playerHandle, pausePlayback]);

  const handleProgressChange = useCallback((info: { filled: number; total: number; activeBlankIdx: number }) => {
    setClozeProgress(info);
  }, []);

  const activeBlankInfo = useMemo(() => {
    if (clozeProgress.activeBlankIdx < 0) return null;
    const idx = clozeProgress.activeBlankIdx;
    for (const seg of segments) {
      for (const tok of seg.tokens) {
        if (tok.is_blank && tok.blank_index === idx) {
          const ctx = seg.tokens.map(t =>
            t.is_blank ? '___' : t.text
          ).join('');
          return {
            number: idx + 1,
            expectedLen: tok.text.length,
            context: ctx.length > 60 ? ctx.slice(0, 60) + '…' : ctx,
          };
        }
      }
    }
    return null;
  }, [segments, clozeProgress.activeBlankIdx]);

  useEffect(() => {
    if (!sessionId || !playerHandle.current) return;
    const t = setTimeout(() => {
      playerHandle.current?.seekTo(0);
      playerHandle.current?.play();
    }, 500);
    return () => clearTimeout(t);
  }, [sessionId, playerHandle]);

  // ── Global Alt+key shortcuts (fire even while typing the blanks) ─────────────
  // Alt+Space play/pause · Alt+R replay segment · Alt+←/→ prev/next segment.
  // `e.code` is layout-independent so Alt combos work on macOS too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'KeyR':
          e.preventDefault();
          if (activeSegmentIdx >= 0 && segments[activeSegmentIdx]) {
            playerHandle.current?.seekTo(segments[activeSegmentIdx].start_time);
          }
          resumePlayback();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevSegment();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextSegment();
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handlePlayPause, handlePrevSegment, handleNextSegment, resumePlayback, activeSegmentIdx, segments, playerHandle]);

  const difficultyLabel = difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Medium';

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 min-h-14 border-b border-border bg-card/80 backdrop-blur px-3 py-2 flex items-center gap-2.5">
        <Link
          to="/library"
          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground">
              Cloze
            </p>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {difficultyLabel}
            </span>
          </div>
          <h1 className="text-sm font-semibold tracking-tight truncate">
            {video.title}
          </h1>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden p-3 lg:p-5">
        <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-none xl:gap-6">
          {/* Left practice sidebar */}
          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-card shadow-soft lg:sticky lg:top-5 lg:max-h-[calc(100dvh-96px)]">
          <div className="p-3 lg:p-4">
            {/* Player + mobile inline controls */}
            <div className="flex items-center gap-3 lg:block">
              <div className="rounded-[14px] overflow-hidden border border-border shadow-soft w-28 lg:w-full aspect-video shrink-0">
                <YoutubePlayer
                  ref={playerHandle}
                  videoId={video.youtube_id}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayChange={handlePlayChange}
                />
              </div>
              {/* Mobile controls */}
              <div className="flex items-center gap-1 lg:hidden flex-1">
                <button
                  type="button"
                  onClick={handlePrevSegment}
                  disabled={activeSegmentIdx <= 0}
                  title="Previous segment"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95 disabled:opacity-40"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePlayPause}
                  title={isPlaying ? 'Pause' : 'Play'}
                  className={cn(
                    'inline-flex items-center justify-center h-10 w-10 rounded-full transition-all active:scale-95 shadow-sm',
                    isPlaying
                      ? 'bg-muted text-foreground hover:bg-muted/70'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleNextSegment}
                  disabled={activeSegmentIdx >= segments.length - 1}
                  title="Next segment"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95 disabled:opacity-40"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <AppSelect
                  value={String(rate)}
                  onValueChange={handleSpeedChange}
                  options={SPEED_OPTIONS}
                  size="sm"
                  triggerClassName="h-8 px-2 rounded-full text-xs ml-1"
                />
                <span className="ml-auto text-sm tabular-nums text-muted-foreground font-medium">
                  {clozeProgress.filled}/{clozeProgress.total}
                </span>
              </div>
            </div>

            {/* Desktop-only content */}
            <div className="hidden lg:block mt-4 space-y-3">
              {/* Playback controls */}
              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevSegment}
                  disabled={activeSegmentIdx <= 0}
                  title="Previous segment"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePlayPause}
                  title={isPlaying ? 'Pause' : 'Play'}
                  className={cn(
                    'inline-flex items-center justify-center h-11 w-11 rounded-full transition-all active:scale-95 shadow-sm',
                    isPlaying
                      ? 'bg-muted text-foreground hover:bg-muted/70'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleNextSegment}
                  disabled={activeSegmentIdx >= segments.length - 1}
                  title="Next segment"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-center">
                <AppSelect
                  value={String(rate)}
                  onValueChange={handleSpeedChange}
                  options={SPEED_OPTIONS}
                  size="sm"
                  triggerClassName="h-8 px-3 rounded-full text-xs"
                />
              </div>

              {/* Segment indicator */}
              {segments.length > 0 && activeSegmentIdx >= 0 && (
                <p className="text-center text-sm text-muted-foreground tabular-nums">
                  Segment {activeSegmentIdx + 1} / {segments.length}
                </p>
              )}

              {/* Progress card */}
              <div className="rounded-xl border border-border bg-muted/25 p-3 space-y-2 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Progress
                  </span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {clozeProgress.filled}/{clozeProgress.total}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${clozeProgress.total ? (clozeProgress.filled / clozeProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Current blank info card */}
              {activeBlankInfo && (
              <div className="rounded-xl border border-border bg-muted/25 p-3 space-y-2 shadow-soft">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Current Blank
                  </span>
                  <p className="text-base text-foreground font-bold">Blank {activeBlankInfo.number}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground italic line-clamp-3">
                    &ldquo;{activeBlankInfo.context}&rdquo;
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {activeBlankInfo.expectedLen} letters
                  </p>
                </div>
              )}
              <div className="mx-4 mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
                Click any word to save to flashcards
              </div>
              <div className="mx-4 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                {[
                  [`${ALT_KEY_LABEL} + Space`, 'Play / Pause'],
                  [`${ALT_KEY_LABEL} + R`, 'Replay'],
                  [`${ALT_KEY_LABEL} + ← / →`, 'Prev / Next'],
                ].map(([combo, label]) => (
                  <span key={combo} className="inline-flex items-center gap-1">
                    <kbd className="inline-flex h-5 items-center rounded-[6px] border border-border bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
                      {combo}
                    </kbd>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          </aside>

        {/* Right — cloze transcript */}
        <section className="min-w-0 min-h-0 overflow-hidden">
          <div className="w-full min-h-0 h-full">
          <FullClozeView
            sessionId={sessionId}
            videoId={videoId}
            difficulty={difficulty}
            currentTime={currentTime}
            onTimeSeek={handleTimeSeek}
            onCompleted={handleCompleted}
            savedWords={savedWords}
            previewingWord={previewData?.word ?? null}
            onWordClick={handleWordClick}
            onRetry={handleRetry}
            onProgressChange={handleProgressChange}
            pausePlayback={pausePlayback}
            resumePlayback={resumePlayback}
          />
          </div>
        </section>
        </div>
      </div>

      {/* Floating word popover */}
      <WordPopover
        anchorEl={popoverAnchorEl}
        word={previewData?.word ?? ''}
        preview={previewResult}
        isLoading={isPreviewLoading}
        isSaved={previewResult?.is_saved ?? false}
        isSaving={isSavingWord}
        onSave={handleSaveFromPreview}
        onPlayAudio={handlePlayAudio}
        onDismiss={handleDismissPreview}
      />
    </div>
  );
}
