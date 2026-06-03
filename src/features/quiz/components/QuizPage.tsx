import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, RotateCcw,
  ChevronLeft, ChevronRight, Trophy, Loader2,
  AlertCircle, CheckCircle2, XCircle, MinusCircle,
  List, Undo2, Check, SkipForward, RotateCw,
  BookOpen, Headphones,
} from 'lucide-react';
import { YoutubePlayer } from '@/features/dictation/components/YoutubePlayer';
import type { YoutubePlayerHandle } from '@/features/dictation/components/YoutubePlayer';
import { usePlayerPrefsStore } from '@/features/dictation/hooks/usePlayerPrefsStore';
import { useVideo, useVideoTranscripts } from '@/features/library/hooks/useVideos';
import { Button } from '@/components/ui/button';
import { AppSelect } from '@/components/ui/app-select';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type QuizPhase = 'listening' | 'answering' | 'checked';

interface QuizWord {
  id: number;
  text: string;
}

interface SentenceResult {
  sentenceIndex: number;
  score: number;
  userOrder: QuizWord[];
  wordResults: boolean[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitWords(text: string): QuizWord[] {
  return text.split(/\s+/).filter(Boolean).map((w, i) => ({ id: i, text: w }));
}

function shuffleWords(words: QuizWord[]): QuizWord[] {
  if (words.length <= 1) return [...words];
  let shuffled: QuizWord[];
  let attempts = 0;
  do {
    shuffled = [...words];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    attempts++;
  } while (attempts < 10 && shuffled.every((w, i) => w.id === words[i].id));
  return shuffled;
}

function computeScore(original: QuizWord[], userOrder: QuizWord[]): { score: number; wordResults: boolean[] } {
  const wordResults = original.map((w, i) => userOrder[i]?.id === w.id);
  const correctCount = wordResults.filter(Boolean).length;
  const score = original.length > 0 ? Math.round((correctCount / original.length) * 100) : 0;
  return { score, wordResults };
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getGrade(score: number): { letter: string; color: string } {
  if (score >= 90) return { letter: 'S', color: 'text-[color:var(--badge-success)]' };
  if (score >= 80) return { letter: 'A', color: 'text-[color:var(--badge-success)]' };
  if (score >= 70) return { letter: 'B', color: 'text-[color:var(--badge-warning)]' };
  if (score >= 60) return { letter: 'C', color: 'text-[color:var(--badge-warning)]' };
  return { letter: 'D', color: 'text-[color:var(--badge-danger)]' };
}

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[26px] min-h-[22px] items-center justify-center rounded-md border border-border/80 bg-muted/60 px-[7px] py-[2px] text-xs font-bold leading-none text-foreground shadow-[inset_0_-1px_0_rgb(18_38_58_/_0.08)]">
      {children}
    </kbd>
  );
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_OPTIONS = SPEEDS.map((s) => ({
  value: String(s),
  label: s === 1 ? 'Normal' : `${s}×`,
}));

// ─── Main Component ──────────────────────────────────────────────────────────

export function QuizPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const playerHandle = useRef<YoutubePlayerHandle>(null);
  const segmentListRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef(false);

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: video, isLoading: videoLoading, isError: videoError } = useVideo(videoId);
  const { data: rawSentences = [], isLoading: sentencesLoading, transcriptionStatus } = useVideoTranscripts(videoId);

  const sentences = useMemo(
    () => rawSentences.filter((s) => s.text.trim().length > 0),
    [rawSentences],
  );

