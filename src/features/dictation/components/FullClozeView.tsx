import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, X, Loader2, Trophy, Sparkles, Send, Lightbulb, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClozeFullData, useSubmitClozeAll } from '../hooks/useDictation';
import { cleanForSave } from '../hooks/useWordSave';
import type {
  ClozeBlankResult, ClozeSegment, ClozeSubmitAllResponse,
} from '@/shared/types/api';

interface FullClozeViewProps {
  sessionId: string | null;
  videoId: string;
  difficulty: string;
  onTimeSeek?: (timeSec: number) => void;
  onCompleted?: () => void;
  currentTime?: number;
  savedWords?: Set<string>;
  previewingWord?: string | null;
  onWordClick?: (word: string, contextSentence: string, audioStartTime: number) => void;
  onRetry?: () => void;
}

type AnswerMap = Record<number, string>;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function blankWidth(answerLen: number): number {
  return Math.max(5, Math.min(14, answerLen + 2));
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pickMotivation(scorePct: number): string {
  if (scorePct >= 90) return "Outstanding — you nailed nearly every blank.";
  if (scorePct >= 75) return 'Strong session. A few more reps and these will stick.';
  if (scorePct >= 50) return 'Solid effort — review the red blanks and try again.';
  return "Don't sweat it — replay the audio and try once more.";
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function segmentPlainText(seg: ClozeSegment): string {
  return seg.tokens.map((t) => t.text).join('');
}

/* ─── Blank input (before submit) ──────────────��─────────────────────────── */

function BlankInput({
  inputRef,
  value,
  expectedLen,
  blankNumber,
  onChange,
  onAdvance,
}: {
  inputRef: (el: HTMLInputElement | null) => void;
  value: string;
  expectedLen: number;
  blankNumber: number;
  onChange: (next: string) => void;
  onAdvance: () => void;
}) {
  return (
    <span className="inline-flex items-baseline gap-0.5 align-baseline mx-0.5">
      <span
        className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-semibold tabular-nums shrink-0 select-none border border-foreground/25 text-muted-foreground bg-background"
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
        aria-label={`Blank ${blankNumber}`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            onAdvance();
          }
        }}
        style={{ width: `${blankWidth(expectedLen)}ch` }}
        className="inline-block h-9 px-1.5 text-lg font-medium tabular-nums text-foreground bg-transparent border-0 border-b-2 border-border rounded-none focus:border-foreground focus:outline-none transition-colors"
      />
    </span>
  );
}

/* ─── Inline answer reveal (after submit) ���───────────────────────────────── */

function InlineAnswer({ result }: { result: ClozeBlankResult }) {
  const given = result.given.trim();
  const expected = result.expected;

  if (result.status === 'correct') {
    return (
      <span className="inline-flex items-baseline mx-0.5 border-0 no-underline">
        <span className="inline rounded px-1.5 py-0.5 text-lg font-semibold bg-green-100 text-green-700 border-0 no-underline decoration-transparent">
          {expected} <Check className="inline h-3.5 w-3.5 -mt-0.5" />
        </span>
      </span>
    );
  }

  if (!given) {
    return (
      <span className="inline-flex items-baseline mx-0.5 border-0 no-underline">
        <span className="inline rounded px-1.5 py-0.5 text-lg font-semibold bg-amber-50 text-amber-600 border-0 no-underline decoration-transparent">
          {expected}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline mx-0.5 border-0 no-underline">
      <span className="inline rounded px-1.5 py-0.5 text-lg border-0 no-underline decoration-transparent">
        <span className="line-through text-red-500">{truncate(given, 20)}</span>
        {' '}
        <span className="font-semibold text-green-700">{expected}</span>
      </span>
    </span>
  );
}

/* ─── Clickable word (after submit, for word save) ───────────────────────── */

function ClickableWord({
  text,
  clean,
  isSelected,
  isSaved,
  onClick,
}: {
  text: string;
  clean: string;
  isSelected: boolean;
  isSaved: boolean;
  onClick: () => void;
}) {
  if (!clean) return <>{text}</>;

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      className={cn(
        'inline rounded-sm px-0.5 -mx-0.5 transition-colors duration-150 cursor-pointer',
        isSaved && 'bg-green-200/70 text-green-800 cursor-default',
        isSelected && !isSaved && 'bg-yellow-200 text-yellow-900',
        !isSelected && !isSaved && 'hover:bg-yellow-100/60',
      )}
    >
      {isSaved && <Check className="inline h-3 w-3 mr-0.5 -mt-0.5 text-green-600" />}
      {text}
    </span>
  );
}

