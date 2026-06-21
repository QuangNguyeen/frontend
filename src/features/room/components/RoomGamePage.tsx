import { useRef, useCallback, useEffect, useState } from 'react';
import {
  Play, Pause, RotateCcw, ChevronRight,
  SkipForward, CheckCircle2, LogOut, ArrowLeft, Users,
} from 'lucide-react';
import { YoutubePlayer } from '@/features/dictation/components/YoutubePlayer';
import type { YoutubePlayerHandle } from '@/features/dictation/components/YoutubePlayer';
import { usePlayerPrefsStore } from '@/features/dictation/hooks/usePlayerPrefsStore';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ExamTimer } from './ExamTimer';
import { LiveLeaderboard } from './LiveLeaderboard';
import { useRoomGame } from '../hooks/useRoomGame';
import type {
  WSGameStart, WSSubmitResult, WSRankingEntry, WSMemberInfo, WSSubmitPayload,
} from '../types/room';

interface RoomGamePageProps {
  gameStart: WSGameStart;
  lastSubmitResult: WSSubmitResult | null;
  rankings: WSRankingEntry[];
  members: WSMemberInfo[];
  currentUserId: string | null;
  onSubmit: (payload: WSSubmitPayload) => void;
  onTimeExpired: () => void;
  onEndEarly: () => void;
}

