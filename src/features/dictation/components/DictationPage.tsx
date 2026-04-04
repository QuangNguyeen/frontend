import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, RotateCcw, Play, Pause,
  ChevronLeft, ChevronRight, ChevronDown, Eye, Trophy,
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
import type { SentenceResultResponse, TranscriptResponse } from '@/shared/types/api';
import { WordSavePanel } from './WordSavePanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type WordStatus = 'hidden' | 'active' | 'correct';
type Phase = 'idle' | 'playing' | 'practicing' | 'completed';

interface WordState {
  original: string;
  normalized: string;
  status: WordStatus;
  wrongAttempts: number;
}

interface LocalResult {
  sentenceIndex: number;
  /** Provisional 100 until server responds with real score */
  score: number;
  wrongAttempts: number;
  correctText: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9']/g, '');
}

function buildWordStates(sentence: TranscriptResponse): WordState[] {
  return sentence.text
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => ({
      original: w,
      normalized: normalizeWord(w),
      // First word is immediately active so user can start typing
      status: (i === 0 ? 'active' : 'hidden') as WordStatus,
      wrongAttempts: 0,
    }));
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Binary search: returns the index of the segment containing `time`,
 * or -1 if no segment covers that timestamp.
 */
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

// ─── Word Chip ────────────────────────────────────────────────────────────────

