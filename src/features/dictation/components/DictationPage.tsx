import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import ReactPlayer from 'react-player';
import type { SyntheticEvent } from 'react';
import {
  ArrowLeft, RotateCcw, Play, Volume2, VolumeX,
  SkipBack, ChevronRight, Eye, Trophy,
  Loader2, AlertCircle, CheckCircle2, XCircle,
  MinusCircle, Clock, Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { videosApi, dictationApi } from '@/shared/lib/api';
import { cn } from '@/lib/utils';
import type { TranscriptResponse } from '@/shared/types/api';

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

// Payload passed to the background scoring mutation
interface SubmitPayload {
  userInput: string;
  sentenceIndex: number;
  hintsUsed: number;
  replayCount: number;
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

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

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

  const playerRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const segmentListRef = useRef<HTMLDivElement>(null);

  /**
   * After user presses Play once, autoPlayRef = true so subsequent sentences
   * play automatically on sentence switch.
   */
  const autoPlayRef = useRef(false);
  /** Mirror of playbackRate state — safe to read inside effects/timeouts. */
  const playbackRateRef = useRef(1);
  /**
   * Stable pointer to the latest handleNext. Used by the auto-advance effect
   * so the effect only depends on [phase] and never creates double-timeouts
   * due to handleNext reference churn.
   */
  const handleNextRef = useRef<() => void>(() => {});

  // ── API state ──────────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  /**
   * Results are added IMMEDIATELY when a sentence is completed locally.
   * We do NOT wait for the server response before showing results or advancing.
   * The background mutation updates the score field once the server responds.
   */
  const [results, setResults] = useState<LocalResult[]>([]);

  // ── Practice state ─────────────────────────────────────────────────────────
  const [words, setWords] = useState<WordState[]>([]);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [flashingIdx, setFlashingIdx] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');

  // ── Player state ───────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [playCount, setPlayCount] = useState(0);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: video, isLoading: videoLoading, isError: videoError } = useQuery({
    queryKey: ['video', videoId],
    queryFn: () => videosApi.get(videoId!),
    enabled: !!videoId,
  });

  const { data: sentences = [], isLoading: sentencesLoading } = useQuery<TranscriptResponse[]>({
    queryKey: ['transcripts', videoId],
    queryFn: () => videosApi.getTranscripts(videoId!),
    enabled: !!videoId,
  });

  // ── Effects ────────────────────────────────────────────────────────────────

  // Create dictation session once on mount
  useEffect(() => {
    if (!videoId || sessionId) return;
    dictationApi.createSession(videoId).then((s) => setSessionId(s.id)).catch(console.error);
  }, [videoId, sessionId]);

  // Reset all practice state when the active sentence changes
  useEffect(() => {
    const sentence = sentences[currentIndex];
    if (!sentence) return;
    setWords(buildWordStates(sentence));
    setCurrentWordIdx(0);
    setInputValue('');
    setPhase('idle');
    setPlayCount(0);
    setShowAnswer(false);
    setFlashingIdx(null);
  }, [currentIndex, sentences]); // eslint-disable-line react-hooks/set-state-in-effect

  // Keep playback rate ref in sync and apply to the player DOM element
  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (playerRef.current) playerRef.current.playbackRate = playbackRate;
  }, [playbackRate, isPlaying]);

  /**
   * Auto-play when sentence resets to idle — only triggers if the user has
   * already played at least once (autoPlayRef.current = true).
   */
  useEffect(() => {
    if (!autoPlayRef.current || phase !== 'idle') return;
    const sentence = sentences[currentIndex];
    if (!sentence || !playerRef.current) return;
    const t = setTimeout(() => {
      if (!playerRef.current) return;
      playerRef.current.currentTime = sentence.start_time;
      playerRef.current.playbackRate = playbackRateRef.current;
      playerRef.current.play().catch(() => {});
      setIsPlaying(true);
      setPhase('playing');
      setPlayCount(1);
    }, 100);
    return () => clearTimeout(t);
  }, [phase, currentIndex, sentences]);

  // Keep input focused during active phases
  useEffect(() => {
    if (phase === 'practicing' || phase === 'playing') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase]);

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
  /**
   * FIX: This mutation is fire-and-forget for scoring only.
   * It does NOT control navigation or phase transitions.
   * Completion happens locally (see completeSentence below).
   */
  const submitMutation = useMutation({
    mutationFn: (payload: SubmitPayload) => {
      // Session may not exist yet — that's fine, we already marked locally
      if (!sessionId) return Promise.resolve(null);
      return dictationApi.submitAnswer(sessionId, {
        sentence_index: payload.sentenceIndex,
        user_input: payload.userInput,
        hints_used: payload.hintsUsed,
        replay_count: payload.replayCount,
      });
    },
    // Only update the score for the specific sentence — never change phase
    onSuccess: (result, payload) => {
      if (!result) return;
      setResults((prev) =>
        prev.map((r) =>
          r.sentenceIndex === payload.sentenceIndex ? { ...r, score: result.score } : r,
        ),
      );
    },
  });

  // ── Sentence completion (local, immediate) ─────────────────────────────────
  /**
   * FIX: completeSentence is the single source of truth for finishing a sentence.
   * It updates results and phase IMMEDIATELY without waiting for the server,
   * then fires the scoring mutation in the background.
   *
   * This eliminates the dependency chain:
   *   wrong: validateWord → mutate → onSuccess → setPhase → auto-advance
   *   right: validateWord → completeSentence → setPhase → auto-advance
   */
  const completeSentence = useCallback(
    (userInput: string, hintsUsed: number, currentWords: WordState[]) => {
      const totalWrong = currentWords.reduce((acc, w) => acc + w.wrongAttempts, 0);
      // Add result immediately — score starts at 100 (provisional)
      setResults((prev) => [
        ...prev.filter((r) => r.sentenceIndex !== currentIndex), // deduplicate
        {
          sentenceIndex: currentIndex,
          score: 100,
          wrongAttempts: totalWrong,
          correctText: currentSentence?.text ?? '',
        },
      ]);
      setPhase('completed');
      // Submit for real score in background (failure is non-fatal)
      submitMutation.mutate({
        userInput,
        sentenceIndex: currentIndex,
        hintsUsed,
        replayCount: Math.max(0, playCount - 1),
      });
    },
    [currentIndex, currentSentence, playCount, submitMutation],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    if (!currentSentence || !playerRef.current) return;
    autoPlayRef.current = true;
    playerRef.current.currentTime = currentSentence.start_time;
    playerRef.current.playbackRate = playbackRateRef.current;
    playerRef.current.play().catch(() => {});
    setIsPlaying(true);
    setPhase('playing');
    setPlayCount((c) => c + 1);
  }, [currentSentence]);

  const handleRewind = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.currentTime = Math.max(0, playerRef.current.currentTime - 5);
  }, []);

  const handleTimeUpdate = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
      if (phase === 'playing' && currentSentence && e.currentTarget.currentTime >= currentSentence.end_time) {
        e.currentTarget.pause();
        setIsPlaying(false);
        setPhase('practicing');
      }
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
          completeSentence(assembled, showAnswer ? 1 : 0, updated);
        }
      } else {
        // Wrong answer — flash the active chip, clear input, increment attempts
        setWords((prev) =>
          prev.map((w, i) => (i === currentWordIdx ? { ...w, wrongAttempts: w.wrongAttempts + 1 } : w)),
        );
        setFlashingIdx(currentWordIdx);
        setTimeout(() => setFlashingIdx(null), 600);
        setInputValue('');
      }
    },
    [words, currentWordIdx, completeSentence, showAnswer],
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
    },
    [inputValue, validateWord],
  );

  const handleShowAnswer = useCallback(() => {
    if (currentWordIdx >= words.length) return;
    setShowAnswer(true);
    const updated = words.map((w, i) =>
      i >= currentWordIdx ? { ...w, status: 'correct' as WordStatus } : w,
    );
    setWords(updated);
    setCurrentWordIdx(words.length);
    setInputValue('');
    const assembled = updated.map((w) => w.original).join(' ');
    completeSentence(assembled, 1, updated);
  }, [words, currentWordIdx, completeSentence]);

  const handleSkip = useCallback(() => {
    completeSentence('', 0, words);
  }, [completeSentence, words]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= totalSentences) {
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
  }, [currentIndex, totalSentences, results, navigate, videoId, video]);

  // Keep handleNextRef pointing at the latest handleNext without it being
  // a dep of the auto-advance effect (prevents double-trigger).
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  /**
   * FIX: Auto-advance effect.
   * Only depends on [phase] — fires exactly once when phase becomes 'completed'.
   * Reads handleNextRef.current at call time so it always has fresh state.
   * This eliminates the double-trigger caused by handleNext reference churn
   * when results updates in the same render batch as phase.
   */
  useEffect(() => {
    if (phase !== 'completed') return;
    const t = setTimeout(() => handleNextRef.current(), 1000);
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
            <button
              onClick={() => setMuted((m) => !m)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
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
            <div className="w-full rounded-2xl overflow-hidden border border-border bg-black shadow-md aspect-video">
              <ReactPlayer
                ref={playerRef}
                src={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                playing={isPlaying}
                muted={muted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => { setIsPlaying(false); if (phase === 'playing') setPhase('practicing'); }}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                width="100%"
                height="100%"
              />
            </div>

            {/* Player controls */}
            <div className="flex items-center gap-2 bg-muted/40 rounded-2xl px-4 py-3 border border-border">
              <button
                onClick={handleRewind}
                title="Rewind 5s"
                className="p-2 rounded-xl hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipBack className="h-4 w-4" />
              </button>

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

              <div className="flex-1" />

              {/* Playback speed */}
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex gap-0.5">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPlaybackRate(s)}
                      className={cn(
                        'px-2 py-0.5 rounded-lg text-xs font-medium transition-colors',
                        playbackRate === s
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background',
                      )}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sentence practice card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

              {/* Card header */}
              <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold">Sentence {currentIndex + 1}</span>
                  <span className="text-xs text-muted-foreground">of {totalSentences}</span>
                </div>
                {phase !== 'idle' && totalWords > 0 && (
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
                <button
                  onClick={handleNext}
                  disabled={isLastSentence}
                  className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-5">

                {/* Idle prompt */}
                {phase === 'idle' && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-1">
                      <Play className="h-5 w-5 text-muted-foreground fill-current" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Press Play to begin</p>
                    <p className="text-xs text-muted-foreground">
                      Listen to the sentence, then type each word you hear.
                    </p>
                  </div>
                )}

                {/* Word chips — shown while playing, practicing, or completed */}
                {phase !== 'idle' && words.length > 0 && (
                  <div className="flex flex-wrap gap-2 min-h-10">
                    {words.map((word, i) => (
                      <WordChip key={i} word={word} isFlashing={flashingIdx === i} />
                    ))}
                  </div>
                )}

                {/* Input area (desktop) */}
                {(phase === 'practicing' || phase === 'playing') && (
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
                        onClick={handleShowAnswer}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Show answer
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
                    <div
                      className={cn(
                        'flex items-center justify-between px-4 py-3 rounded-xl border',
                        latestResult.score >= 80
                          ? 'bg-green-50 border-green-200'
                          : latestResult.score >= 50
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-red-50 border-red-200',
                      )}
                    >
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
                            ({latestResult.wrongAttempts} wrong {latestResult.wrongAttempts === 1 ? 'attempt' : 'attempts'})
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

                    <div className="bg-muted/40 rounded-xl px-4 py-3 border border-border">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                        Full sentence
                      </p>
                      <p className="text-sm leading-relaxed">{currentSentence?.text}</p>
                    </div>

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

              return (
                <div
                  key={seg.id}
                  data-active={isActive}
                  className={cn(
                    'flex items-start gap-2.5 px-4 py-3 transition-colors',
                    isActive && 'bg-primary/5 border-l-2 border-l-primary',
                    !isActive && 'hover:bg-muted/30',
                    !isDone && !isActive && 'opacity-50',
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
      {(phase === 'practicing' || phase === 'playing') && (
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
            <button
              onClick={handleShowAnswer}
              className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}