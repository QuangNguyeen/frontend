import { useEffect, useMemo, useRef, useState, useCallback, memo, startTransition } from 'react';
import {
  Check, X, Loader2, Trophy, Sparkles, Send, Lightbulb, RotateCcw, Eye,
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
  onWordClick?: (word: string, contextSentence: string, audioStartTime: number, anchorEl: HTMLElement) => void;
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

/* ─── Blank input (before submit) ──────────────────────────────────────── */

const BlankInput = memo(function BlankInput({
  inputRef,
  value,
  expectedLen,
  blankNumber,
  onChange,
  onAdvance,
  hasError,
}: {
  inputRef: (el: HTMLInputElement | null) => void;
  value: string;
  expectedLen: number;
  blankNumber: number;
  onChange: (next: string) => void;
  onAdvance: () => void;
  hasError?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-0.5 align-baseline mx-0.5">
      <span
        className={cn(
          'inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-semibold tabular-nums shrink-0 select-none border bg-background',
          hasError ? 'border-red-400 text-red-500' : 'border-foreground/25 text-muted-foreground',
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
        aria-label={`Blank ${blankNumber}`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            onAdvance();
          }
        }}
        style={{ width: `${blankWidth(expectedLen)}ch` }}
        className={cn(
          'inline-block h-9 px-1.5 text-lg font-medium tabular-nums text-foreground bg-transparent border-0 border-b-2 rounded-none focus:outline-none transition-colors',
          hasError
            ? 'border-red-400 focus:border-red-500'
            : 'border-border focus:border-foreground',
        )}
      />
    </span>
  );
});

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

const ClickableWord = memo(function ClickableWord({
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
  onClick: (anchorEl: HTMLElement) => void;
}) {
  if (!clean) return <>{text}</>;

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => onClick(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e.currentTarget); }
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
});

/* ─── Segment line ──────────────────────────────────────────────────────── */

