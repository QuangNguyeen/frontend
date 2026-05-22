import { useState, useRef, useCallback, useEffect, useMemo, startTransition } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Square, RotateCcw, SkipForward, ChevronDown,
} from 'lucide-react';
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
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const rate = usePlayerPrefsStore((s) => s.rate);
  const setRate = usePlayerPrefsStore((s) => s.setRate);

  // Fetch segments for navigation (React Query deduplicates with FullClozeView)
  const { data: clozeData } = useClozeFullData(sessionId, difficulty);
  const segments = clozeData?.segments ?? [];

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

  const handleStop = useCallback(() => {
    playerHandle.current?.pause();
    setIsPlaying(false);
    if (activeSegmentIdx >= 0 && segments[activeSegmentIdx]) {
      playerHandle.current?.seekTo(segments[activeSegmentIdx].start_time);
    } else {
      playerHandle.current?.seekTo(0);
    }
  }, [playerHandle, activeSegmentIdx, segments]);

  const handleReplay = useCallback(() => {
    if (activeSegmentIdx >= 0 && segments[activeSegmentIdx]) {
      playerHandle.current?.seekTo(segments[activeSegmentIdx].start_time);
      playerHandle.current?.play();
      setIsPlaying(true);
    } else {
      playerHandle.current?.seekTo(0);
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

  const handleSpeedChange = useCallback((speed: number) => {
    setRate(speed);
    playerHandle.current?.setRate(speed);
    setShowSpeedMenu(false);
  }, [playerHandle, setRate]);

  const handleRetry = useCallback(() => {
    playerHandle.current?.pause();
    playerHandle.current?.seekTo(0);
    setPopoverAnchorEl(null);
    setPreviewData(null);
    setPreviewResult(null);
  }, [playerHandle]);

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return;
    const handler = () => setShowSpeedMenu(false);
    const t = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', handler); };
  }, [showSpeedMenu]);

  useEffect(() => {
    if (!sessionId || !playerHandle.current) return;
    const t = setTimeout(() => {
      playerHandle.current?.seekTo(0);
      playerHandle.current?.play();
    }, 500);
    return () => clearTimeout(t);
  }, [sessionId, playerHandle]);

  const difficultyLabel = difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Medium';

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Link
          to="/library"
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
              Cloze
            </p>
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {difficultyLabel}
            </span>
          </div>
          <h1 className="text-sm font-semibold tracking-tight truncate">
            {video.title}
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 py-4 max-w-[1400px] mx-auto">
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            <div className="lg:col-span-4 lg:sticky lg:top-4 self-start space-y-3">
              <div className="rounded-xl overflow-hidden border border-border shadow-soft bg-card">
                <YoutubePlayer
                  ref={playerHandle}
                  videoId={video.youtube_id}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayChange={handlePlayChange}
                />
              </div>

              {/* ── Playback Controls ── */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {/* Stop */}
                <button
                  onClick={handleStop}
                  title="Stop"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span className="hidden sm:inline">Stop</span>
                </button>

                {/* Replay */}
                <button
                  onClick={handleReplay}
                  title="Replay current segment"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Replay</span>
                </button>

                {/* Next */}
                <button
                  onClick={handleNextSegment}
                  disabled={activeSegmentIdx >= segments.length - 1}
                  title="Next segment"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Next</span>
                </button>

                {/* Speed */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu((s) => !s)}
                    title="Playback speed"
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95"
                  >
                    {rate === 1 ? '1x' : `${rate}x`}
                    <ChevronDown className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      showSpeedMenu && 'rotate-180',
                    )} />
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[100px] z-50">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSpeedChange(s)}
                          className={cn(
                            'flex items-center justify-between w-full px-3 py-1.5 text-sm transition-colors hover:bg-muted',
                            rate === s ? 'font-semibold text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {s === 1 ? 'Normal' : `${s}×`}
                          {rate === s && <span className="text-primary text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Segment indicator */}
              {segments.length > 0 && activeSegmentIdx >= 0 && (
                <p className="text-center text-xs text-muted-foreground tabular-nums">
                  Segment {activeSegmentIdx + 1} / {segments.length}
                </p>
              )}
            </div>

            <div className="lg:col-span-8 min-w-0 flex flex-col min-h-0">
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
              />
            </div>
          </div>
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