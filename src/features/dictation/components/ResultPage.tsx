import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Trophy,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WordDiffItem } from '@/shared/types/api';
import type { VideoResponse } from '@/shared/types/api';

interface LocalResult {
  sentenceIndex: number;
  userInput: string;
  correctText: string;
  score: number;
  wordDiffs: WordDiffItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function WordDiffDisplay({ diffs }: { diffs: WordDiffItem[] }) {
  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-sm leading-loose">
      {diffs.map((d, i) => {
        if (d.status === 'correct') {
          return (
            <span key={i} className="text-[color:var(--badge-success)] font-medium">
              {d.word}
            </span>
          );
        }
        if (d.status === 'wrong') {
          return (
            <span key={i} className="inline-flex flex-col items-center gap-0.5 mx-0.5">
              <span className="text-destructive line-through text-xs">{d.word}</span>
              {d.expected && <span className="text-[color:var(--badge-success)] text-xs font-medium">{d.expected}</span>}
            </span>
          );
        }
        return (
          <span key={i} className="inline-flex flex-col items-center gap-0.5 mx-0.5">
            <span className="text-accent-orange text-xs">___</span>
            <span className="text-[color:var(--badge-success)] text-xs font-medium">{d.word}</span>
          </span>
        );
      })}
    </div>
  );
}

function getGrade(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'S', color: 'text-accent-emerald', bg: 'bg-accent-emerald/10 border-accent-emerald/30' };
  if (score >= 80) return { label: 'A', color: 'text-accent-emerald', bg: 'bg-accent-emerald/10 border-accent-emerald/30' };
  if (score >= 70) return { label: 'B', color: 'text-accent-amber', bg: 'bg-accent-amber/10 border-accent-amber/30' };
  if (score >= 60) return { label: 'C', color: 'text-accent-amber', bg: 'bg-accent-amber/10 border-accent-amber/30' };
  return { label: 'D', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30' };
}

/** Score → semantic ring color following the redesign's emerald/amber/rose logic. */
function scoreColorVar(score: number): string {
  if (score >= 80) return 'var(--accent-emerald)';
  if (score >= 50) return 'var(--accent-amber)';
  return 'var(--destructive)';
}

const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 42;

// ─── Sentence Row ─────────────────────────────────────────────────────────────

function SentenceRow({ result, index }: { result: LocalResult; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('border border-border rounded-2xl overflow-hidden bg-card transition-all', expanded && 'shadow-sm')}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{index + 1}</span>

        {result.score >= 80 ? (
          <CheckCircle2 className="h-4 w-4 text-[color:var(--badge-success)] shrink-0" />
        ) : result.score >= 50 ? (
          <MinusCircle className="h-4 w-4 text-accent-yellow shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
        )}

        <p className="text-sm flex-1 truncate text-muted-foreground">{result.correctText}</p>

        <span
          className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-lg border shrink-0',
            result.score >= 80
              ? 'bg-[color:var(--badge-success)]/10 text-[color:var(--badge-success)] border-[color:var(--badge-success)]/20'
              : result.score >= 50
              ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          )}
        >
          {result.score}%
        </span>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10 space-y-3">
          {result.userInput && result.wordDiffs.length > 0 ? (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Your answer</p>
                <p className="text-sm text-muted-foreground italic">"{result.userInput}"</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Word analysis</p>
                <WordDiffDisplay diffs={result.wordDiffs} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Skipped</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as {
    video?: VideoResponse;
    results?: LocalResult[];
    totalScore?: number;
  } | null;

  // Fallback if navigated directly without state
  if (!state?.results || !state?.video) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="text-center">
          <p className="font-medium mb-2">No session data found</p>
          <Link to="/library" className="text-sm text-muted-foreground underline">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const { video, results, totalScore = 0 } = state;
  const grade = getGrade(totalScore);
  const perfectCount = results.filter((r) => r.score === 100).length;
  const poorCount = results.filter((r) => r.score < 50).length;

  return (
    <div className="app-page">
      {/* Hero */}
      <div className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-6 py-7 flex flex-col items-center text-center">
          <Trophy className="h-8 w-8 text-primary mb-2" />
          <h1 className="text-xl font-bold mb-1">Session Complete!</h1>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">{video.title}</p>

          {/* Visceral score gauge */}
          <div className="relative h-28 w-28 mb-5">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={scoreColorVar(totalScore)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={GAUGE_CIRCUMFERENCE}
                strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - Math.min(Math.max(totalScore, 0), 100) / 100)}
                className="transition-all duration-700 ease-in-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold leading-none tracking-[-0.03em] tabular-nums" style={{ color: scoreColorVar(totalScore) }}>
                {totalScore}
                <span className="text-base align-top">%</span>
              </span>
              <span className={cn('text-xs font-bold mt-0.5', grade.color)}>Grade {grade.label}</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            <div className="bg-card border border-border rounded-xl p-2.5 text-center shadow-soft transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-soft-lg">
              <p className="text-lg font-bold text-accent-emerald tabular-nums">{perfectCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Perfect</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-2.5 text-center shadow-soft transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-soft-lg">
              <p className="text-lg font-bold tabular-nums">{results.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-2.5 text-center shadow-soft transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-soft-lg">
              <p className="text-lg font-bold text-destructive tabular-nums">{poorCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Struggled</p>
            </div>
          </div>

          {/* Stars */}
          <div className="flex gap-1 mt-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-5 w-5 transition-colors',
                  i < Math.round(totalScore / 20)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-muted-foreground/30'
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-5 space-y-5">
        {/* CTA buttons */}
        <div className="flex gap-3">
          <Button
            className="flex-1 gap-2"
            onClick={() => navigate(`/dictation/${sessionId}`)}
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate('/library')}>
            <BookOpen className="h-4 w-4" />
            Library
          </Button>
        </div>

        {/* Sentence breakdown */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Sentence Breakdown
          </h2>
          <div className="space-y-2">
            {results.map((result, i) => (
              <SentenceRow key={i} result={result} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