const SegmentLine = memo(function SegmentLine({
  segment,
  answers,
  setAnswer,
  resultsMap,
  checkedResultsMap,
  inputRefs,
  isActive,
  isSubmitted,
  isChecked,
  onTimestampClick,
  startTime,
  advanceToNext,
  savedWords,
  previewingWord,
  onWordClick,
}: {
  segment: ClozeSegment;
  answers: AnswerMap;
  setAnswer: (blankIdx: number, value: string) => void;
  resultsMap: Map<number, ClozeBlankResult> | null;
  checkedResultsMap: Map<number, ClozeBlankResult> | null;
  inputRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  isActive: boolean;
  isSubmitted: boolean;
  isChecked: boolean;
  onTimestampClick?: (timeSec: number) => void;
  startTime: number;
  advanceToNext: (fromBlankIdx: number) => void;
  savedWords: Set<string>;
  previewingWord: string | null;
  onWordClick: (word: string, contextSentence: string, audioStartTime: number, anchorEl: HTMLElement) => void;
}) {
  const activeResults = resultsMap ?? checkedResultsMap;
  const segResults = segment.tokens
    .filter((t) => t.is_blank && t.blank_index != null)
    .map((t) => activeResults?.get(t.blank_index!))
    .filter(Boolean) as ClozeBlankResult[];
  const segCorrect = segResults.filter((r) => r.status === 'correct').length;
  const segTotal = segResults.length;
  const showResults = isSubmitted || isChecked;
  const wordsClickable = isSubmitted || isChecked;

  return (
    <div
      className={cn(
        'group flex gap-2 py-1.5 px-3 rounded-lg transition-colors duration-200',
        isActive && !showResults && 'bg-primary/8',
        showResults && segTotal > 0 && segCorrect === segTotal && 'bg-[color:var(--accent-emerald)]/5',
        showResults && segTotal > 0 && segCorrect < segTotal && 'bg-destructive/5',
      )}
    >
      <button
        type="button"
        onClick={() => onTimestampClick?.(startTime)}
        className="shrink-0 text-[11px] text-muted-foreground/70 tabular-nums hover:text-foreground transition-colors mt-2 w-9 text-right"
      >
        {formatTimestamp(startTime)}
      </button>

      {/* Inline flow — NOT flex. Preserves whitespace from tok.text (with_ws). */}
      <p className="flex-1 text-lg leading-[2] text-foreground">
        {segment.tokens.map((tok, i) => {
          if (!tok.is_blank) {
            if (wordsClickable) {
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
                        onClick={(anchorEl) => onWordClick(clean, segmentPlainText(segment), segment.start_time, anchorEl)}
                      />
                    );
                  })}
                </span>
              );
            }
            return <span key={i}>{tok.text}</span>;
          }

          const blankIdx = tok.blank_index ?? 0;
          const result = activeResults?.get(blankIdx);

          // After final submit: always show inline answer
          if (isSubmitted && result) {
            const clean = cleanForSave(result.expected);
            const isSaved = savedWords.has(clean);
            const isPreviewing = previewingWord === clean;
            return (
              <span
                key={`b-${blankIdx}`}
                role="button"
                tabIndex={0}
                onClick={(e) => clean && onWordClick(clean, segmentPlainText(segment), segment.start_time, e.currentTarget)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && clean) { e.preventDefault(); onWordClick(clean, segmentPlainText(segment), segment.start_time, e.currentTarget); }
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

          // After check: correct blanks lock in, wrong/unchecked stay as inputs
          if (isChecked && result && result.status === 'correct') {
            return (
              <span key={`b-${blankIdx}`} className="inline-flex items-baseline mx-0.5 border-0 no-underline">
                <span className="inline rounded px-1.5 py-0.5 text-lg font-semibold bg-green-100 text-green-700 border-0 no-underline decoration-transparent">
                  {result.expected} <Check className="inline h-3.5 w-3.5 -mt-0.5" />
                </span>
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
              hasError={isChecked && result?.status === 'wrong'}
            />
          );
        })}
      </p>

      {showResults && segTotal > 0 && (
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
}, (prev, next) => {
  if (prev.segment !== next.segment) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.isSubmitted !== next.isSubmitted) return false;
  if (prev.isChecked !== next.isChecked) return false;
  if (prev.resultsMap !== next.resultsMap) return false;
  if (prev.checkedResultsMap !== next.checkedResultsMap) return false;
  if (prev.savedWords !== next.savedWords) return false;
  if (prev.previewingWord !== next.previewingWord) return false;
  // Only compare answers for this segment's blanks (avoids full AnswerMap reference check)
  for (const tok of prev.segment.tokens) {
    if (tok.is_blank && tok.blank_index != null) {
      if ((prev.answers[tok.blank_index] ?? '') !== (next.answers[tok.blank_index] ?? '')) return false;
    }
  }
  return true;
});

