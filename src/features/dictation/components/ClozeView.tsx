import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, ArrowRight, Check, X, Loader2, Trophy, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClozeChunks, useSubmitCloze } from '../hooks/useDictation';
import type { ClozeBlankResult, ClozeChunk } from '@/shared/types/api';

interface ClozeViewProps {
  sessionId: string | null;
  onPlaySegment?: (startSec: number, endSec: number) => void;
  onCompleted?: () => void;
  /** Reports progress to the page so it can render a top-level progress bar. */
  onProgress?: (chunkIndex: number, total: number, completed: boolean) => void;
  /** Reports the active chunk's time range so the parent can drive the player. */
  onChunkChange?: (startTime: number, endTime: number) => void;
}

type ChunkAnswers = Record<number, string>;
type ChunkResults = ClozeBlankResult[];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function blankWidth(answerLen: number): number {
  return Math.max(6, Math.min(14, answerLen + 2));   // ch units
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pickMotivation(scorePct: number): string {
  if (scorePct >= 90) return "Outstanding. You're flying through this.";
  if (scorePct >= 75) return 'Strong session. A few more reps and these will be automatic.';
  if (scorePct >= 50) return 'Solid effort — review the misses and run it again.';
  return "Don't worry, dictation is a slow build. Replay the chunks and try once more.";
}

/* ─── Single blank input ─────────────────────────────────────────────────── */

function BlankInput({
  inputRef,
  value,
  expectedLen,
  blankNumber,
  status,
  expected,
  onChange,
  onAdvance,
  disabled,
}: {
  inputRef: (el: HTMLInputElement | null) => void;
  value: string;
  expectedLen: number;
  blankNumber: number;
  status?: 'correct' | 'wrong';
  expected?: string;
  onChange: (next: string) => void;
  onAdvance: () => void;
  disabled?: boolean;
}) {
  const showResult = status !== undefined;
  const correct = status === 'correct';
  const wrong = status === 'wrong';

  return (
    <span className="relative inline-flex items-baseline gap-1.5 align-baseline mx-0.5">
      <span
        className={cn(
          'inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-semibold tabular-nums shrink-0 select-none',
          'border border-foreground/30 text-muted-foreground bg-background',
        )}
        aria-hidden
      >
        {blankNumber}
      </span>
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="off"
        value={value}
        disabled={disabled}
        aria-label={`Blank ${blankNumber}`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdvance();
          }
          // Tab is left native — moves to next focusable input naturally.
        }}
        style={{ width: `${blankWidth(expectedLen)}ch` }}
        className={cn(
          'inline-block h-9 px-1.5 text-lg font-medium tabular-nums text-foreground',
          'bg-transparent border-x-0 border-t-0 border-b-2 rounded-none',
          'focus:outline-none transition-colors',
          !showResult && 'border-border focus:border-foreground',
          correct && 'border-[color:var(--accent-emerald)] focus:border-[color:var(--accent-emerald)]',
          wrong && 'border-destructive focus:border-destructive',
        )}
      />
      {wrong && expected && (
        <span
          className="absolute left-7 top-full mt-0.5 text-[11px] leading-tight text-destructive whitespace-nowrap pointer-events-none"
          aria-live="polite"
        >
          {expected}
        </span>
      )}
    </span>
  );
}

/* ─── Chunk paragraph ────────────────────────────────────────────────────── */