  // ── Quiz state ───────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>('listening');
  const [originalWords, setOriginalWords] = useState<QuizWord[]>([]);
  const [bankWords, setBankWords] = useState<QuizWord[]>([]);
  const [answerWords, setAnswerWords] = useState<QuizWord[]>([]);
  const [results, setResults] = useState<SentenceResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // ── Persisted preferences ────────────────────────────────────────────────
  const autoNext = usePlayerPrefsStore((s) => s.autoNext);
  const toggleAutoNext = usePlayerPrefsStore((s) => s.toggleAutoNext);
  const autoNextRef = useRef(autoNext);
  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);
  const rate = usePlayerPrefsStore((s) => s.rate);
  const setRate = usePlayerPrefsStore((s) => s.setRate);

  // ── Derived values ───────────────────────────────────────────────────────
  const currentSentence = sentences[currentIndex];
  const totalSentences = sentences.length;
  const isLastSentence = currentIndex === totalSentences - 1;
  const currentResult = results.find((r) => r.sentenceIndex === currentIndex);
  const runningAverage = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 0;

  // ── Initialize sentence on index change ──────────────────────────────────
  useEffect(() => {
    const sentence = sentences[currentIndex];
    if (!sentence) return;

    const existing = results.find((r) => r.sentenceIndex === currentIndex);
    const words = splitWords(sentence.text);
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setOriginalWords(words);

      if (existing) {
        setAnswerWords(existing.userOrder);
        setBankWords([]);
        setPhase('checked');
      } else {
        setBankWords(shuffleWords(words));
        setAnswerWords([]);
        setPhase('listening');
        autoPlayRef.current = true;
      }
    });
    return () => { cancelled = true; };
  }, [currentIndex, sentences]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-play segment ────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoPlayRef.current) return;
    const sentence = sentences[currentIndex];
    if (!sentence || !playerHandle.current) return;
    const t = setTimeout(() => {
      if (!playerHandle.current) return;
      playerHandle.current.seekTo(sentence.start_time);
      playerHandle.current.play();
      setIsVideoPlaying(true);
    }, 150);
    return () => clearTimeout(t);
  }, [currentIndex, sentences]);

  // ── Auto-scroll sidebar ──────────────────────────────────────────────────
  useEffect(() => {
    segmentListRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  // ── Auto-next after check ────────────────────────────────────────────────
  const handleNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (phase !== 'checked') return;
    const t = setTimeout(() => {
      if (autoNextRef.current) handleNextRef.current();
    }, 4000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Playback helpers ─────────────────────────────────────────────────────

  const pausePlayback = useCallback(() => {
    playerHandle.current?.pause();
    setIsVideoPlaying(false);
  }, []);

  const resumePlayback = useCallback(() => {
    if (!currentSentence || !playerHandle.current) return;
    playerHandle.current.seekTo(currentSentence.start_time);
    playerHandle.current.play();
    setIsVideoPlaying(true);
  }, [currentSentence]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    if (!currentSentence || !playerHandle.current) return;
    autoPlayRef.current = true;
    playerHandle.current.seekTo(currentSentence.start_time);
    playerHandle.current.play();
    setIsVideoPlaying(true);
    if (phase !== 'checked') setPhase('listening');
  }, [currentSentence, phase]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (currentSentence && time >= currentSentence.end_time) {
        playerHandle.current?.pause();
        setIsVideoPlaying(false);
        if (phase === 'listening') setPhase('answering');
      }
    },
    [phase, currentSentence],
  );

  const handlePlayChange = useCallback(
    (playing: boolean) => {
      setIsVideoPlaying(playing);
      if (!playing && phase === 'listening') setPhase('answering');
    },
    [phase],
  );

  const handleTapBank = useCallback((word: QuizWord) => {
    if (phase !== 'answering') return;
    setBankWords((prev) => prev.filter((w) => w.id !== word.id));
    setAnswerWords((prev) => [...prev, word]);
  }, [phase]);

  const handleTapAnswer = useCallback((word: QuizWord) => {
    if (phase !== 'answering') return;
    setAnswerWords((prev) => prev.filter((w) => w.id !== word.id));
    setBankWords((prev) => [...prev, word]);
  }, [phase]);

  const handleClear = useCallback(() => {
    if (phase !== 'answering') return;
    setAnswerWords([]);
    setBankWords(shuffleWords(originalWords));
  }, [phase, originalWords]);

  const handleCheck = useCallback(() => {
    if (bankWords.length > 0) return;
    pausePlayback();
    const { score, wordResults } = computeScore(originalWords, answerWords);
    setResults((prev) => [
      ...prev.filter((r) => r.sentenceIndex !== currentIndex),
      { sentenceIndex: currentIndex, score, userOrder: answerWords, wordResults },
    ]);
    setPhase('checked');
  }, [bankWords, originalWords, answerWords, currentIndex, pausePlayback]);

  const handleSkip = useCallback(() => {
    pausePlayback();
    const emptyOrder = originalWords.map(() => ({ id: -1, text: '' }));
    const wordResults = originalWords.map(() => false);
    setResults((prev) => [
      ...prev.filter((r) => r.sentenceIndex !== currentIndex),
      { sentenceIndex: currentIndex, score: 0, userOrder: emptyOrder, wordResults },
    ]);
    setAnswerWords([]);
    setBankWords([]);
    setPhase('checked');
  }, [originalWords, currentIndex, pausePlayback]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= totalSentences) {
      setShowResults(true);
      return;
    }
    setCurrentIndex(next);
  }, [currentIndex, totalSentences]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handleContinue = useCallback(() => {
    resumePlayback();
    handleNext();
  }, [resumePlayback, handleNext]);

  const handleTryAgain = useCallback(() => {
    setResults([]);
    setShowResults(false);
    setCurrentIndex(0);
  }, []);

  const handleSpeedChange = useCallback((speed: string) => {
    const num = Number(speed);
    setRate(num);
    playerHandle.current?.setRate(num);
  }, [setRate]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter' && phase === 'answering' && bankWords.length === 0) {
        e.preventDefault();
        handleCheck();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (phase === 'checked') handleContinue();
        else handleNext();
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePlay();
      }
      if (e.key === 'Backspace' && phase === 'answering' && answerWords.length > 0) {
        const lastWord = answerWords[answerWords.length - 1];
        setAnswerWords((prev) => prev.slice(0, -1));
        setBankWords((prev) => [...prev, lastWord]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [phase, bankWords, answerWords, handleCheck, handleContinue, handleNext, handlePlay]);

  // ── Loading / error guards ───────────────────────────────────────────────

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
        <p className="font-medium">Transcription in progress...</p>
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

  // ── Results overlay ──────────────────────────────────────────────────────

  if (showResults) {
    const totalScore = runningAverage;
    const grade = getGrade(totalScore);
    const perfectCount = results.filter((r) => r.score === 100).length;
    const struggledCount = results.filter((r) => r.score < 60).length;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <header className="shrink-0 h-14 border-b border-border bg-card/95 backdrop-blur flex items-center gap-3 px-4 z-10">
          <Link
            to="/library"
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary-soft transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-bold truncate flex-1 min-w-0">{video.title}</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[560px] mx-auto px-4 py-6 flex flex-col items-center gap-5">
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Quiz Complete!</h2>
              <div className={cn('text-5xl font-extrabold tracking-[-0.03em] tabular-nums', grade.color)}>
                {grade.letter}
              </div>
              <span className={cn(
                'text-sm font-bold px-3 py-1 rounded-full',
                totalScore >= 70
                  ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
                  : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
              )}>
                {totalScore}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full">
              <div className="flex flex-col items-center gap-1 p-3 bg-card rounded-2xl border border-border shadow-soft">
                <span className="text-xl font-bold text-[color:var(--badge-success)]">{perfectCount}</span>
                <span className="text-xs text-muted-foreground font-medium">Perfect</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 bg-card rounded-2xl border border-border shadow-soft">
                <span className="text-xl font-bold">{results.length}</span>
                <span className="text-xs text-muted-foreground font-medium">Total</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-3 bg-card rounded-2xl border border-border shadow-soft">
                <span className="text-xl font-bold text-[color:var(--badge-danger)]">{struggledCount}</span>
                <span className="text-xs text-muted-foreground font-medium">Struggled</span>
              </div>
            </div>

            <div className="flex gap-2.5 w-full">
              <Button variant="outline" className="flex-1 gap-1.5 h-11 rounded-xl font-bold" onClick={handleTryAgain}>
                <RotateCw className="h-4 w-4" /> Try Again
              </Button>
              <Button className="flex-1 gap-1.5 h-11 rounded-xl font-bold" asChild>
                <Link to="/library"><BookOpen className="h-4 w-4" /> Library</Link>
              </Button>
            </div>

            <div className="w-full flex flex-col gap-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sentence Breakdown</h3>
              {results
                .sort((a, b) => a.sentenceIndex - b.sentenceIndex)
                .map((r) => {
                  const sentence = sentences[r.sentenceIndex];
                  if (!sentence) return null;
                  const words = splitWords(sentence.text);
                  return (
                    <div key={r.sentenceIndex} className="p-3 bg-card rounded-xl border border-border shadow-soft">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground">#{r.sentenceIndex + 1}</span>
                        {r.score === 100 ? (
                          <CheckCircle2 className="h-4 w-4 text-[color:var(--badge-success)]" />
                        ) : r.score >= 60 ? (
                          <MinusCircle className="h-4 w-4 text-[color:var(--badge-warning)]" />
                        ) : (
                          <XCircle className="h-4 w-4 text-[color:var(--badge-danger)]" />
                        )}
                        <span className={cn(
                          'ml-auto text-xs font-bold px-2 py-0.5 rounded-lg',
                          r.score >= 80 ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
                            : r.score >= 60 ? 'bg-[color:var(--badge-warning)]/15 text-[color:var(--badge-warning)]'
                            : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
                        )}>
                          {r.score}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {words.map((w, i) => (
                          <span
                            key={w.id}
                            className={cn(
                              'px-2 py-0.5 rounded-lg text-xs font-medium',
                              r.wordResults[i]
                                ? 'bg-[color:var(--badge-success)]/10 text-[color:var(--badge-success)]'
                                : 'bg-[color:var(--badge-danger)]/10 text-[color:var(--badge-danger)]',
                            )}
                          >
                            {w.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main quiz render ─────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── HEADER — matches DictationPage header ── */}
      <header className="shrink-0 h-14 border-b border-border bg-card/95 backdrop-blur flex items-center gap-3 px-4 z-10">
        <Link
          to="/library"
          className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary-soft transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
              Word Ordering
            </p>
          </div>
          <h1 className="text-sm font-bold tracking-tight truncate">{video.title}</h1>
        </div>
        <span className="text-sm font-bold text-primary-hover bg-primary-soft px-3 py-1.5 rounded-lg tabular-nums shrink-0">
          {currentIndex + 1}/{totalSentences}
        </span>
      </header>

      {/* ── BODY — main + right panel ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── CENTER — main practice area ── */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3">

            {/* Video player — stable shell */}
            <div className="rounded-[16px] overflow-hidden border border-border bg-black shadow-soft shrink-0 isolate">
              <div className="relative w-full aspect-video">
                <YoutubePlayer
                  ref={playerHandle}
                  videoId={video.youtube_id}
                  endTime={currentSentence?.end_time ?? null}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayChange={handlePlayChange}
                />
              </div>
            </div>

            {/* ── Practice Control Bar ── */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2.5 shadow-soft">
              <div className="flex items-center gap-2">
                {/* Replay */}
                <button
                  onClick={handlePlay}
                  disabled={phase === 'listening'}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-xl text-[13px] font-bold transition-all active:scale-95',
                    phase === 'listening'
                      ? 'bg-primary-soft text-primary cursor-not-allowed'
                      : 'bg-card border border-border text-foreground hover:border-primary hover:bg-primary-soft',
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Replay
                </button>

                {/* Prev */}
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary-soft disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Play/Pause */}
                {isVideoPlaying ? (
                  <button
                    onClick={pausePlayback}
                    className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-xl text-[13px] font-bold bg-primary-soft text-primary-hover hover:bg-primary-light/30 transition-all active:scale-95"
                  >
                    <Pause className="h-4 w-4 fill-current" /> Pause
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    disabled={phase === 'listening'}
                    className={cn(
                      'inline-flex items-center gap-1.5 h-[38px] px-4 rounded-xl text-[13px] font-bold transition-all active:scale-95',
                      phase === 'listening'
                        ? 'bg-primary-soft text-primary cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
                    )}
                  >
                    {phase === 'listening' ? (
                      <><span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Playing...</>
                    ) : (
                      <><Play className="h-4 w-4 fill-current" /> Play</>
                    )}
                  </button>
                )}

                {/* Next */}
                <button
                  onClick={handleNext}
                  title="Next sentence (Tab)"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary-soft transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Speed selector */}
                <AppSelect
                  value={String(rate)}
                  onValueChange={handleSpeedChange}
                  options={SPEED_OPTIONS}
                  size="sm"
                />

                {/* Auto-Next toggle */}
                <button
                  onClick={toggleAutoNext}
                  title={autoNext ? 'Auto-Next: On' : 'Auto-Next: Off'}
                  className={cn(
                    'flex items-center gap-2 h-9 px-3 text-xs font-semibold rounded-xl border transition-colors',
                    autoNext
                      ? 'border-primary/40 bg-primary-soft text-primary-hover'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-primary-soft',
                  )}
                >
                  <span>Auto</span>
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

            {/* ── Word Ordering Panel ── */}
            <section
              className={cn(
                'relative overflow-hidden rounded-[14px] border bg-card p-4 shadow-soft transition-all duration-200 ease-in-out',
                phase === 'checked' && currentResult
                  ? currentResult.score >= 70
                    ? 'border-[color:var(--badge-success)]/40'
                    : 'border-[color:var(--badge-danger)]/40'
                  : 'border-border',
              )}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">
                    Sentence {currentIndex + 1} <span className="text-muted-foreground font-medium">/ {totalSentences}</span>
                  </span>
                </div>
                <span className={cn(
                  'text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg',
                  phase === 'listening' && 'bg-accent-blue/10 text-accent-blue',
                  phase === 'answering' && 'bg-primary-soft text-primary',
                  phase === 'checked' && currentResult && currentResult.score >= 70 && 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]',
                  phase === 'checked' && currentResult && currentResult.score < 70 && 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
                  phase === 'checked' && !currentResult && 'bg-muted text-muted-foreground',
                )}>
                  {phase === 'listening' && 'Listening'}
                  {phase === 'answering' && 'Build sentence'}
                  {phase === 'checked' && currentResult && currentResult.score === 100 && 'Correct!'}
                  {phase === 'checked' && currentResult && currentResult.score > 0 && currentResult.score < 100 && 'Try again'}
                  {phase === 'checked' && currentResult && currentResult.score === 0 && 'Skipped'}
                  {phase === 'checked' && !currentResult && 'Skipped'}
                </span>
              </div>

              {/* Phase: listening */}
              {phase === 'listening' && (
                <div className="flex flex-col items-center justify-center py-6 gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5 text-primary">
                    <Headphones className="h-5 w-5" />
                    <span className="text-sm font-semibold">Listen carefully...</span>
                  </div>
                  <p className="text-xs text-muted-foreground">The words will appear when the audio finishes</p>
                </div>
              )}

              {/* Phase: answering */}
              {phase === 'answering' && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {/* Answer drop zone */}
                  <div className={cn(
                    'min-h-[56px] max-h-[120px] overflow-y-auto rounded-xl border-2 border-dashed p-3 flex flex-wrap gap-2 transition-all',
                    answerWords.length > 0
                      ? 'border-primary/40 bg-primary-soft/40'
                      : 'border-border bg-muted/30',
                  )}>
                    {answerWords.length === 0 && (
                      <span className="text-[13px] text-muted-foreground/60 self-center mx-auto">
                        Tap words below to build the sentence
                      </span>
                    )}
                    {answerWords.map((word) => (
                      <button
                        key={word.id}
                        onClick={() => handleTapAnswer(word)}
                        className="inline-flex items-center h-[32px] px-2.5 rounded-lg text-sm font-semibold bg-primary-soft border border-primary/30 text-foreground hover:bg-primary/15 active:scale-95 transition-all animate-in fade-in zoom-in-95 duration-150"
                      >
                        {word.text}
                      </button>
                    ))}
                  </div>

                  {/* Word bank */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {bankWords.map((word) => (
                      <button
                        key={word.id}
                        onClick={() => handleTapBank(word)}
                        className="inline-flex items-center h-[34px] px-3 rounded-[10px] text-sm font-semibold bg-card border border-border text-foreground hover:border-primary hover:bg-primary-soft active:scale-95 transition-all animate-in fade-in zoom-in-95 duration-150"
                      >
                        {word.text}
                      </button>
                    ))}
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <KeyboardKey>Enter</KeyboardKey>
                        <span className="text-xs font-semibold text-foreground/70">Check</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <KeyboardKey>R</KeyboardKey>
                        <span className="text-xs font-semibold text-foreground/70">Replay</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <KeyboardKey>⌫</KeyboardKey>
                        <span className="text-xs font-semibold text-foreground/70">Undo</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {answerWords.length > 0 && (
                        <button
                          onClick={handleClear}
                          className="h-[34px] rounded-[10px] px-3 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary-hover flex items-center gap-1.5"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Clear
                        </button>
                      )}
                      <button
                        onClick={handleSkip}
                        className="h-[34px] rounded-[10px] px-3 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary-hover flex items-center gap-1.5"
                      >
                        <SkipForward className="h-3.5 w-3.5" /> Skip
                      </button>
                      <Button
                        size="sm"
                        onClick={handleCheck}
                        disabled={bankWords.length > 0}
                        className="h-[34px] gap-1.5 rounded-[10px] px-4 text-[13px] font-bold transition-all active:scale-95"
                      >
                        <Check className="h-3.5 w-3.5" /> Check
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase: checked */}
              {phase === 'checked' && currentResult && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Feedback box */}
                  <div className={cn(
                    'rounded-xl border px-3 py-2.5',
                    currentResult.score >= 70
                      ? 'border-[color:var(--badge-success)]/25 bg-[color:var(--badge-success)]/10'
                      : 'border-[color:var(--badge-danger)]/25 bg-[color:var(--badge-danger)]/10',
                  )}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 text-sm font-bold',
                        currentResult.score >= 70
                          ? 'text-[color:var(--badge-success)]'
                          : 'text-[color:var(--badge-danger)]',
                      )}>
                        {currentResult.score === 100 ? (
                          <><CheckCircle2 className="h-4 w-4" /> Perfect!</>
                        ) : currentResult.score >= 70 ? (
                          <><CheckCircle2 className="h-4 w-4" /> Good job</>
                        ) : (
                          <><AlertCircle className="h-4 w-4" /> Keep practicing</>
                        )}
                      </span>
                      <span className={cn(
                        'text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-lg',
                        currentResult.score >= 80 ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
                          : currentResult.score >= 50 ? 'bg-[color:var(--badge-warning)]/15 text-[color:var(--badge-warning)]'
                          : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
                      )}>
                        {currentResult.score}%
                      </span>
                    </div>
                  </div>

                  {/* Correct word order */}
                  <div className="flex flex-wrap gap-2">
                    {originalWords.map((word, i) => (
                      <span
                        key={word.id}
                        className={cn(
                          'inline-flex items-center h-[32px] px-2.5 rounded-lg text-sm font-semibold border',
                          currentResult.wordResults[i]
                            ? 'bg-[color:var(--badge-success)]/10 text-[color:var(--badge-success)] border-[color:var(--badge-success)]/30'
                            : 'bg-[color:var(--badge-danger)]/10 text-[color:var(--badge-danger)] border-[color:var(--badge-danger)]/30',
                        )}
                      >
                        {word.text}
                      </span>
                    ))}
                  </div>

                  {/* User's order if imperfect */}
                  {currentResult.score < 100 && currentResult.score > 0 && (
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <p className="text-[11px] text-muted-foreground font-semibold mb-2">Your answer:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {currentResult.userOrder.map((word, i) => (
                          <span
                            key={`user-${i}`}
                            className={cn(
                              'px-2 py-0.5 rounded-lg text-xs font-medium',
                              currentResult.wordResults[i]
                                ? 'text-[color:var(--badge-success)]'
                                : 'text-[color:var(--badge-danger)]',
                            )}
                          >
                            {word.text || '—'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Continue button */}
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-x-3">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <KeyboardKey>Tab</KeyboardKey>
                        <span className="text-xs font-semibold text-foreground/70">Continue</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <KeyboardKey>R</KeyboardKey>
                        <span className="text-xs font-semibold text-foreground/70">Replay</span>
                      </span>
                    </div>
                    <Button
                      onClick={handleContinue}
                      size="default"
                      className="gap-1.5 h-[38px] rounded-[10px] px-4 text-[13px] font-bold transition-all active:scale-95"
                    >
                      {isLastSentence ? (
                        <><Trophy className="h-4 w-4" /> Results</>
                      ) : (
                        <>Continue <ChevronRight className="h-4 w-4" /></>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Checked but skipped (no result match) */}
              {phase === 'checked' && !currentResult && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-bold text-muted-foreground">Skipped</span>
                  <Button
                    onClick={handleContinue}
                    size="default"
                    className="gap-1.5 h-[38px] rounded-[10px] px-4 text-[13px] font-bold transition-all active:scale-95"
                  >
                    {isLastSentence ? (
                      <><Trophy className="h-4 w-4" /> Results</>
                    ) : (
                      <>Continue <ChevronRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              )}
            </section>
          </div>
        </main>

        {/* ── RIGHT PANEL — sentence list (desktop only) ── */}
        <aside className="hidden lg:flex flex-col w-[300px] shrink-0 border-l border-border bg-card min-h-0">
          {/* Panel header */}
          <div className="shrink-0 px-4 py-3 border-b border-border bg-card flex items-center justify-between">
            <span className="text-sm font-bold">Sentences</span>
            <span className="text-xs text-muted-foreground tabular-nums font-medium">
              {currentIndex + 1}/{totalSentences}
            </span>
          </div>
          {/* Progress indicator */}
          <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {totalSentences > 0 ? Math.round((results.length / totalSentences) * 100) : 0}%
            </span>
          </div>
          <div className="shrink-0 h-1.5 bg-primary-soft">
            <div
              className="h-full bg-primary rounded-lg transition-all duration-500 ease-in-out"
              style={{ width: `${totalSentences > 0 ? (results.length / totalSentences) * 100 : 0}%` }}
            />
          </div>
          {/* Scrollable card list */}
          <div ref={segmentListRef} className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-stable">
            {sentences.map((seg, i) => {
              const result = results.find((r) => r.sentenceIndex === i);
              const isActive = i === currentIndex;
              const isDone = !!result;

              return (
                <div
                  key={seg.id}
                  data-active={isActive}
                  onClick={() => !isActive && setCurrentIndex(i)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 transition-all duration-200 ease-in-out cursor-pointer',
                    isActive && 'bg-primary-soft border-primary-light ring-1 ring-primary/20 shadow-soft',
                    isDone && !isActive && 'border-border bg-card hover:bg-primary-soft/40',
                    !isDone && !isActive && 'border-border/50 bg-muted/20 opacity-60 hover:opacity-85',
                  )}
                >
                  {/* Meta row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center">
                      {isDone ? (
                        result!.score >= 80 ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-[color:var(--badge-success)]" />
                        ) : result!.score >= 50 ? (
                          <MinusCircle className="h-4.5 w-4.5 text-[color:var(--badge-warning)]" />
                        ) : (
                          <XCircle className="h-4.5 w-4.5 text-[color:var(--badge-danger)]" />
                        )
                      ) : isActive ? (
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                      )}
                    </span>
                    <span className={cn(
                      'text-sm font-semibold tabular-nums',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}>
                      #{i + 1}
                    </span>
                    {isActive && !isDone && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                        Current
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                      {formatTime(seg.start_time)}
                    </span>
                    {isDone && (
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-lg',
                        result!.score >= 80 ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
                          : result!.score >= 50 ? 'bg-[color:var(--badge-warning)]/15 text-[color:var(--badge-warning)]'
                          : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
                      )}>
                        {Math.round(result!.score)}%
                      </span>
                    )}
                  </div>
                  {/* Sentence text */}
                  <p className={cn(
                    'text-xs leading-snug line-clamp-2',
                    isDone ? 'text-foreground' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}>
                    {isDone ? seg.text : seg.text.replace(/\S/g, '·')}
                  </p>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* ── MOBILE: bottom bar ── */}
      <div className="lg:hidden shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {results.length}/{totalSentences} completed
        </span>
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition-colors">
              <List className="h-4 w-4" /> Sentences
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] p-0 rounded-t-3xl">
            <SheetHeader className="px-4 pt-3 pb-2 border-b border-border">
              <SheetTitle className="text-sm">Sentences — {results.length}/{totalSentences}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-2">
              {sentences.map((seg, i) => {
                const result = results.find((r) => r.sentenceIndex === i);
                const isActive = i === currentIndex;
                const isDone = !!result;
                return (
                  <button
                    key={seg.id}
                    onClick={() => setCurrentIndex(i)}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 mb-1.5 text-left transition-all duration-200',
                      isActive && 'bg-primary/5 border-primary/40 ring-1 ring-primary/20',
                      isDone && !isActive && 'border-border bg-card',
                      !isDone && !isActive && 'border-border/50 bg-muted/20 opacity-50',
                      !isActive && 'hover:border-primary/20',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-sm font-semibold tabular-nums',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}>
                        #{i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                        {formatTime(seg.start_time)}
                      </span>
                      {isDone && result && (
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-lg',
                          result.score >= 80 ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
                            : result.score >= 50 ? 'bg-[color:var(--badge-warning)]/15 text-[color:var(--badge-warning)]'
                            : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
                        )}>
                          {Math.round(result.score)}%
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-sm leading-relaxed line-clamp-2',
                      isDone ? 'text-foreground' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                    )}>
                      {isDone ? seg.text : seg.text.replace(/\S/g, '·')}
                    </p>
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
