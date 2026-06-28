import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, AlertCircle, Pause, Play, RotateCcw,
} from 'lucide-react';
import { AppSelect } from '@/components/ui/app-select';
import { YoutubePlayer } from './YoutubePlayer';
import type { YoutubePlayerHandle } from './YoutubePlayer';
import { usePlayerPrefsStore } from '../hooks/usePlayerPrefsStore';
import { useSubmitAnswer } from '../hooks/useDictation';
import { cn } from '@/lib/utils';
import type { SentenceResultResponse, TranscriptResponse, VideoResponse } from '@/shared/types/api';

interface SentenceBuildModeProps {
  video: VideoResponse;
  videoId: string;
  sessionId: string | null;
  sentences: TranscriptResponse[];
  playerHandle: React.RefObject<YoutubePlayerHandle | null>;
  onCompleted: () => void;
}

interface Tile {
  id: number;
  word: string;
}

interface LocalResult {
  sentenceIndex: number;
  userInput: string;
  correctText: string;
  score: number;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_OPTIONS = SPEEDS.map((s) => ({
  value: String(s),
  label: s === 1 ? 'Normal' : `${s}×`,
}));

/** Lowercase + strip punctuation so positional comparison ignores casing/marks. */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

/** Small keyboard-key chip for the shortcut hints (mirrors Sentence Dictation). */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-[6px] border border-border bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </kbd>
  );
}

function shuffle(tiles: Tile[]): Tile[] {
  const next = [...tiles];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  // Avoid handing back the exact original order for multi-word sentences.
  if (next.length > 1 && next.every((t, i) => t.id === i)) {
    [next[0], next[1]] = [next[1], next[0]];
  }
  return next;
}