/* ─── Main view ──────────────────────────────────────────────────────────── */

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
  const emptySavedWords = useMemo(() => new Set<string>(), []);
  const savedWords = savedWordsProp ?? emptySavedWords;
  const previewingWord = previewingWordProp;

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitResult, setSubmitResult] = useState<ClozeSubmitAllResponse | null>(null);
  const [checkedResults, setCheckedResults] = useState<Map<number, ClozeBlankResult> | null>(null);
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

  // Low-priority: activeSegmentIdx changes don't need to block typing
  const [activeSegmentIdx, setActiveSegmentIdx] = useState(-1);
  useEffect(() => {
    const idx = (() => {
      for (let i = segments.length - 1; i >= 0; i--) {
        if (currentTime >= segments[i].start_time) return i;
      }
      return -1;
    })();
    startTransition(() => setActiveSegmentIdx(idx));
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

  // Stable callbacks for memoized SegmentLine children
  const setAnswer = useCallback((blankIdx: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [blankIdx]: value }));
    setCheckedResults((prev) => prev ? null : prev);
  }, []);

  const advanceToNext = useCallback((fromBlankIdx: number) => {
    const pos = allBlankIndices.indexOf(fromBlankIdx);
    if (pos < 0) return;
    const nextIdx = allBlankIndices[pos + 1];
    if (nextIdx != null) {
      inputRefs.current[nextIdx]?.focus();
      inputRefs.current[nextIdx]?.select();
    }
  }, [allBlankIndices]);

  const stableOnWordClick = useCallback(
    (word: string, contextSentence: string, audioStartTime: number, anchorEl: HTMLElement) => {
      (onWordClickProp ?? (() => {}))(word, contextSentence, audioStartTime, anchorEl);
    },
    [onWordClickProp],
  );

  const isChecked = checkedResults !== null && !isSubmitted;

  const handleCheck = () => {
    if (!segments.length) return;
    const map = new Map<number, ClozeBlankResult>();
    for (const seg of segments) {
      for (const tok of seg.tokens) {
        if (!tok.is_blank || tok.blank_index == null) continue;
        const idx = tok.blank_index;
        const given = (answers[idx] ?? '').trim();
        if (!given) continue;
        const expected = tok.text;
        const isCorrect = given.toLowerCase() === expected.toLowerCase();
        map.set(idx, {
          blank_index: idx,
          given,
          expected,
          status: isCorrect ? 'correct' : 'wrong',
        });
      }
    }
    setCheckedResults(map);

    // Focus the first wrong or unanswered blank
    for (const idx of allBlankIndices) {
      const r = map.get(idx);
      if (!r || r.status === 'wrong') {
        setTimeout(() => {
          inputRefs.current[idx]?.focus();
          inputRefs.current[idx]?.select();
        }, 100);
        break;
      }
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
    setCheckedResults(null);
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
        <div className="bg-card border border-border rounded-xl shadow-soft p-4 mb-3 text-center dash-enter" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-5 w-5 text-[color:var(--accent-emerald)]" />
            <p className="text-3xl font-semibold tabular-nums text-[color:var(--accent-emerald)] leading-none">
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
          <p className="mt-2 text-xs text-foreground/80 max-w-sm mx-auto leading-relaxed inline-flex items-start gap-1.5 text-left">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[color:var(--accent-amber)]" />
            <span>{pickMotivation(summary.score)}</span>
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-semibold bg-muted text-foreground hover:bg-muted/80 active:scale-[0.97] transition-all duration-150"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      )}

      {/* Word save hint (after check or submit) */}
      {(isSubmitted || isChecked) && (
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
                checkedResultsMap={checkedResults}
                inputRefs={inputRefs}
                isActive={i === activeSegmentIdx && !isSubmitted}
                isSubmitted={isSubmitted}
                isChecked={isChecked}
                onTimestampClick={onTimeSeek}
                startTime={seg.start_time}
                advanceToNext={advanceToNext}
                savedWords={savedWords}
                previewingWord={previewingWord}
                onWordClick={stableOnWordClick}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar — check + submit */}
      {!isSubmitted && (
        <div className="shrink-0 flex items-center justify-between gap-3 pt-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {isChecked
              ? (() => {
                  const correct = Array.from(checkedResults!.values()).filter((r) => r.status === 'correct').length;
                  return (
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3 text-[color:var(--accent-emerald)]" />
                      <span className="text-[color:var(--accent-emerald)] font-semibold">{correct}</span>
                      /{filledCount} correct
                    </span>
                  );
                })()
              : <>{filledCount}/{totalBlanks} filled</>}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheck}
              disabled={filledCount === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold border border-border bg-card text-foreground shadow-soft transition-all duration-150 ease-out hover:bg-muted active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground"
            >
              <Eye className="h-3.5 w-3.5" />
              Check
            </button>
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
        </div>
      )}
    </div>
  );
}