function ChunkParagraph({
  chunk,
  answers,
  setAnswer,
  results,
  inputRefs,
  disabled,
  onSubmitFromLast,
}: {
  chunk: ClozeChunk;
  answers: ChunkAnswers;
  setAnswer: (blankIdx: number, value: string) => void;
  results: ChunkResults | null;
  inputRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  disabled?: boolean;
  onSubmitFromLast: () => void;
}) {
  const advance = (fromBlankIdx: number) => {
    const next = inputRefs.current[fromBlankIdx + 1];
    if (next) {
      next.focus();
      next.select();
      return;
    }
    // Last blank → trigger Check Answers
    inputRefs.current[fromBlankIdx]?.blur();
    onSubmitFromLast();
  };

  return (
    <p className="text-lg leading-[2] tracking-[-0.005em] text-foreground">
      {chunk.tokens.map((tok, i) => {
        if (!tok.is_blank) {
          return <span key={i}>{tok.text}</span>;
        }
        const blankIdx = tok.blank_index ?? 0;
        const result = results?.find((r) => r.blank_index === blankIdx);
        return (
          <BlankInput
            key={`b-${blankIdx}`}
            inputRef={(el) => { inputRefs.current[blankIdx] = el; }}
            value={answers[blankIdx] ?? ''}
            expectedLen={tok.text.length}
            blankNumber={blankIdx + 1}
            status={result?.status}
            expected={result?.expected}
            onChange={(next) => setAnswer(blankIdx, next)}
            onAdvance={() => advance(blankIdx)}
            disabled={disabled}
          />
        );
      })}
    </p>
  );
}

/* ─── Main view ──────────────────────────────────────────────────────────── */