export function RoomGamePage({
  gameStart,
  lastSubmitResult,
  rankings,
  members,
  currentUserId,
  onSubmit,
  onTimeExpired,
  onEndEarly,
}: RoomGamePageProps) {
  const playerHandle = useRef<YoutubePlayerHandle>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [playPhase, setPlayPhase] = useState<'idle' | 'playing' | 'practicing'>('idle');
  const [showResult, setShowResult] = useState<WSSubmitResult | null>(null);
  const [showExitSummary, setShowExitSummary] = useState(false);

  const autoNext = usePlayerPrefsStore((s) => s.autoNext);
  const toggleAutoNext = usePlayerPrefsStore((s) => s.toggleAutoNext);
  const autoNextRef = useRef(autoNext);
  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);

  const {
    currentSentenceIndex,
    replayCount,
    inputValue,
    setInputValue,
    incrementReplay,
    canReplay,
    handleSubmit: prepareSubmit,
    handleSkip: prepareSkip,
    onSubmitResult,
    isFinished,
    totalSentences,
    sentenceResults,
  } = useRoomGame(gameStart, gameStart.max_replays);

  const currentSentence = gameStart.sentences[currentSentenceIndex] ?? null;

  useEffect(() => {
    if (!lastSubmitResult) return;
    onSubmitResult(lastSubmitResult);
    queueMicrotask(() => setShowResult(lastSubmitResult));

    if (autoNextRef.current) {
      const t = setTimeout(() => {
        setShowResult(null);
        if (currentSentence && playerHandle.current) {
          const nextSentence = gameStart.sentences[lastSubmitResult.sentence_index + 1];
          if (nextSentence) {
            playerHandle.current.seekTo(nextSentence.start_time);
            playerHandle.current.play();
            setIsVideoPlaying(true);
            setPlayPhase('playing');
          }
        }
      }, 2000);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setShowResult(null), 5000);
      return () => clearTimeout(t);
    }
  }, [lastSubmitResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isFinished) {
      inputRef.current?.focus();
    }
  }, [currentSentenceIndex, isFinished]);

  const handlePlay = useCallback(() => {
    if (!currentSentence || !playerHandle.current) return;
    if (replayCount > 0 && !canReplay) return;
    playerHandle.current.seekTo(currentSentence.start_time);
    playerHandle.current.play();
    setIsVideoPlaying(true);
    setPlayPhase('playing');
    incrementReplay();
  }, [currentSentence, replayCount, canReplay, incrementReplay]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (currentSentence && time >= currentSentence.end_time) {
        playerHandle.current?.pause();
        setIsVideoPlaying(false);
        if (playPhase === 'playing') setPlayPhase('practicing');
      }
    },
    [playPhase, currentSentence],
  );

  const handlePlayChange = useCallback(
    (playing: boolean) => {
      setIsVideoPlaying(playing);
      if (!playing && playPhase === 'playing') setPlayPhase('practicing');
    },
    [playPhase],
  );

  const handleFormSubmit = useCallback(() => {
    const payload = prepareSubmit();
    if (payload) {
      onSubmit(payload);
      setPlayPhase('idle');
    }
  }, [prepareSubmit, onSubmit]);

  const handleSkip = useCallback(() => {
    const payload = prepareSkip();
    onSubmit(payload);
    setPlayPhase('idle');
  }, [prepareSkip, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleFormSubmit();
      }
    },
    [handleFormSubmit],
  );

  if (isFinished) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-5">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">All Done!</h2>
          <p className="text-muted-foreground">Waiting for other players to finish…</p>
        </div>
      </div>
    );
  }

  if (showExitSummary) {
    const results = Array.from(sentenceResults.values()).sort(
      (a, b) => a.sentence_index - b.sentence_index,
    );
    const totalScore = results.reduce((s, r) => s + r.final_score, 0);
    const answered = results.filter((r) => !r.is_skipped);
    const avgAccuracy =
      answered.length > 0
        ? answered.reduce((s, r) => s + r.accuracy_score, 0) / answered.length
        : 0;

    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-6 flex flex-col items-center gap-5">
            <div className="text-center">
              <LogOut className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h2 className="text-xl font-bold mb-1">You ended early</h2>
              <p className="text-sm text-muted-foreground">
                {currentSentenceIndex} of {totalSentences} sentences completed
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full">
              <div className="text-center px-4 py-3 bg-card border border-border rounded-xl">
                <p className="text-2xl font-bold tabular-nums">{totalScore.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Score</p>
              </div>
              <div className="text-center px-4 py-3 bg-card border border-border rounded-xl">
                <p className="text-2xl font-bold tabular-nums">{Math.round(avgAccuracy * 100)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Avg Accuracy</p>
              </div>
              <div className="text-center px-4 py-3 bg-card border border-border rounded-xl">
                <p className="text-2xl font-bold tabular-nums">{results.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Answered</p>
              </div>
            </div>

            {results.length > 0 && (
              <div className="w-full">
                <h3 className="text-sm font-semibold mb-2">Sentence Breakdown</h3>
                <div className="bg-card border border-border rounded-xl divide-y divide-border">
                  {results.map((r) => (
                    <div key={r.sentence_index} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-7 text-xs font-medium text-muted-foreground tabular-nums">
                        #{r.sentence_index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        {r.is_skipped ? (
                          <span className="text-xs text-muted-foreground italic">Skipped</span>
                        ) : (
                          <div className="flex flex-wrap gap-0.5">
                            {r.word_diffs.filter(d => d.status !== 'extra').map((d, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'text-xs',
                                  d.status === 'correct'
                                    ? 'text-green-700'
                                    : 'text-red-400 line-through',
                                )}
                              >
                                {d.word}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        'text-sm font-semibold tabular-nums shrink-0',
                        r.is_skipped
                          ? 'text-muted-foreground'
                          : r.accuracy_score >= 0.8
                            ? 'text-green-600'
                            : r.accuracy_score >= 0.5
                              ? 'text-yellow-600'
                              : 'text-red-500',
                      )}>
                        {r.is_skipped ? '0%' : `${Math.round(r.accuracy_score * 100)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={onEndEarly} className="gap-1.5 rounded-xl mt-2">
              <ArrowLeft className="h-4 w-4" />
              Leave Room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center gap-3 z-10">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
            Room Game
          </p>
          <p className="text-sm font-semibold tabular-nums">
            Sentence {currentSentenceIndex + 1} of {totalSentences}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block w-28 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/60 transition-all duration-500 rounded-full"
              style={{ width: `${(currentSentenceIndex / totalSentences) * 100}%` }}
            />
          </div>
          <ExamTimer endsAt={gameStart.exam_ends_at} onExpired={onTimeExpired} />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="End early and exit"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">End Early</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End early?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have completed {currentSentenceIndex} of {totalSentences} sentences.
                  Remaining sentences will be scored as 0. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Going</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setShowExitSummary(true);
                  }}
                >
                  End &amp; Exit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main column */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[900px] mx-auto px-4 py-4 flex flex-col gap-4">
            {/* Video */}
            <div className="rounded-xl overflow-hidden border border-border shadow-soft bg-card shrink-0">
              <YoutubePlayer
                ref={playerHandle}
                videoId={gameStart.youtube_id}
                endTime={currentSentence?.end_time ?? null}
                onTimeUpdate={handleTimeUpdate}
                onPlayChange={handlePlayChange}
              />
            </div>

            {/* Play controls */}
            <div className="flex items-center justify-center gap-3 shrink-0">
              {isVideoPlaying && playPhase !== 'playing' ? (
                <button
                  onClick={() => playerHandle.current?.pause()}
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95 min-w-[110px]"
                >
                  <Pause className="h-3 w-3 fill-current" /> Pause
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  disabled={playPhase === 'playing' || (!canReplay && replayCount > 0)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 h-10 rounded-full text-sm font-medium transition-all min-w-[110px]',
                    playPhase === 'playing'
                      ? 'px-5 bg-primary/10 text-primary cursor-not-allowed'
                      : !canReplay && replayCount > 0
                        ? 'px-5 bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                        : 'px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md active:scale-95',
                  )}
                >
                  {playPhase === 'playing' ? (
                    <><span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Playing…</>
                  ) : replayCount === 0 ? (
                    <><Play className="h-4 w-4 fill-current" /> Play</>
                  ) : (
                    <><RotateCcw className="h-4 w-4" /> Replay ({gameStart.max_replays - replayCount} left)</>
                  )}
                </button>
              )}

              {/* Auto-next toggle */}
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

            {/* Submit result overlay */}
            {showResult && (
              <div className={cn(
                'rounded-xl border p-4 animate-in fade-in slide-in-from-top-2 duration-300',
                showResult.is_skipped
                  ? 'border-muted bg-muted/30'
                  : showResult.accuracy_score >= 0.8
                    ? 'border-green-300 bg-green-50/50'
                    : showResult.accuracy_score >= 0.5
                      ? 'border-yellow-300 bg-yellow-50/50'
                      : 'border-red-300 bg-red-50/50',
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Sentence {showResult.sentence_index + 1}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {showResult.is_skipped ? 'Skipped' : `${Math.round(showResult.accuracy_score * 100)}%`}
                    {!showResult.is_skipped && showResult.time_bonus > 0 && (
                      <span className="text-xs text-green-600 ml-1">
                        +{showResult.time_bonus.toFixed(2)} bonus
                      </span>
                    )}
                  </span>
                </div>
                {showResult.word_diffs.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {showResult.word_diffs.filter(d => d.status !== 'extra').map((d, i) => (
                      <span
                        key={i}
                        className={cn(
                          'text-sm px-1 rounded',
                          d.status === 'correct'
                            ? 'text-green-700'
                            : 'bg-muted text-transparent select-none border-b-2 border-dashed border-muted-foreground/30',
                        )}
                      >
                        {d.status === 'correct' ? d.word : ' '.repeat(Math.max(d.word.length, 3))}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Input card */}
            <div className="bg-card rounded-xl border border-border shadow-soft p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-2xl border-2 border-primary ring-4 ring-primary/10 px-4 py-4 bg-background shadow-sm">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type what you hear…"
                  rows={2}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                />
                {inputValue && (
                  <kbd className="shrink-0 mt-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                    ↵
                  </kbd>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                >
                  <SkipForward className="h-3.5 w-3.5 inline mr-1" />
                  Skip
                </button>
                <Button
                  size="sm"
                  onClick={handleFormSubmit}
                  disabled={!inputValue.trim()}
                  className="gap-1.5 rounded-xl min-w-24"
                >
                  Submit <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard sidebar — desktop */}
        <div className="hidden lg:flex flex-col w-[260px] shrink-0 border-l border-border bg-card">
          <LiveLeaderboard
            rankings={rankings}
            members={members}
            currentUserId={currentUserId}
            totalSentences={totalSentences}
          />
        </div>
      </div>

      {/* Leaderboard — mobile floating button + sheet */}
      <div className="lg:hidden fixed bottom-4 right-4 z-30">
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg">
              <Users className="h-3.5 w-3.5" />
              Leaderboard
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60dvh] p-0 rounded-t-xl overflow-y-auto">
            <LiveLeaderboard
              rankings={rankings}
              members={members}
              currentUserId={currentUserId}
              totalSentences={totalSentences}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
