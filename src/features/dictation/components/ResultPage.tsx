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
            <span key={i} className="text-green-600 font-medium">
              {d.word}
            </span>
          );
        }
        if (d.status === 'wrong') {
          return (
            <span key={i} className="inline-flex flex-col items-center gap-0.5 mx-0.5">
              <span className="text-red-500 line-through text-xs">{d.word}</span>
              {d.expected && <span className="text-green-600 text-xs font-medium">{d.expected}</span>}
            </span>
          );
        }
        return (
          <span key={i} className="inline-flex flex-col items-center gap-0.5 mx-0.5">
            <span className="text-orange-400 text-xs">___</span>
            <span className="text-green-600 text-xs font-medium">{d.word}</span>
          </span>
        );
      })}
    </div>
  );
}

function getGrade(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'S', color: 'text-purple-600', bg: 'bg-purple-100 border-purple-200' };
  if (score >= 80) return { label: 'A', color: 'text-green-600', bg: 'bg-green-100 border-green-200' };
  if (score >= 70) return { label: 'B', color: 'text-blue-600', bg: 'bg-blue-100 border-blue-200' };
  if (score >= 60) return { label: 'C', color: 'text-yellow-600', bg: 'bg-yellow-100 border-yellow-200' };
  return { label: 'D', color: 'text-red-500', bg: 'bg-red-100 border-red-200' };
}

// ─── Sentence Row ─────────────────────────────────────────────────────────────

function SentenceRow({ result, index }: { result: LocalResult; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden transition-all', expanded && 'shadow-sm')}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{index + 1}</span>

        {result.score >= 80 ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        ) : result.score >= 50 ? (
          <MinusCircle className="h-4 w-4 text-yellow-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}

        <p className="text-sm flex-1 truncate text-muted-foreground">{result.correctText}</p>

        <span
          className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0',
            result.score >= 80
              ? 'bg-green-100 text-green-700 border-green-200'
              : result.score >= 50
              ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
              : 'bg-red-100 text-red-700 border-red-200'
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
          {result.userInput ? (
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
    <div className="min-h-full bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col items-center text-center">
          <Trophy className="h-10 w-10 text-primary mb-3" />
          <h1 className="text-2xl font-bold mb-1">Session Complete!</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">{video.title}</p>

          {/* Score */}
          <div
            className={cn(
              'h-24 w-24 rounded-full border-4 flex flex-col items-center justify-center mb-6 shadow-lg',
              grade.bg,
              'border-current'
            )}
          >
            <span className={cn('text-3xl font-black leading-none', grade.color)}>
              {grade.label}
            </span>
            <span className={cn('text-sm font-semibold', grade.color)}>{totalScore}%</span>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-600">{perfectCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Perfect</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold">{results.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-red-500">{poorCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Struggled</p>
            </div>
          </div>

          {/* Stars */}
          <div className="flex gap-1 mt-5">
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
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
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