export function ClozeView({ sessionId, onPlaySegment, onCompleted, onProgress, onChunkChange }: ClozeViewProps) {
  const { data, isLoading, isError } = useClozeChunks(sessionId);
  const submitMutation = useSubmitCloze(sessionId);

  const [chunkIndex, setChunkIndex] = useState(0);
  const [answersByChunk, setAnswersByChunk] = useState<Record<number, ChunkAnswers>>({});
  const [resultsByChunk, setResultsByChunk] = useState<Record<number, ChunkResults>>({});
  const [completed, setCompleted] = useState(false);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const chunks = data?.chunks ?? [];
  const chunk = chunks[chunkIndex];
  const isLast = chunkIndex >= chunks.length - 1;
  const currentResults = resultsByChunk[chunkIndex] ?? null;
  const currentAnswers = answersByChunk[chunkIndex] ?? {};

  // Report progress upward whenever it changes
  useEffect(() => {
    if (!chunks.length) return;
    onProgress?.(chunkIndex, chunks.length, completed);
  }, [chunkIndex, chunks.length, completed, onProgress]);

  // Report the active chunk's time range so the parent can drive the player
  useEffect(() => {
    if (!chunk) return;
    onChunkChange?.(chunk.start_time, chunk.end_time);
  }, [chunkIndex, chunk, onChunkChange]);

  // Focus the first blank when entering a fresh chunk (not after submit)
  useEffect(() => {
    if (!chunk || currentResults) return;
    const first = inputRefs.current[0];
    if (first) {
      first.focus();
      first.select();
    }
  }, [chunkIndex, chunk, currentResults]);

  // Reset refs when chunk changes
  useEffect(() => {
    inputRefs.current = {};
  }, [chunkIndex]);

  const setAnswer = (blankIdx: number, value: string) => {
    setAnswersByChunk((prev) => ({
      ...prev,
      [chunkIndex]: { ...(prev[chunkIndex] ?? {}), [blankIdx]: value },
    }));
  };

  const handlePlayChunk = () => {
    if (!chunk) return;
    onPlaySegment?.(chunk.start_time, chunk.end_time);
  };

  const handleCheck = async () => {
    if (!chunk || !sessionId || submitMutation.isPending) return;
    const ordered = Array.from({ length: chunk.blank_count }, (_, i) =>
      currentAnswers[i] ?? '',
    );
    const result = await submitMutation.mutateAsync({
      chunk_index: chunkIndex,
      answers: ordered,
    });
    if (result) {
      setResultsByChunk((prev) => ({ ...prev, [chunkIndex]: result.results }));
    }
  };

  const handleNext = () => {
    if (isLast) {
      setCompleted(true);
      onCompleted?.();
      return;
    }
    setChunkIndex((i) => i + 1);
  };

  const summary = useMemo(() => {
    const submitted = Object.values(resultsByChunk);
    const totalBlanks = submitted.reduce((s, r) => s + r.length, 0);
    const correctBlanks = submitted.reduce(
      (s, r) => s + r.filter((b) => b.status === 'correct').length, 0,
    );
    return {
      totalBlanks,
      correctBlanks,
      wrongBlanks: totalBlanks - correctBlanks,
      score: totalBlanks ? Math.round((correctBlanks / totalBlanks) * 100) : 0,
    };
  }, [resultsByChunk]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Building cloze paragraphs…
      </div>
    );
  }
  if (isError || !chunks.length) {
    return (
      <div className="p-5 text-sm text-destructive">
        Could not load cloze chunks for this session.
      </div>
    );
  }

  if (completed) {
    return (
      <section
        className="bg-card border border-border rounded-xl shadow-soft p-6 sm:p-8 text-center dash-enter"
        style={{ animationDelay: '0ms' }}
      >
        <div className="h-12 w-12 mx-auto rounded-full bg-[color:var(--accent-emerald)]/15 flex items-center justify-center mb-4">
          <Trophy className="h-5 w-5 text-[color:var(--accent-emerald)]" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Session complete</h2>
        <p className="text-5xl font-semibold tabular-nums mt-5 text-[color:var(--accent-emerald)] leading-none">
          {summary.score}%
        </p>
        <div className="mt-5 inline-flex items-center gap-5 text-sm">
          <span className="inline-flex items-center gap-1.5 text-[color:var(--accent-emerald)] font-semibold">
            <Check className="h-4 w-4" />
            {summary.correctBlanks} correct
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="inline-flex items-center gap-1.5 text-destructive font-semibold">
            <X className="h-4 w-4" />
            {summary.wrongBlanks} wrong
          </span>
        </div>
        <p className="mt-5 text-sm text-foreground/85 max-w-md mx-auto leading-relaxed inline-flex items-start gap-2 text-left">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[color:var(--accent-amber)]" />
          <span>{pickMotivation(summary.score)}</span>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 dash-enter" style={{ animationDelay: '0ms' }}>
      {/* Play chunk + timestamp */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handlePlayChunk}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg border border-border bg-card text-sm font-medium hover:border-foreground/60 hover:-translate-y-px shadow-soft transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Play className="h-4 w-4 fill-current" /> Play chunk
        </button>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatTimestamp(chunk.start_time)} – {formatTimestamp(chunk.end_time)}
        </p>
      </div>

      {/* Chunk indicator */}
      <p className="text-sm text-muted-foreground text-center tabular-nums">
        Paragraph {chunkIndex + 1} of {chunks.length}
        <span className="mx-2">·</span>
        {chunk.blank_count} blanks
      </p>

      {/* Paragraph card */}
      <div className="bg-card border border-border rounded-xl shadow-soft px-5 sm:px-8 py-6 sm:py-8">
        <ChunkParagraph
          chunk={chunk}
          answers={currentAnswers}
          setAnswer={setAnswer}
          results={currentResults}
          inputRefs={inputRefs}
          disabled={!!currentResults}
          onSubmitFromLast={handleCheck}
        />
      </div>

      {/* Score row + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {currentResults ? (
          <div className="inline-flex items-center gap-3 text-base">
            <span className="inline-flex items-center gap-1.5 text-[color:var(--accent-emerald)] font-semibold">
              <Check className="h-4 w-4" />
              {currentResults.filter((r) => r.status === 'correct').length} correct
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1.5 text-destructive font-semibold">
              <X className="h-4 w-4" />
              {currentResults.filter((r) => r.status === 'wrong').length} wrong
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-xs">Tab</kbd> next blank
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-xs">Enter</kbd> on the last blank to check
          </p>
        )}

        <div className="flex items-center gap-3 ml-auto">
          {!currentResults ? (
            <button
              type="button"
              onClick={handleCheck}
              disabled={submitMutation.isPending}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-base font-semibold bg-foreground text-background shadow-soft transition-all duration-150 ease-out hover:-translate-y-px disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Check answers
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-base font-semibold bg-[color:var(--accent-emerald)] text-[color:var(--accent-emerald-foreground)] shadow-soft-lg transition-all duration-150 ease-out hover:brightness-110 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent-emerald)]"
            >
              {isLast ? 'Finish session' : 'Next paragraph'}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