export function SentenceBuildMode({
  video,
  videoId,
  sessionId,
  sentences,
  playerHandle,
  onCompleted,
}: SentenceBuildModeProps) {
  const navigate = useNavigate();
  const submitMutation = useSubmitAnswer(sessionId);
  const rate = usePlayerPrefsStore((s) => s.rate);
  const setRate = usePlayerPrefsStore((s) => s.setRate);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [phase, setPhase] = useState<'building' | 'checked'>('building');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [serverResults, setServerResults] = useState<Map<number, SentenceResultResponse>>(new Map());
  const playCountRef = useRef(1);

  const totalSentences = sentences.length;
  const currentSentence = sentences[currentIndex];
  const isLastSentence = currentIndex === totalSentences - 1;

  const expectedTokens = useMemo(
    () => (currentSentence?.text ?? '').split(/\s+/).filter(Boolean),
    [currentSentence],
  );

  // One stable shuffle per sentence, dealt once for the whole transcript.
  const tiles = useMemo<Tile[]>(
    () => shuffle(expectedTokens.map((word, id) => ({ id, word }))),
    [expectedTokens],
  );

  // Reset the board when the sentence changes — render-time state adjustment
  // (https://react.dev/learn/you-might-not-need-an-effect), no effect needed.
  if (prevIndex !== currentIndex) {
    setPrevIndex(currentIndex);
    setPlaced([]);
    setPhase('building');
    setHasPlayed(false);
  }

  const placedTiles = useMemo(
    () => placed.map((id) => tiles.find((t) => t.id === id)).filter(Boolean) as Tile[],
    [placed, tiles],
  );
  const bankTiles = useMemo(
    () => tiles.filter((t) => !placed.includes(t.id)),
    [tiles, placed],
  );

  const allPlaced = placed.length === expectedTokens.length && expectedTokens.length > 0;
  const correctByPosition = useCallback(
    (i: number) => placedTiles[i] && normalize(placedTiles[i].word) === normalize(expectedTokens[i]),
    [placedTiles, expectedTokens],
  );
  const isAllCorrect = allPlaced && expectedTokens.every((_, i) => correctByPosition(i));

  // ── Playback (one sentence segment at a time) ──────────────────────────────
  const playSegment = useCallback(() => {
    if (!currentSentence || !playerHandle.current) return;
    playerHandle.current.seekTo(currentSentence.start_time);
    playerHandle.current.play();
    setIsPlaying(true);
    setHasPlayed(true);
  }, [currentSentence, playerHandle]);

  // Auto-play the segment when the sentence changes.
  useEffect(() => {
    if (!currentSentence) return;
    const t = setTimeout(playSegment, 400);
    return () => clearTimeout(t);
  }, [currentIndex, currentSentence, playSegment]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (!currentSentence) return;
      if (isPlaying && time >= currentSentence.end_time) {
        playerHandle.current?.pause();
        setIsPlaying(false);
      }
    },
    [currentSentence, isPlaying, playerHandle],
  );

  const handlePlayChange = useCallback((playing: boolean) => setIsPlaying(playing), []);

  const replaySegment = useCallback(() => {
    // Re-listening after the first play of this sentence counts as a replay.
    if (hasPlayed) playCountRef.current += 1;
    playSegment();
  }, [hasPlayed, playSegment]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      playerHandle.current?.pause();
      setIsPlaying(false);
      return;
    }
    replaySegment();
  }, [isPlaying, playerHandle, replaySegment]);

  const handleSpeedChange = useCallback((speed: string) => {
    const num = Number(speed);
    setRate(num);
    playerHandle.current?.setRate(num);
  }, [playerHandle, setRate]);

  // ── Tile interactions ──────────────────────────────────────────────────────
  const handlePlaceTile = useCallback((id: number) => {
    if (phase === 'checked') return;
    setPlaced((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, [phase]);

  const handleRemoveTile = useCallback((id: number) => {
    if (phase === 'checked') return;
    setPlaced((prev) => prev.filter((x) => x !== id));
  }, [phase]);

  const recordResult = useCallback((score: number, userInput: string) => {
    setResults((prev) => [
      ...prev.filter((r) => r.sentenceIndex !== currentIndex),
      { sentenceIndex: currentIndex, userInput, correctText: currentSentence?.text ?? '', score },
    ]);
  }, [currentIndex, currentSentence]);

  const handleCheck = useCallback(() => {
    if (!allPlaced || phase === 'checked') return;
    const userInput = placedTiles.map((t) => t.word).join(' ');
    setPhase('checked');
    playerHandle.current?.pause();
    setIsPlaying(false);

    const fallbackScore = isAllCorrect ? 100 : 0;
    submitMutation.mutate(
      {
        sentence_index: currentIndex,
        user_input: userInput,
        hints_used: 0,
        replay_count: Math.max(0, playCountRef.current - 1),
      },
      {
        onSuccess: (result) => {
          if (result) {
            setServerResults((prev) => new Map(prev).set(currentIndex, result));
            recordResult(result.score, userInput);
          } else {
            recordResult(fallbackScore, userInput);
          }
        },
        onError: () => recordResult(fallbackScore, userInput),
      },
    );
  }, [allPlaced, phase, placedTiles, isAllCorrect, submitMutation, currentIndex, recordResult, playerHandle]);

  const handleContinue = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= totalSentences) {
      onCompleted();
      const totalScore =
        results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
          : 0;
      navigate(`/result/${videoId}`, {
        state: {
          video,
          results: results
            .slice()
            .sort((a, b) => a.sentenceIndex - b.sentenceIndex)
            .map((r) => ({
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
    playCountRef.current = 1;
    setCurrentIndex(next);
  }, [currentIndex, totalSentences, onCompleted, results, navigate, videoId, video, serverResults]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  // Enter → Check / Continue · Backspace → undo last word · R → replay segment.
  // Skipped when a text field or the speed select is focused so they don't clash.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest('input, textarea, [role="combobox"], [contenteditable="true"]')) return;

      switch (e.key) {
        case 'Enter':
          if (phase === 'checked') {
            e.preventDefault();
            handleContinue();
          } else if (allPlaced) {
            e.preventDefault();
            handleCheck();
          }
          break;
        case 'Backspace':
          if (phase !== 'checked' && placed.length > 0) {
            e.preventDefault();
            setPlaced((prev) => prev.slice(0, -1));
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          replaySegment();
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, allPlaced, placed.length, handleContinue, handleCheck, replaySegment]);

  if (!currentSentence) return null;

  const progress = totalSentences ? ((currentIndex + (phase === 'checked' ? 1 : 0)) / totalSentences) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* ── HEADER — matches Sentence Dictation ── */}
      <header className="shrink-0 h-14 border-b border-border bg-card/95 backdrop-blur flex items-center gap-3 px-4 z-10">
        <Link
          to="/library"
          className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary-soft transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-bold truncate flex-1 min-w-0">{video.title}</h1>
        <span className="text-sm font-bold text-primary-hover bg-primary-soft px-3 py-1.5 rounded-lg tabular-nums shrink-0">
          {currentIndex + 1}/{totalSentences}
        </span>
      </header>

      {/* Progress bar */}
      <div className="shrink-0 h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── BODY — centered column like Sentence Dictation ── */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-3 flex flex-col gap-2.5">
          {/* Video player — full width, height-capped so the board stays on screen */}
          <div className="mx-auto w-full max-w-full rounded-[18px] overflow-hidden border border-border bg-card shadow-soft shrink-0 sm:max-w-[min(100%,calc((100dvh-24rem)*16/9))]">
            <YoutubePlayer
              ref={playerHandle}
              videoId={video.youtube_id}
              onTimeUpdate={handleTimeUpdate}
              onPlayChange={handlePlayChange}
            />
          </div>

          {/* Play controls bar */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2.5 shadow-soft">
            <div className="flex items-center gap-2">
              {isPlaying ? (
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-primary-soft text-primary-hover hover:bg-primary-light/30 transition-all active:scale-95"
                >
                  <Pause className="h-4 w-4 fill-current" /> Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm transition-all active:scale-95"
                >
                  {hasPlayed ? (
                    <><RotateCcw className="h-4 w-4" /> Replay</>
                  ) : (
                    <><Play className="h-4 w-4 fill-current" /> Play</>
                  )}
                </button>
              )}
            </div>

            <AppSelect
              value={String(rate)}
              onValueChange={handleSpeedChange}
              options={SPEED_OPTIONS}
              size="sm"
              triggerClassName="h-9 px-3 rounded-xl text-xs"
            />
          </div>

          {/* Instruction */}
          <p className="text-sm font-medium text-muted-foreground">
            Listen, then tap the words in the order you hear them.
          </p>

          {/* Answer zone */}
          <div
            className={cn(
              'min-h-[112px] rounded-2xl border-2 border-dashed p-3 transition-colors',
              phase === 'checked'
                ? isAllCorrect
                  ? 'border-[color:var(--badge-success)]/40 bg-[color:var(--badge-success)]/5'
                  : 'border-destructive/40 bg-destructive/5'
                : 'border-border bg-card',
            )}
          >
            {placedTiles.length === 0 ? (
              <p className="flex h-[88px] items-center justify-center text-sm text-muted-foreground">
                Tap words below to build the sentence
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {placedTiles.map((tile, i) => {
                  const ok = correctByPosition(i);
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => handleRemoveTile(tile.id)}
                      disabled={phase === 'checked'}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-sm font-medium shadow-soft transition-all active:scale-95',
                        phase === 'checked'
                          ? ok
                            ? 'border-[color:var(--badge-success)]/40 bg-[color:var(--badge-success)]/10 text-[color:var(--badge-success)]'
                            : 'border-destructive/40 bg-destructive/10 text-destructive line-through'
                          : 'border-border bg-background hover:border-foreground/30 cursor-pointer',
                      )}
                    >
                      {tile.word}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Word bank */}
          <div className="flex flex-wrap gap-2 min-h-[48px]">
            {bankTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => handlePlaceTile(tile.id)}
                disabled={phase === 'checked'}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium shadow-soft transition-all hover:border-primary/40 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
              >
                {tile.word}
              </button>
            ))}
          </div>

          {/* Feedback */}
          {phase === 'checked' && (
            <div
              className={cn(
                'rounded-2xl border p-4 animate-in fade-in slide-in-from-bottom-2 duration-200',
                isAllCorrect
                  ? 'border-[color:var(--badge-success)]/30 bg-[color:var(--badge-success)]/10'
                  : 'border-destructive/30 bg-destructive/10',
              )}
            >
              <div className="flex items-center gap-2">
                {isAllCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-[color:var(--badge-success)]" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <p className={cn('text-sm font-bold', isAllCorrect ? 'text-[color:var(--badge-success)]' : 'text-destructive')}>
                  {isAllCorrect ? 'Correct!' : 'Not quite'}
                </p>
              </div>
              {!isAllCorrect && (
                <p className="mt-2 text-sm text-foreground">
                  <span className="font-semibold text-muted-foreground">Answer: </span>
                  {currentSentence.text}
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer actions */}
      <footer className="shrink-0 border-t border-border bg-card/95 backdrop-blur px-4 py-3">
        <div className="mx-auto w-full max-w-4xl flex items-center justify-between gap-3">
          <div className="hidden items-center gap-3 text-xs font-medium text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Enter</Kbd> {phase === 'checked' ? (isLastSentence ? 'Results' : 'Continue') : 'Check'}
            </span>
            {phase !== 'checked' && (
              <span className="inline-flex items-center gap-1.5">
                <Kbd>Backspace</Kbd> Undo
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Kbd>R</Kbd> Replay
            </span>
          </div>
          {phase === 'checked' ? (
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-soft transition-all hover:bg-primary-hover active:scale-95"
            >
              {isLastSentence ? 'See results' : 'Continue'}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheck}
              disabled={!allPlaced}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-soft transition-all hover:bg-primary-hover active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Check className="h-4 w-4" />
              Check
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}