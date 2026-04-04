import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Calendar,
  Loader2,
  AlertCircle,
  Play,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompletedAttempts, useInProgressAttempts } from '../hooks/useHistory';
import { cn } from '@/lib/utils';
import type { HistoryAttemptResponse } from '@/shared/types/api';

// ─── Constants ───────────────────────────────────────────────────────────────

type Tab = 'completed' | 'in-progress';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'text-sm font-semibold px-2.5 py-1 rounded-full',
        score >= 80
          ? 'bg-green-100 text-green-700'
          : score >= 60
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-red-100 text-red-700',
      )}
    >
      {Math.round(score)}%
    </span>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ tab, onBrowse }: { tab: Tab; onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-foreground mb-1">
        No sessions found
      </p>
      <p className="text-sm text-muted-foreground max-w-xs mb-5">
        {tab === 'completed'
          ? 'You haven\'t completed any dictation sessions yet. Start practicing now!'
          : 'You don\'t have any sessions in progress.'}
      </p>
      <Button size="sm" onClick={onBrowse} className="gap-1.5">
        <BookOpen className="h-4 w-4" />
        Browse Videos
      </Button>
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium">Failed to load data</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground py-16">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Loading...</span>
    </div>
  );
}

// ─── Completed Card ──────────────────────────────────────────────────────────

function CompletedCard({
  attempt,
  onClick,
}: {
  attempt: HistoryAttemptResponse;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {attempt.video_title}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {attempt.completed_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(attempt.completed_at)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {attempt.progress_str}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          {attempt.score != null && <ScoreBadge score={attempt.score} />}
        </div>
      </div>
    </button>
  );
}

// ─── In-Progress Card ────────────────────────────────────────────────────────

function InProgressCard({
  attempt,
  onResume,
}: {
  attempt: HistoryAttemptResponse;
  onResume: () => void;
}) {
  // Parse progress_str like "5/10"
  const [current, total] = attempt.progress_str.split('/').map(Number);
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attempt.video_title}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(attempt.updated_at)}
            </span>
            <span className="font-medium text-foreground">
              Sentence {attempt.progress_str}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={onResume}
        >
          <Play className="h-3.5 w-3.5" />
          Resume
        </Button>
      </div>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        Page {page}/{totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="gap-1"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Completed Tab ───────────────────────────────────────────────────────────

function CompletedTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useCompletedAttempts(page);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  if (items.length === 0) {
    return <EmptyState tab="completed" onBrowse={() => navigate('/library')} />;
  }

  return (
    <div className="space-y-3">
      {items.map((attempt) => (
        <CompletedCard
          key={attempt.attempt_id}
          attempt={attempt}
          onClick={() => navigate(`/result/${attempt.attempt_id}`)}
        />
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

// ��── In-Progress Tab ─────────────���────────────────────────────��──────────────

function InProgressTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useInProgressAttempts(page);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  if (items.length === 0) {
    return <EmptyState tab="in-progress" onBrowse={() => navigate('/library')} />;
  }

  return (
    <div className="space-y-3">
      {items.map((attempt) => (
        <InProgressCard
          key={attempt.attempt_id}
          attempt={attempt}
          onResume={() => {
            const [current] = attempt.progress_str.split('/').map(Number);
            navigate(`/dictation/${attempt.video_id}`, {
              state: {
                resumeSessionId: attempt.attempt_id,
                resumeFrom: current,
              },
            });
          }}
        />
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'in-progress', label: 'In Progress' },
];

export function HistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('completed');

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold">Practice History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review completed sessions or resume where you left off
        </p>
      </div>

      <div className="px-6 py-6 max-w-3xl">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-all',
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'completed' ? <CompletedTab /> : <InProgressTab />}
      </div>
    </div>
  );
}