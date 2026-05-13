import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, RotateCcw, Play, Pause,
  ChevronLeft, ChevronRight, ChevronDown, Trophy,
  Loader2, AlertCircle, CheckCircle2, XCircle,
  MinusCircle, Clock, Languages,
} from 'lucide-react';
import { YoutubePlayer } from './YoutubePlayer';
import type { YoutubePlayerHandle } from './YoutubePlayer';
import { usePlayerPrefsStore } from '../hooks/usePlayerPrefsStore';
import { useDictationSession, useSubmitAnswer, useCompleteSession } from '../hooks/useDictation';
import { useVideo, useVideoTranscripts } from '@/features/library/hooks/useVideos';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  PracticeMode, SentenceResultResponse, TranscriptResponse, WordDiffItem,
} from '@/shared/types/api';
import { WordSavePanel } from './WordSavePanel';
import { WordPopover } from './WordPopover';
import { DottedHintBar } from './DottedHintBar';
import { ClozeMode } from './ClozeMode';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';
import { vocabularyKeys } from '@/features/vocabulary/hooks/useVocabulary';
import { useQueryClient } from '@tanstack/react-query';
import { cleanForSave } from '../hooks/useWordSave';
import { toast } from 'sonner';
import type { ClozeDifficulty, WordPreviewResponse } from '@/shared/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'playing' | 'practicing' | 'completed';

interface LocalResult {
  sentenceIndex: number;
  score: number;
  userInput: string;
  correctText: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function findSegmentByTime(segs: TranscriptResponse[], time: number): number {
  let lo = 0, hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (time < segs[mid].start_time) hi = mid - 1;
    else if (time >= segs[mid].end_time) lo = mid + 1;
    else return mid;
  }
  return -1;
}