/* ─── Segment line ────────────��──────────────────────────────────────────── */

function SegmentLine({
  segment,
  answers,
  setAnswer,
  resultsMap,
  inputRefs,
  isActive,
  isSubmitted,
  onTimestampClick,
  advanceToNext,
  savedWords,
  previewingWord,
  onWordClick,
}: {
  segment: ClozeSegment;
  answers: AnswerMap;
  setAnswer: (blankIdx: number, value: string) => void;
  resultsMap: Map<number, ClozeBlankResult> | null;
  inputRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  isActive: boolean;
  isSubmitted: boolean;
  onTimestampClick: () => void;
  advanceToNext: (fromBlankIdx: number) => void;
  savedWords: Set<string>;
  previewingWord: string | null;
  onWordClick: (word: string, contextSentence: string, audioStartTime: number) => void;
}) {
  const segResults = segment.tokens
    .filter((t) => t.is_blank && t.blank_index != null)
    .map((t) => resultsMap?.get(t.blank_index!))
    .filter(Boolean) as ClozeBlankResult[];
  const segCorrect = segResults.filter((r) => r.status === 'correct').length;
  const segTotal = segResults.length;

  return (
    <div
      className={cn(
        'group flex gap-2 py-1.5 px-3 rounded-lg transition-colors duration-200',
        isActive && !isSubmitted && 'bg-primary/8',
        isSubmitted && segTotal > 0 && segCorrect === segTotal && 'bg-[color:var(--accent-emerald)]/5',
        isSubmitted && segTotal > 0 && segCorrect < segTotal && 'bg-destructive/5',
      )}
    >
      <button
        type="button"
        onClick={onTimestampClick}
        className="shrink-0 text-[11px] text-muted-foreground/70 tabular-nums hover:text-foreground transition-colors mt-2 w-9 text-right"
      >
        {formatTimestamp(segment.start_time)}
      </button>

      {/* Inline flow — NOT flex. Preserves whitespace from tok.text (with_ws). */}
      <p className="flex-1 text-lg leading-[2] text-foreground">
        {segment.tokens.map((tok, i) => {
          if (!tok.is_blank) {
            if (isSubmitted) {
              const parts = tok.text.split(/(\s+)/);
              return (
                <span key={i}>
                  {parts.map((part, pi) => {
                    const clean = cleanForSave(part);
                    if (!clean || /^\s+$/.test(part)) return <span key={pi}>{part}</span>;
                    return (
                      <ClickableWord
                        key={pi}
                        text={part}
                        clean={clean}
                        isSelected={previewingWord === clean}
                        isSaved={savedWords.has(clean)}
                        onClick={() => onWordClick(clean, segmentPlainText(segment), segment.start_time)}
                      />
                    );
                  })}
                </span>
              );
            }
            // Pre-submit: render token text as-is (includes trailing whitespace from backend)
            return <span key={i}>{tok.text}</span>;
          }

          const blankIdx = tok.blank_index ?? 0;
          const result = resultsMap?.get(blankIdx);

          if (isSubmitted && result) {
            const clean = cleanForSave(result.expected);
            const isSaved = savedWords.has(clean);
            const isPreviewing = previewingWord === clean;
            return (
              <span
                key={`b-${blankIdx}`}
                role="button"
                tabIndex={0}
                onClick={() => clean && onWordClick(clean, segmentPlainText(segment), segment.start_time)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && clean) { e.preventDefault(); onWordClick(clean, segmentPlainText(segment), segment.start_time); }
                }}
                className={cn(
                  'inline-flex items-baseline cursor-pointer rounded-sm transition-all duration-150',
                  isSaved && 'ring-2 ring-green-400/60 cursor-default',
                  isPreviewing && !isSaved && 'ring-2 ring-yellow-400',
                  !isPreviewing && !isSaved && 'hover:ring-2 hover:ring-yellow-300/50',
                )}
              >
                <InlineAnswer result={result} />
              </span>
            );
          }

          return (
            <BlankInput
              key={`b-${blankIdx}`}
              inputRef={(el) => { inputRefs.current[blankIdx] = el; }}
              value={answers[blankIdx] ?? ''}
              expectedLen={tok.text.length}
              blankNumber={blankIdx + 1}
              onChange={(next) => setAnswer(blankIdx, next)}
              onAdvance={() => advanceToNext(blankIdx)}
            />
          );
        })}
      </p>

      {isSubmitted && segTotal > 0 && (
        <span className={cn(
          'shrink-0 text-[11px] font-semibold tabular-nums self-center px-1.5 py-0.5 rounded-full',
          segCorrect === segTotal
            ? 'bg-[color:var(--accent-emerald)]/15 text-[color:var(--accent-emerald)]'
            : 'bg-destructive/10 text-destructive',
        )}>
          {segCorrect}/{segTotal}
        </span>
      )}
    </div>
  );
}