function WordChip({ word, isFlashing }: { word: WordState; isFlashing: boolean }) {
  const len = word.original.replace(/[^a-zA-Z0-9]/g, '').length;
  const dots = '●'.repeat(Math.max(3, len));

  if (word.status === 'correct') {
    return (
      <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-green-100 text-green-700 font-medium text-sm border border-green-200 animate-in fade-in zoom-in-90 duration-300">
        {word.original}
      </span>
    );
  }

  if (word.status === 'active') {
    return (
      <span
        className={cn(
          'inline-flex items-center px-3 py-1.5 rounded-xl font-medium text-sm border-2 transition-all duration-150',
          isFlashing
            ? 'bg-red-50 border-red-400 text-red-400'
            : 'bg-primary/5 border-primary ring-4 ring-primary/10 text-primary',
        )}
      >
        <span className="tracking-widest text-xs opacity-50">{dots}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-muted border border-border text-muted-foreground/30 text-sm">
      <span className="tracking-widest text-xs">{dots}</span>
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DictationPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();

  const playerHandle = useRef<YoutubePlayerHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const segmentListRef = useRef<HTMLDivElement>(null);
  /** Ref mirror of liveSegmentIdx — avoids stale closure in handleTimeUpdate. */
  const liveSegmentIdxRef = useRef(-1);
  const [liveSegmentIdx, setLiveSegmentIdx] = useState(-1);

  /**
   * After user presses Play once, autoPlayRef = true so subsequent sentences
   * play automatically on sentence switch.
   */
  const autoPlayRef = useRef(false);
  /**
   * Stable pointer to the latest handleNext. Used by the auto-advance effect
   * so the effect only depends on [phase] and never creates double-timeouts
   * due to handleNext reference churn.
   */
  const handleNextRef = useRef<() => void>(() => { });

  // ── Persisted user preferences ─────────────────────────────────────────────
  const autoNext = usePlayerPrefsStore((s) => s.autoNext);
  const toggleAutoNext = usePlayerPrefsStore((s) => s.toggleAutoNext);
  /** Ref mirror of autoNext — lets auto-advance effect read the latest value
   *  without being in its dependency array (avoids retriggering on toggle). */
  const autoNextRef = useRef(autoNext);
  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);

  // ── API state ──────────────────────────────────────────────────────────────
  const { sessionId, sessionData } = useDictationSession(videoId);
  const [currentIndex, setCurrentIndex] = useState(0);
  /** Whether we've already applied the resume index from sessionData */
  const resumeAppliedRef = useRef(false);
  /**
   * Results are added IMMEDIATELY when a sentence is completed locally.
   * We do NOT wait for the server response before showing results or advancing.
   * The background mutation updates the score field once the server responds.
   */
  const [results, setResults] = useState<LocalResult[]>([]);
  /** Server results keyed by sentence index — has word_difficulty for WordSavePanel. */
  const [serverResults, setServerResults] = useState<Map<number, SentenceResultResponse>>(new Map());

  // ── Practice state ─────────────────────────────────────────────────────────
  const [words, setWords] = useState<WordState[]>([]);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [flashingIdx, setFlashingIdx] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');

  // ── Player state ───────────────────────────────────────────────────────────
  const [playCount, setPlayCount] = useState(0);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: video, isLoading: videoLoading, isError: videoError } = useVideo(videoId);
  const { data: sentences = [], isLoading: sentencesLoading } = useVideoTranscripts(videoId);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Apply resume index from session data (runs once when session loads)
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

  // Reset all practice state when the active sentence changes
  useEffect(() => {
    const sentence = sentences[currentIndex];
    if (!sentence) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setWords(buildWordStates(sentence));
    setCurrentWordIdx(0);
    setInputValue('');
    setPhase('practicing');
    setPlayCount(0);
    setHintsUsed(0);
    setShowTranslation(false);
    setFlashingIdx(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [currentIndex, sentences]);

  /**
   * Auto-play when the active sentence changes — only triggers if the user has
   * already played at least once (autoPlayRef.current = true).
   */
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

  // Keep input focused while the user should be typing
  useEffect(() => {
    if (phase !== 'completed') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase, currentIndex]);

  // Scroll the active segment into view in the right panel
  useEffect(() => {
    segmentListRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const currentSentence = sentences[currentIndex];
  const totalSentences = sentences.length;
  const completedWords = words.filter((w) => w.status === 'correct').length;
  const totalWords = words.length;
  const wordProgress = totalWords > 0 ? (completedWords / totalWords) * 100 : 0;
  const sentenceProgress = totalSentences > 0 ? (currentIndex / totalSentences) * 100 : 0;
  const isLastSentence = currentIndex === totalSentences - 1;
  const latestResult = results.find((r) => r.sentenceIndex === currentIndex);

  // ── Background scoring mutation ────────────────────────────────────────────
  // Fire-and-forget scoring hook — session may not exist yet, that's fine.
  const submitMutation = useSubmitAnswer(sessionId);
  const completeMutation = useCompleteSession(sessionId);

  // ── Sentence completion (local, immediate) ─────────────────────────────────
  /**
   * completeSentence is the single source of truth for finishing a sentence.
   * Updates results and phase IMMEDIATELY without waiting for the server,
   * then fires the scoring mutation in the background.
   */
  const completeSentence = useCallback(
    (userInput: string, hintsUsed: number, currentWords: WordState[]) => {
      const totalWrong = currentWords.reduce((acc, w) => acc + w.wrongAttempts, 0);
      const capturedIndex = currentIndex;
      setResults((prev) => [
        ...prev.filter((r) => r.sentenceIndex !== capturedIndex),
        {
          sentenceIndex: capturedIndex,
          score: 100,
          wrongAttempts: totalWrong,
          correctText: currentSentence?.text ?? '',
        },
      ]);
      setPhase('completed');
      // Submit for real score in background — update score on success
      submitMutation.mutate(
        {
          sentence_index: capturedIndex,
          user_input: userInput,
          hints_used: hintsUsed,
          replay_count: Math.max(0, playCount - 1),
        },
        {
          onSuccess: (result) => {
            if (!result) return;
            setResults((prev) =>
              prev.map((r) =>
                r.sentenceIndex === capturedIndex ? { ...r, score: Math.round(result.score * 100) } : r,
              ),
            );
            setServerResults((prev) => new Map(prev).set(capturedIndex, {
              ...result,
              word_difficulty: result.word_difficulty ?? {},
            }));
          },
          onError: (err) => {
            console.error(`[Dictation] Failed to submit sentence ${capturedIndex}:`, err);
          },
        },
      );
    },
    [currentIndex, currentSentence, playCount, submitMutation],
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
      // Track live position in segment list regardless of phase
      if (sentences.length > 0) {
        const idx = findSegmentByTime(sentences, time);
        if (idx !== liveSegmentIdxRef.current) {
          liveSegmentIdxRef.current = idx;
          setLiveSegmentIdx(idx);
        }
      }
      // Always pause at the current sentence boundary
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
        // Native play button pressed — force guided play for the current sentence
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

  /**
   * Validates one typed word against the expected word at currentWordIdx.
   * On correct: reveal chip, advance index, call completeSentence if last word.
   * On wrong: flash the chip, clear input, stay on same word.
   *
   * FIX: calls completeSentence directly — no longer waits for mutation.
   */
  const validateWord = useCallback(
    (typed: string) => {
      if (currentWordIdx >= words.length) return;
      const target = words[currentWordIdx];

      if (normalizeWord(typed) === target.normalized) {
        // Mark word correct, activate the next one
        const updated = words.map((w, i) =>
          i === currentWordIdx
            ? { ...w, status: 'correct' as WordStatus }
            : i === currentWordIdx + 1
              ? { ...w, status: 'active' as WordStatus }
              : w,
        );
        setWords(updated);
        setInputValue('');
        const next = currentWordIdx + 1;
        setCurrentWordIdx(next);

        if (next >= words.length) {
          // All words correct — complete immediately, don't wait for server
          const assembled = updated.map((w) => w.original).join(' ');
          completeSentence(assembled, hintsUsed, updated);
        }
      } else {
        // Wrong answer — flash the active chip, keep text, move caret to start
        setWords((prev) =>
          prev.map((w, i) => (i === currentWordIdx ? { ...w, wrongAttempts: w.wrongAttempts + 1 } : w)),
        );
        setFlashingIdx(currentWordIdx);
        setTimeout(() => setFlashingIdx(null), 600);
        setInputValue(typed);
        // Move caret to position 0 so the user can fix from the start
        requestAnimationFrame(() => {
          inputRef.current?.setSelectionRange(0, 0);
        });
      }
    },
    [words, currentWordIdx, completeSentence, hintsUsed],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Space acts as a submit trigger (same as Enter)
      if (val.endsWith(' ')) {
        const typed = val.trim();
        if (typed) validateWord(typed);
        else setInputValue('');
        return;
      }
      setInputValue(val);
    },
    [validateWord],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const typed = inputValue.trim();
        if (typed) validateWord(typed);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        handleNextRef.current(); // advance via stable ref — no extra dep needed
      }
    },
    [inputValue, validateWord],
  );

  /** Reveals the current active word, then moves to the next — one word per click. */
  const handleRevealWord = useCallback(() => {
    if (currentWordIdx >= words.length) return;
    const next = currentWordIdx + 1;
    const updated = words.map((w, i) =>
      i === currentWordIdx
        ? { ...w, status: 'correct' as WordStatus }
        : i === next
          ? { ...w, status: 'active' as WordStatus }
          : w,
    );
    setWords(updated);
    setCurrentWordIdx(next);
    setInputValue('');
    setHintsUsed((h) => h + 1);
    if (next >= words.length) {
      const assembled = updated.map((w) => w.original).join(' ');
      completeSentence(assembled, hintsUsed + 1, updated);
    }
  }, [words, currentWordIdx, completeSentence, hintsUsed]);

  const handleSkip = useCallback(() => {
    completeSentence('', 0, words);
  }, [completeSentence, words]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= totalSentences) {
      // Explicitly mark session as completed (fire-and-forget safety net)
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
            userInput: r.correctText,
            correctText: r.correctText,
            score: r.score,
            wordDiffs: [],
          })),
          totalScore,
        },
      });
      return;
    }
    setCurrentIndex(next);
  }, [currentIndex, totalSentences, results, navigate, videoId, video, completeMutation]);

  // Keep handleNextRef pointing at the latest handleNext without it being
  // a dep of the auto-advance effect (prevents double-trigger).
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  /**
   * Auto-advance effect.
   * Only depends on [phase] — fires exactly once when phase becomes 'completed'.
   * Reads handleNextRef/autoNextRef at call time so fresh values are used
   * without adding them as deps (avoids double-trigger on reference churn).
   */
  useEffect(() => {
    if (phase !== 'completed') return;
    const t = setTimeout(() => {
      // Check at callback time, not at setup — handles toggling off during the delay
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

  if (!sentences.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No transcript available</p>
        <Link to="/library" className="text-sm text-muted-foreground underline">Back to Library</Link>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            to="/library"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Library</span>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{video.title}</p>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{video.channel}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium">
              {currentIndex + 1} / {totalSentences}
            </span>

            {/* Auto-Next toggle */}
            <button
              onClick={toggleAutoNext}
              title={autoNext ? 'Auto-Next: On — click to disable' : 'Auto-Next: Off — click to enable'}
              className={cn(
                'hidden sm:flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg border transition-colors',
                autoNext
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <span>Auto Next</span>
              {/* Toggle pill */}
              <span className={cn(
                'relative inline-flex h-4 w-7 rounded-full transition-colors duration-200',
                autoNext ? 'bg-primary' : 'bg-muted-foreground/30',
              )}>
                <span className={cn(
                  'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200',
                  autoNext ? 'translate-x-3.5' : 'translate-x-0.5',
                )} />
              </span>
            </button>
          </div>
        </div>
        {/* Overall sentence progress bar */}
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary/40 transition-all duration-500"
            style={{ width: `${sentenceProgress}%` }}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Practice area ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4 pb-28 sm:pb-6">

            {/* Video player */}
            <YoutubePlayer
              ref={playerHandle}
              videoId={video.youtube_id}
              onTimeUpdate={handleTimeUpdate}
              onPlayChange={handlePlayChange}
            />

            {/* Sentence play controls */}
            <div className="flex items-center gap-2">
              {/* Free-play: show Pause */}
              {isVideoPlaying && phase !== 'playing' ? (
                <button
                  onClick={() => { playerHandle.current?.pause(); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95"
                >
                  <Pause className="h-3.5 w-3.5 fill-current" /> Pause
                </button>
              ) : (
                /* Guided play: Play Sentence / Playing… / Replay */
                <button
                  onClick={handlePlay}
                  disabled={phase === 'playing'}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    phase === 'playing'
                      ? 'bg-primary/10 text-primary cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-95',
                  )}
                >
                  {phase === 'playing' ? (
                    <><span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Playing…</>
                  ) : playCount === 0 ? (
                    <><Play className="h-3.5 w-3.5 fill-current" /> Play Sentence</>
                  ) : (
                    <><RotateCcw className="h-3.5 w-3.5" /> Replay</>
                  )}
                </button>
              )}
            </div>

            {/* Sentence practice card */}
            <div className={cn(
              'bg-card rounded-2xl overflow-hidden shadow-sm border transition-colors duration-500',
              phase === 'completed' ? 'border-green-300 bg-green-50/30' : 'border-border',
            )}>

              {/* Card header */}
              <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold">Sentence {currentIndex + 1}</span>
                  <span className="text-xs text-muted-foreground">of {totalSentences}</span>
                </div>
                {totalWords > 0 && (
                  <div className="flex items-center gap-2 flex-1 justify-center">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {completedWords}/{totalWords} words
                    </span>
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${wordProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    title="Previous sentence"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleNext}
                    title="Next sentence  (Tab)"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-5 flex flex-col gap-5">

                {/* Word chips */}
                {words.length > 0 && (
                  <div className="flex flex-wrap gap-2 min-h-10">
                    {words.map((word, i) => (
                      <WordChip key={i} word={word} isFlashing={flashingIdx === i} />
                    ))}
                  </div>
                )}

                {/* Input area (desktop) */}
                {phase !== 'completed' && (
                  <div className="hidden sm:flex flex-col gap-2">
                    <div className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all duration-200 border-primary bg-background shadow-sm ring-4 ring-primary/10">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type the next word… (Space or Enter to confirm)"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/40"
                      />
                      {inputValue && (
                        <kbd className="shrink-0 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                          ↵
                        </kbd>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleRevealWord}
                        disabled={currentWordIdx >= words.length}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Show word
                        {hintsUsed > 0 && (
                          <span className="ml-0.5 text-[10px] bg-muted px-1 rounded">
                            {hintsUsed}/{words.length}
                          </span>
                        )}
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={handleSkip}
                        className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        Skip sentence
                      </button>
                    </div>
                  </div>
                )}

                {/* Completed feedback */}
                {phase === 'completed' && latestResult && (
                  <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* Score banner */}
                    <div className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-xl border',
                      latestResult.score >= 80 ? 'bg-green-50 border-green-200' :
                        latestResult.score >= 50 ? 'bg-yellow-50 border-yellow-200' :
                          'bg-red-50 border-red-200',
                    )}>
                      <div className="flex items-center gap-2">
                        {latestResult.score >= 80 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : latestResult.score >= 50 ? (
                          <MinusCircle className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={cn(
                          'text-sm font-semibold',
                          latestResult.score >= 80 ? 'text-green-800' :
                            latestResult.score >= 50 ? 'text-yellow-800' : 'text-red-800',
                        )}>
                          {latestResult.score >= 80 ? 'Excellent!' : latestResult.score >= 50 ? 'Good effort!' : 'Keep practicing!'}
                        </span>
                        {latestResult.wrongAttempts > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({latestResult.wrongAttempts} {latestResult.wrongAttempts === 1 ? 'mistake' : 'mistakes'})
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        'text-lg font-bold tabular-nums',
                        latestResult.score >= 80 ? 'text-green-700' :
                          latestResult.score >= 50 ? 'text-yellow-700' : 'text-red-600',
                      )}>
                        {Math.round(latestResult.score)}%
                      </span>
                    </div>

                    {/* Word save panel (also serves as the answer reveal) */}
                    {currentSentence && videoId && (() => {
                      const sr = serverResults.get(currentIndex);
                      return (
                        <WordSavePanel
                          text={sr?.original_text ?? currentSentence.text}
                          videoId={sr?.video_id ?? videoId}
                          audioStartTime={sr?.audio_start_time ?? currentSentence.start_time}
                          wordDifficulty={sr?.word_difficulty ?? {}}
                        />
                      );
                    })()}

                    {/* Translation panel (shown only when field is present) */}
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

                    {/* Action button — single full-width Next */}
                    <Button onClick={handleNext} className="w-full gap-2 rounded-xl h-11">
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

            {/* Running average */}
            {results.length > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-2.5 border border-border">
                <span>Running average</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Segment list (desktop only) ── */}
        <div className="w-64 shrink-0 border-l border-border flex-col overflow-hidden bg-background hidden lg:flex">
          <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <p className="text-sm font-semibold">All Segments</p>
            <p className="text-xs text-muted-foreground">{results.length} / {totalSentences} done</p>
          </div>
          <div ref={segmentListRef} className="flex-1 overflow-y-auto divide-y divide-border">
            {sentences.map((seg, i) => {
              // FIX: isDone is now reliable because results are added locally on completion
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
                    'flex items-start gap-2.5 px-4 py-3 transition-colors',
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
                    {/* FIX: Only show full text for completed sentences, masked for all others */}
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

      {/* ── Mobile sticky input ── */}
      {phase !== 'completed' && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3 z-20 shadow-lg">
          <div className="flex items-center gap-3 rounded-2xl border-2 border-primary px-4 py-3 bg-background ring-4 ring-primary/10">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type the next word…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/40"
            />
            {/* Mobile Auto-Next toggle */}
            <button
              onClick={toggleAutoNext}
              title={autoNext ? 'Auto-Next On' : 'Auto-Next Off'}
              className="shrink-0 p-1.5 rounded-lg transition-colors"
            >
              <span className={cn(
                'relative inline-flex h-4 w-7 rounded-full transition-colors duration-200',
                autoNext ? 'bg-primary' : 'bg-muted-foreground/30',
              )}>
                <span className={cn(
                  'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200',
                  autoNext ? 'translate-x-3.5' : 'translate-x-0.5',
                )} />
              </span>
            </button>
            <button
              onClick={handleRevealWord}
              disabled={currentWordIdx >= words.length}
              className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
              title="Reveal next word"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}