function computeErrorCaretOffset(userText: string, diffs: WordDiffItem[]): number {
  if (diffs.every((d) => d.status === 'correct')) return userText.length;

  let lastNonMissingIdx = -1;
  for (let i = diffs.length - 1; i >= 0; i--) {
    if (diffs[i].status !== 'missing') {
      lastNonMissingIdx = i;
      break;
    }
  }
  if (lastNonMissingIdx >= 0) {
    const allTypedCorrect = diffs
      .slice(0, lastNonMissingIdx + 1)
      .every((d) => d.status === 'correct');
    if (allTypedCorrect) return userText.length;
  }

  let firstErrIdx = diffs.findIndex(
    (d) => d.status === 'wrong' || d.status === 'extra',
  );
  if (firstErrIdx === -1) {
    firstErrIdx = diffs.findIndex((d) => d.status === 'missing');
  }
  if (firstErrIdx === -1) return userText.length;

  let userWordsConsumed = 0;
  for (let i = 0; i <= firstErrIdx; i++) {
    const s = diffs[i].status;
    if (s === 'correct' || s === 'wrong' || s === 'extra') {
      userWordsConsumed++;
    }
  }
  if (userWordsConsumed === 0) return 0;

  const re = /\S+/g;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = re.exec(userText)) !== null) {
    count++;
    if (count === userWordsConsumed) {
      return match.index + match[0].length;
    }
  }
  return userText.length;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DictationPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const playerHandle = useRef<YoutubePlayerHandle>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const segmentListRef = useRef<HTMLDivElement>(null);
  const liveSegmentIdxRef = useRef(-1);
  const [liveSegmentIdx, setLiveSegmentIdx] = useState(-1);

  const autoPlayRef = useRef(false);
  const handleNextRef = useRef<() => void>(() => { });

  // ── Persisted user preferences ─────────────────────────────────────────────
  const autoNext = usePlayerPrefsStore((s) => s.autoNext);
  const toggleAutoNext = usePlayerPrefsStore((s) => s.toggleAutoNext);
  const autoNextRef = useRef(autoNext);
  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);

  // ── API state ──────────────────────────────────────────────────────────────
  const modeParam = searchParams.get('mode') as PracticeMode | null;
  const [practiceMode, setPracticeMode] = useState<PracticeMode | null>(modeParam || 'sentence');
  const [clozeDifficulty, setClozeDifficulty] = useState<ClozeDifficulty>(
    (searchParams.get('difficulty') as ClozeDifficulty) || 'medium',
  );
  const { sessionId, sessionData } = useDictationSession(videoId, practiceMode);
  const [currentIndex, setCurrentIndex] = useState(0);
  const resumeAppliedRef = useRef(false);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [serverResults, setServerResults] = useState<Map<number, SentenceResultResponse>>(new Map());

  // ── Practice state ─────────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [playCount, setPlayCount] = useState(0);

  // ── Word popover state ─────────────────────────────────────────────────────
  const sentenceQueryClient = useQueryClient();
  const [sentenceSavedWords, setSentenceSavedWords] = useState<Set<string>>(new Set());
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverWord, setPopoverWord] = useState<string | null>(null);
  const [popoverContext, setPopoverContext] = useState<{ context: string; startTime: number } | null>(null);
  const [popoverPreview, setPopoverPreview] = useState<WordPreviewResponse | null>(null);
  const [isPopoverLoading, setIsPopoverLoading] = useState(false);
  const [isPopoverSaving, setIsPopoverSaving] = useState(false);
  const popoverRequestId = useRef(0);

  // ── Dotted hint state ─────────────────────────────────────────────────────
  const [revealedHintIndices, setRevealedHintIndices] = useState<Set<number>>(new Set());
  const [allHintsRevealed, setAllHintsRevealed] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: video, isLoading: videoLoading, isError: videoError } = useVideo(videoId);
  const { data: sentences = [], isLoading: sentencesLoading, transcriptionStatus } = useVideoTranscripts(videoId);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (
      !sessionData?.resumed ||
      resumeAppliedRef.current ||
      sentences.length === 0
    ) return;
    const idx = sessionData.current_sentence_index ?? 0;
    if (idx > 0 && idx < sentences.length) {
      resumeAppliedRef.current = true;
      setCurrentIndex(idx);
    }
  }, [sessionData, sentences]);

  useEffect(() => {
    if (
      !sessionData?.resumed ||
      !sessionData.sentence_results?.length ||
      results.length > 0
    ) return;

    setResults(
      sessionData.sentence_results.map((sr) => ({
        sentenceIndex: sr.sentence_index,
        score: Math.round(sr.score * 100),
        userInput: '',
        correctText: '',
      })),
    );

    const serverMap = new Map<number, SentenceResultResponse>();
    for (const sr of sessionData.sentence_results) {
      const diffs = sr.word_diff ?? [];
      serverMap.set(sr.sentence_index, {
        sentence_index: sr.sentence_index,
        score: sr.score,
        word_diffs: diffs,
        correct_count: diffs.filter((d) => d.status === 'correct').length,
        wrong_count: diffs.filter((d) => d.status === 'wrong').length,
        missing_count: diffs.filter((d) => d.status === 'missing').length,
        original_text: '',
        video_id: videoId ?? '',
        audio_start_time: 0,
        word_difficulty: {},
      });
    }
    setServerResults(serverMap);
  }, [sessionData, videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sentence = sentences[currentIndex];
    if (!sentence) return;
    const alreadyDone = results.find((r) => r.sentenceIndex === currentIndex);
    setInputValue('');
    setPhase(alreadyDone ? 'completed' : 'practicing');
    setPlayCount(0);
    setHintsUsed(0);
    setShowTranslation(false);
    setIsVerifying(false);
    setPopoverAnchorEl(null);
    setPopoverWord(null);
    setPopoverPreview(null);
    setRevealedHintIndices(new Set());
    setAllHintsRevealed(false);
  }, [currentIndex, sentences]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoPlayRef.current) return;
    const sentence = sentences[currentIndex];
    if (!sentence || !playerHandle.current) return;
    const t = setTimeout(() => {
      if (!playerHandle.current) return;
      playerHandle.current.seekTo(sentence.start_time);
      playerHandle.current.play();
      setIsVideoPlaying(true);
      setPhase('playing');
      setPlayCount(1);
    }, 100);
    return () => clearTimeout(t);
  }, [currentIndex, sentences]);

  useEffect(() => {
    if (phase !== 'completed') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase, currentIndex]);

  useEffect(() => {
    segmentListRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentSentence = sentences[currentIndex];
  const totalSentences = sentences.length;
  const sentenceProgress = totalSentences > 0 ? (currentIndex / totalSentences) * 100 : 0;
  const isLastSentence = currentIndex === totalSentences - 1;
  const latestResult = results.find((r) => r.sentenceIndex === currentIndex);
  const latestDiffCheck = serverResults.get(currentIndex) ?? null;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const submitMutation = useSubmitAnswer(sessionId);
  const completeMutation = useCompleteSession(sessionId);

  // ── Sentence verification ─────────────────────────────────────────────────
  const validateSentence = useCallback(
    (userInput: string, hintsUsedCount: number): Promise<SentenceResultResponse | null> => {
      const capturedIndex = currentIndex;
      return new Promise((resolve) => {
        setIsVerifying(true);
        submitMutation.mutate(
          {
            sentence_index: capturedIndex,
            user_input: userInput,
            hints_used: hintsUsedCount,
            replay_count: Math.max(0, playCount - 1),
          },
          {
            onSuccess: (result) => {
              setIsVerifying(false);
              if (!result) { resolve(null); return; }
              setServerResults((prev) =>
                new Map(prev).set(capturedIndex, {
                  ...result,
                  word_difficulty: result.word_difficulty ?? {},
                }),
              );
              resolve(result);
            },
            onError: (err) => {
              setIsVerifying(false);
              console.error(`[Dictation] Failed to verify sentence ${capturedIndex}:`, err);
              resolve(null);
            },
          },
        );
      });
    },
    [currentIndex, playCount, submitMutation],
  );

  const finalizeSentence = useCallback(
    (userInput: string, score: number) => {
      const capturedIndex = currentIndex;
      setResults((prev) => [
        ...prev.filter((r) => r.sentenceIndex !== capturedIndex),
        {
          sentenceIndex: capturedIndex,
          score,
          userInput,
          correctText: currentSentence?.text ?? '',
        },
      ]);
      setPhase('completed');
    },
    [currentIndex, currentSentence],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    if (!currentSentence || !playerHandle.current) return;
    autoPlayRef.current = true;
    playerHandle.current.seekTo(currentSentence.start_time);
    playerHandle.current.play();
    setIsVideoPlaying(true);
    setPhase('playing');
    setPlayCount((c) => c + 1);
  }, [currentSentence]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (sentences.length > 0) {
        const idx = findSegmentByTime(sentences, time);
        if (idx !== liveSegmentIdxRef.current) {
          liveSegmentIdxRef.current = idx;
          setLiveSegmentIdx(idx);
        }
      }
      if (currentSentence && time >= currentSentence.end_time) {
        playerHandle.current?.pause();
        setIsVideoPlaying(false);
        if (phase === 'playing') setPhase('practicing');
      }
    },
    [phase, currentSentence, sentences],
  );

  const handlePlayChange = useCallback(
    (playing: boolean) => {
      setIsVideoPlaying(playing);
      if (playing && phase !== 'playing') {
        if (currentSentence && playerHandle.current) {
          playerHandle.current.seekTo(currentSentence.start_time);
          autoPlayRef.current = true;
          setPhase('playing');
          setPlayCount((c) => c + 1);
        }
      }
      if (!playing && phase === 'playing') setPhase('practicing');
    },
    [phase, currentSentence],
  );

  const handleSubmit = useCallback(async () => {
    if (phase === 'completed' || isVerifying) return;
    const typed = inputValue.trim();
    if (!typed) return;
    const result = await validateSentence(typed, hintsUsed);
    if (!result) return;
    const isPerfectText = result.word_diffs.every((d) => d.status === 'correct');
    if (isPerfectText) {
      finalizeSentence(typed, Math.round(result.score * 100));
      return;
    }
    const offset = computeErrorCaretOffset(inputValue, result.word_diffs);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (offset === inputValue.length) return;
      try {
        el.setSelectionRange(offset, offset);
      } catch { /* best-effort */ }
    });
  }, [inputValue, hintsUsed, validateSentence, finalizeSentence, phase, isVerifying]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        handleNextRef.current();
      }
    },
    [handleSubmit],
  );

  const handleRevealHintWord = useCallback((index: number) => {
    setRevealedHintIndices((prev) => new Set(prev).add(index));
    setHintsUsed((h) => h + 1);
  }, []);

  const handleRevealAllHints = useCallback(() => {
    setAllHintsRevealed(true);
    setHintsUsed((h) => h + 1);
  }, []);

  const handleSkip = useCallback(async () => {
    if (isVerifying) return;
    const existingResult = results.find((r) => r.sentenceIndex === currentIndex);
    if (existingResult) {
      finalizeSentence(existingResult.userInput, existingResult.score);
      return;
    }
    setIsVerifying(true);
    submitMutation.mutate(
      {
        sentence_index: currentIndex,
        user_input: inputValue.trim(),
        hints_used: hintsUsed,
        replay_count: Math.max(0, playCount - 1),
        skipped: true,
      },
      {
        onSuccess: (result) => {
          setIsVerifying(false);
          if (result) {
            setServerResults((prev) => new Map(prev).set(currentIndex, result));
          }
          finalizeSentence('', 0);
        },
        onError: () => {
          setIsVerifying(false);
          finalizeSentence('', 0);
        },
      },
    );
  }, [inputValue, hintsUsed, currentIndex, submitMutation, finalizeSentence, isVerifying, results, playCount]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= totalSentences) {
      completeMutation.mutate();
      const totalScore =
        results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
          : 0;
      navigate(`/result/${videoId}`, {
        state: {
          video,
          results: results.map((r) => ({
            sentenceIndex: r.sentenceIndex,
            userInput: r.userInput,
            correctText: r.correctText,
            score: r.score,
            wordDiffs: serverResults.get(r.sentenceIndex)?.word_diffs ?? [],
          })),
          totalScore,
        },
      });
      return;
    }
    setCurrentIndex(next);
  }, [currentIndex, totalSentences, results, serverResults, navigate, videoId, video, completeMutation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  // ── Word popover handlers ──────────────────────────────────────────────────
  const handleWordPopover = useCallback(
    async (word: string, contextSentence: string, startTime: number, anchorEl: HTMLElement) => {
      if (sentenceSavedWords.has(word)) return;
      if (popoverWord === word) {
        setPopoverAnchorEl(null);
        setPopoverWord(null);
        return;
      }
      const reqId = ++popoverRequestId.current;
      setPopoverAnchorEl(anchorEl);
      setPopoverWord(word);
      setPopoverContext({ context: contextSentence, startTime });
      setPopoverPreview(null);
      setIsPopoverLoading(true);
      try {
        const result = await vocabularyService.previewWord(word, contextSentence);
        if (popoverRequestId.current !== reqId) return;
        setPopoverPreview(result);
      } catch (err) {
        if (popoverRequestId.current !== reqId) return;
        console.error('[Popover] Preview failed:', err);
      } finally {
        if (popoverRequestId.current === reqId) setIsPopoverLoading(false);
      }
    },
    [popoverWord, sentenceSavedWords],
  );

  const handleDismissPopover = useCallback(() => {
    setPopoverAnchorEl(null);
    setPopoverWord(null);
    setPopoverPreview(null);
  }, []);

  const handlePopoverSave = useCallback(async () => {
    if (!popoverWord || !popoverContext || isPopoverSaving) return;
    const wasSaved = popoverPreview?.is_saved ?? false;
    setIsPopoverSaving(true);
    try {
      await vocabularyService.saveWord({
        word: popoverWord.toLowerCase(),
        video_id: videoId!,
        context_sentence: popoverContext.context,
        audio_start_time: popoverContext.startTime,
        source: 'dictation',
        audio_url: popoverPreview?.audio_url ?? undefined,
        phonetic: popoverPreview?.phonetic ?? undefined,
        meaning: popoverPreview?.meaning ?? undefined,
        context_translation: popoverPreview?.context_translation ?? undefined,
        part_of_speech: popoverPreview?.part_of_speech ?? undefined,
      });
      setSentenceSavedWords((prev) => {
        const next = new Set(prev);
        next.add(cleanForSave(popoverWord));
        return next;
      });
      setPopoverPreview((p) => (p ? { ...p, is_saved: true } : p));
      void sentenceQueryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      toast.success(wasSaved ? 'Word updated with new context' : 'Word saved to flashcards');
    } catch (err) {
      console.error('[Popover] Save failed:', err);
      toast.error('Failed to save word');
    } finally {
      setIsPopoverSaving(false);
    }
  }, [popoverWord, popoverContext, popoverPreview, isPopoverSaving, videoId, sentenceQueryClient]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  useEffect(() => {
    if (phase !== 'completed') return;
    const t = setTimeout(() => {
      if (autoNextRef.current) handleNextRef.current();
    }, 4000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (videoLoading || sentencesLoading) {
    return (
      <div className="flex items-center justify-center min-h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (videoError || !video) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">Video not found</p>
        <Link to="/library" className="text-sm text-muted-foreground underline">Back to Library</Link>
      </div>
    );
  }

  if (transcriptionStatus === 'pending' || transcriptionStatus === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-medium">Transcription in progress…</p>
        <p className="text-sm text-muted-foreground">This may take a minute. The page will update automatically.</p>
      </div>
    );
  }

  if (transcriptionStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">Transcription failed</p>
        <p className="text-sm text-muted-foreground">Please try re-importing this video.</p>
        <Link to="/library" className="text-sm text-muted-foreground underline">Back to Library</Link>
      </div>
    );
  }

  if (!sentences.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No transcript available</p>
        <Link to="/library" className="text-sm text-muted-foreground underline">Back to Library</Link>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Starting session…</span>
      </div>
    );
  }

  const effectiveMode: PracticeMode = practiceMode ?? sessionData.practice_mode ?? 'sentence';
  if (effectiveMode === 'cloze') {
    return (
      <ClozeMode
        video={video}
        videoId={videoId!}
        sessionId={sessionId}
        difficulty={clozeDifficulty}
        playerHandle={playerHandle}
        onCompleted={() => completeMutation.mutate()}
      />
    );
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const runningAverage = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center gap-3 z-10">
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
              Dictation
            </p>
            {results.length > 0 && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                Avg {runningAverage}%
              </span>
            )}
          </div>
          <h1 className="text-sm font-semibold tracking-tight truncate">{video.title}</h1>
        </div>
        {/* Progress pill */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/60 transition-all duration-500 rounded-full"
              style={{ width: `${sentenceProgress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentIndex + 1}/{totalSentences}
          </span>
        </div>
      </header>

      {/* ── Body: main + sidebar ── */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── Main content column ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[900px] mx-auto px-4 py-4 flex flex-col gap-4">

            {/* Video player */}
            <div className="rounded-xl overflow-hidden border border-border shadow-soft bg-card shrink-0">
              <YoutubePlayer
                ref={playerHandle}
                videoId={video.youtube_id}
                endTime={currentSentence?.end_time ?? null}
                onTimeUpdate={handleTimeUpdate}
                onPlayChange={handlePlayChange}
              />
            </div>

            {/* Play controls */}
            <div className="flex items-center justify-center gap-3 shrink-0">
              {isVideoPlaying && phase !== 'playing' ? (
                <button
                  onClick={() => { playerHandle.current?.pause(); }}
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95 min-w-[110px]"
                >
                  <Pause className="h-3 w-3 fill-current" /> Pause
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  disabled={phase === 'playing'}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 h-10 rounded-full text-sm font-medium transition-all min-w-[110px]',
                    phase === 'playing'
                      ? 'px-5 bg-primary/10 text-primary cursor-not-allowed'
                      : 'px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md active:scale-95',
                  )}
                >
                  {phase === 'playing' ? (
                    <><span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Playing…</>
                  ) : playCount === 0 ? (
                    <><Play className="h-4 w-4 fill-current" /> Play</>
                  ) : (
                    <><RotateCcw className="h-4 w-4" /> Replay</>
                  )}
                </button>
              )}

              <button
                onClick={toggleAutoNext}
                title={autoNext ? 'Auto-Next: On' : 'Auto-Next: Off'}
                className={cn(
                  'flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium rounded-full border transition-colors',
                  autoNext
                    ? 'border-primary/40 bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <span>Auto</span>
                <span className={cn(
                  'relative inline-flex h-5 w-9 rounded-full transition-colors duration-200',
                  autoNext ? 'bg-primary' : 'bg-muted-foreground/30',
                )}>
                  <span className={cn(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                    autoNext ? 'translate-x-3.5' : 'translate-x-0.5',
                  )} />
                </span>
              </button>
            </div>

            {/* ── Interaction card ── */}
            <div className={cn(
              'bg-card rounded-xl border shadow-soft p-5 sm:p-6 flex flex-col gap-5 transition-colors duration-500',
              phase === 'completed' ? 'border-green-300 bg-green-50/30 dark:bg-green-950/10' : 'border-border',
            )}>
              {/* Navigation bar */}
              <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold">
                    Sentence {currentIndex + 1} <span className="text-muted-foreground font-normal">of {totalSentences}</span>
                  </span>
                  <button
                    onClick={handleNext}
                    title="Next sentence (Tab)"
                    className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {results.length > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums sm:hidden">
                    Avg <span className="font-semibold text-foreground">{runningAverage}%</span>
                  </span>
                )}
              </div>

              {/* Phase: practicing / playing */}
              {phase !== 'completed' && (
                <div className="flex flex-col gap-4">
                  {/* Live feedback diff */}
                  {latestDiffCheck && !latestDiffCheck.word_diffs.every((d) => d.status === 'correct') && currentSentence && videoId && (
                    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200 shrink-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-amber-700">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Not quite — fix the highlighted word
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {Math.round(latestDiffCheck.score * 100)}% · {latestDiffCheck.correct_count}/
                          {latestDiffCheck.word_diffs.filter((d) => d.status !== 'extra').length}
                        </span>
                      </div>
                      <WordSavePanel
                        text={latestDiffCheck.original_text || currentSentence.text}
                        videoId={latestDiffCheck.video_id || videoId}
                        audioStartTime={latestDiffCheck.audio_start_time || currentSentence.start_time}
                        wordDifficulty={latestDiffCheck.word_difficulty ?? {}}
                        diffs={latestDiffCheck.word_diffs}
                        savedWords={sentenceSavedWords}
                        previewingWord={popoverWord}
                        onWordClick={handleWordPopover}
                      />
                    </div>
                  )}

                  {/* Textarea */}
                  <div className={cn(
                    'flex items-start gap-3 rounded-2xl border-2 px-4 py-4 transition-all duration-200 bg-background shadow-sm shrink-0',
                    isVerifying
                      ? 'border-muted-foreground/30 ring-4 ring-muted/30'
                      : 'border-primary ring-4 ring-primary/10',
                  )}>
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Type what you hear…"
                      rows={2}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={isVerifying}
                      className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed disabled:opacity-60"
                    />
                    {inputValue && !isVerifying && (
                      <kbd className="shrink-0 mt-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                        ↵
                      </kbd>
                    )}
                    {isVerifying && (
                      <Loader2 className="shrink-0 mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Dotted hint bar */}
                  {currentSentence && (
                    <DottedHintBar
                      sentence={currentSentence.text}
                      revealedIndices={revealedHintIndices}
                      onRevealWord={handleRevealHintWord}
                      onRevealAll={handleRevealAllHints}
                      allRevealed={allHintsRevealed}
                    />
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 shrink-0">
                    {hintsUsed > 0 && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded mr-auto">
                        {hintsUsed} hint{hintsUsed !== 1 ? 's' : ''} used
                      </span>
                    )}
                    <button
                      onClick={handleSkip}
                      disabled={isVerifying}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                    >
                      Skip
                    </button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={!inputValue.trim() || isVerifying}
                      className="gap-1.5 rounded-xl min-w-24"
                    >
                      {isVerifying ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</>
                      ) : latestDiffCheck && !latestDiffCheck.word_diffs.every((d) => d.status === 'correct') ? (
                        'Retry'
                      ) : (
                        'Submit'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Phase: completed */}
              {phase === 'completed' && latestResult && (
                <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

                  {/* WordSavePanel (click words → floating popover) */}
                  {currentSentence && videoId && (
                    <WordSavePanel
                      text={latestDiffCheck?.original_text || currentSentence.text}
                      videoId={latestDiffCheck?.video_id || videoId}
                      audioStartTime={latestDiffCheck?.audio_start_time || currentSentence.start_time}
                      wordDifficulty={latestDiffCheck?.word_difficulty ?? {}}
                      diffs={latestDiffCheck?.word_diffs}
                      savedWords={sentenceSavedWords}
                      previewingWord={popoverWord}
                      onWordClick={handleWordPopover}
                    />
                  )}

                  {/* Translation */}
                  {currentSentence?.translation && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <button
                        onClick={() => setShowTranslation((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Languages className="h-4 w-4" />
                          Translation
                        </span>
                        <ChevronDown className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform duration-200',
                          showTranslation && 'rotate-180',
                        )} />
                      </button>
                      {showTranslation && (
                        <div className="px-4 py-3 bg-muted/20 border-t border-border">
                          <p className="text-sm leading-relaxed text-muted-foreground italic">
                            {currentSentence.translation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Next button */}
                  <Button onClick={handleNext} className="w-full gap-2 rounded-xl h-12 text-base shrink-0 mt-2">
                    {isLastSentence ? (
                      <><Trophy className="h-4 w-4" /> See Final Results</>
                    ) : (
                      <>Next Sentence <ChevronRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Segments sidebar (desktop only) ── */}
        <div className="hidden lg:flex flex-col w-[280px] shrink-0 border-l border-border bg-card">
          <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <p className="text-sm font-semibold">Subtitles</p>
            <p className="text-xs text-muted-foreground">{results.length} / {totalSentences} completed</p>
          </div>
          <div ref={segmentListRef} className="flex-1 overflow-y-auto divide-y divide-border">
            {sentences.map((seg, i) => {
              const result = results.find((r) => r.sentenceIndex === i);
              const isActive = i === currentIndex;
              const isDone = !!result;
              const isLive = i === liveSegmentIdx && !isActive;

              return (
                <div
                  key={seg.id}
                  data-active={isActive}
                  data-live={isLive}
                  onClick={() => !isActive && setCurrentIndex(i)}
                  className={cn(
                    'flex items-start gap-2.5 px-4 py-2.5 transition-colors',
                    isActive && 'bg-primary/5 border-l-2 border-l-primary',
                    isLive && !isActive && 'bg-blue-50/50 dark:bg-blue-950/20',
                    !isActive && 'cursor-pointer hover:bg-muted/30 hover:opacity-100',
                    !isDone && !isActive && !isLive && 'opacity-50',
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {isDone ? (
                      result!.score >= 80 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : result!.score >= 50 ? (
                        <MinusCircle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )
                    ) : isActive ? (
                      <span className="h-4 w-4 flex items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      </span>
                    ) : isLive ? (
                      <span className="h-4 w-4 flex items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                      </span>
                    ) : (
                      <span className="h-4 w-4 flex items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={cn('text-xs font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}>
                        #{i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />{formatTime(seg.start_time)}
                      </span>
                      {isDone && (
                        <span className={cn(
                          'text-xs font-bold px-1.5 py-0.5 rounded-full leading-none',
                          result!.score >= 80 ? 'bg-green-100 text-green-700' :
                            result!.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700',
                        )}>
                          {Math.round(result!.score)}%
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-xs leading-snug line-clamp-2',
                      isDone ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {isDone ? seg.text : seg.text.replace(/\S/g, '·')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating word popover */}
      {popoverWord && (
        <WordPopover
          anchorEl={popoverAnchorEl}
          word={popoverWord}
          preview={popoverPreview}
          isLoading={isPopoverLoading}
          isSaved={sentenceSavedWords.has(popoverWord)}
          isSaving={isPopoverSaving}
          onSave={handlePopoverSave}
          onPlayAudio={() => {}}
          onDismiss={handleDismissPopover}
        />
      )}
    </div>
  );
}