/* ─── Main view ──────────────��───────────────────────────���───────────────── */

export function FullClozeView({
  sessionId,
  videoId,
  difficulty,
  onTimeSeek,
  onCompleted,
  currentTime = 0,
  savedWords: savedWordsProp,
  previewingWord: previewingWordProp = null,
  onWordClick: onWordClickProp,
  onRetry: onRetryProp,
}: FullClozeViewProps) {
  const { data, isLoading, isError } = useClozeFullData(sessionId, difficulty);
  const submitMutation = useSubmitClozeAll(sessionId);
  const savedWords = savedWordsProp ?? new Set<string>();
  const previewingWord = previewingWordProp;
  const onWordClick = onWordClickProp ?? (() => {});

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitResult, setSubmitResult] = useState<ClozeSubmitAllResponse | null>(null);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const segments = data?.segments ?? [];
  const totalBlanks = data?.total_blanks ?? 0;
  const filledCount = Object.values(answers).filter((v) => v.trim()).length;
  const isSubmitted = !!submitResult;

  const allBlankIndices = useMemo(() => {
    const indices: number[] = [];
    for (const seg of segments) {
      for (const tok of seg.tokens) {
        if (tok.is_blank && tok.blank_index != null) {
          indices.push(tok.blank_index);
        }
      }
    }
    return indices;
  }, [segments]);

  const resultsMap = useMemo(() => {
    if (!submitResult) return null;
    const map = new Map<number, ClozeBlankResult>();
    for (const r of submitResult.results) {
      map.set(r.blank_index, r);
    }
    return map;
  }, [submitResult]);

  const activeSegmentIdx = useMemo(() => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start_time) return i;
    }
    return -1;
  }, [segments, currentTime]);

  useEffect(() => {
    if (activeSegmentIdx < 0 || isSubmitted) return;
    const el = containerRef.current?.querySelector(`[data-seg-idx="${activeSegmentIdx}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSegmentIdx, isSubmitted]);

  useEffect(() => {
    if (!segments.length || isSubmitted) return;
    const firstIdx = allBlankIndices[0];
    if (firstIdx != null) {
      setTimeout(() => inputRefs.current[firstIdx]?.focus(), 200);
    }
  }, [segments.length, allBlankIndices, isSubmitted]);

  const setAnswer = (blankIdx: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [blankIdx]: value }));
  };

  const advanceToNext = (fromBlankIdx: number) => {
    const pos = allBlankIndices.indexOf(fromBlankIdx);
    if (pos < 0) return;
    const nextIdx = allBlankIndices[pos + 1];
    if (nextIdx != null) {
      inputRefs.current[nextIdx]?.focus();
      inputRefs.current[nextIdx]?.select();
    }
  };

  const handleSubmit = async () => {
    if (!data || submitMutation.isPending) return;
    const ordered = allBlankIndices.map((idx) => answers[idx] ?? '');
    const result = await submitMutation.mutateAsync({
      difficulty,
      answers: ordered,
    });
    if (result) {
      setSubmitResult(result);
      onCompleted?.();
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitResult(null);
    onRetryProp?.();
    setTimeout(() => {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      const firstIdx = allBlankIndices[0];
      if (firstIdx != null) {
        setTimeout(() => inputRefs.current[firstIdx]?.focus(), 200);
      }
    }, 100);
  };

  const summary = useMemo(() => {
    if (!submitResult) return null;
    const pct = submitResult.total_count
      ? Math.round((submitResult.correct_count / submitResult.total_count) * 100)
      : 0;
    return {
      score: pct,
      correct: submitResult.correct_count,
      wrong: submitResult.total_count - submitResult.correct_count,
      total: submitResult.total_count,
    };
  }, [submitResult]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Building cloze transcript…
      </div>
    );
  }

  if (isError || !segments.length) {
    return (
      <div className="p-6 text-sm text-destructive">
        Could not load cloze data for this session.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Score banner (after submit) */}
      {summary && (
        <div className="bg-card border border-border rounded-xl shadow-soft p-6 mb-4 text-center dash-enter" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center justify-center gap-3 mb-3">
            <Trophy className="h-5 w-5 text-[color:var(--accent-emerald)]" />
            <p className="text-4xl font-semibold tabular-nums text-[color:var(--accent-emerald)] leading-none">
              {summary.score}%
            </p>
          </div>
          <div className="inline-flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1 text-[color:var(--accent-emerald)] font-semibold">
              <Check className="h-3.5 w-3.5" /> {summary.correct} correct
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-destructive font-semibold">
              <X className="h-3.5 w-3.5" /> {summary.wrong} wrong
            </span>
          </div>
          <p className="mt-3 text-xs text-foreground/80 max-w-sm mx-auto leading-relaxed inline-flex items-start gap-1.5 text-left">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[color:var(--accent-amber)]" />
            <span>{pickMotivation(summary.score)}</span>
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-muted text-foreground hover:bg-muted/80 active:scale-[0.97] transition-all duration-150"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      )}

      {/* Word save hint (after submit) */}
      {isSubmitted && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2 px-1">
          <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
          Click any word to save to flashcards
        </div>
      )}

      {/* Scrollable transcript */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-card border border-border rounded-xl"
      >
        <div className="px-2 sm:px-4 py-4 space-y-0">
          {segments.map((seg, i) => (
            <div key={seg.segment_index} data-seg-idx={i}>
              <SegmentLine
                segment={seg}
                answers={answers}
                setAnswer={setAnswer}
                resultsMap={resultsMap}
                inputRefs={inputRefs}
                isActive={i === activeSegmentIdx && !isSubmitted}
                isSubmitted={isSubmitted}
                onTimestampClick={() => onTimeSeek?.(seg.start_time)}
                advanceToNext={advanceToNext}
                savedWords={savedWords}
                previewingWord={previewingWord}
                onWordClick={onWordClick}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar — submit */}
      {!isSubmitted && (
        <div className="shrink-0 flex items-center justify-between gap-3 pt-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {filledCount}/{totalBlanks} filled
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitMutation.isPending || filledCount === 0}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-foreground text-background shadow-soft transition-all duration-150 ease-out hover:-translate-y-px disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Submit all
          </button>
        </div>
      )}
    </div>
  );
}
