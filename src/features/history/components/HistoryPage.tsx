import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Calendar,
  Play,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompletedAttempts, useInProgressAttempts } from '../hooks/useHistory';
import { cn } from '@/lib/utils';
import { PageShell, PageHeader, EmptyState, ErrorState, SummaryStrip } from '@/components/patterns';
import type { HistoryAttemptResponse } from '@/shared/types/api';

type Tab = 'completed' | 'in-progress';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function ScoreBadge({ score }: { score: number }) {
  const normalized = score > 0 && score <= 1 ? score * 100 : score;
  return (
    <span
      className={cn(
        'text-xs font-semibold px-2 py-0.5 rounded-full',
        normalized >= 80
          ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
          : normalized >= 60
            ? 'bg-[color:var(--badge-warning)]/15 text-[color:var(--badge-warning)]'
            : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
      )}
    >
      {Math.round(normalized)}%
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-[var(--card-padding)] animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-11 w-[4.5rem] rounded-md bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
        <div className="h-5 w-10 bg-muted rounded-full" />
      </div>
    </div>
  );
}

function CompletedCard({ attempt, onClick }: { attempt: HistoryAttemptResponse; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-lg p-[var(--card-padding)] hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-3">
        {attempt.video_thumbnail && (
          <img
            src={attempt.video_thumbnail}
            alt=""
            className="h-11 w-[4.5rem] rounded-md object-cover bg-muted shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {attempt.video_title}
          </p>
          <div className="flex items-center gap-2.5 mt-0.5 text-xs text-muted-foreground">
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

function InProgressCard({ attempt, onResume }: { attempt: HistoryAttemptResponse; onResume: () => void }) {
  const [current, total] = attempt.progress_str.split('/').map(Number);
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-[var(--card-padding)] hover:border-primary/40 hover:shadow-sm transition-all">
      <div className="flex items-center gap-3">
        {attempt.video_thumbnail && (
          <img
            src={attempt.video_thumbnail}
            alt=""
            className="h-11 w-[4.5rem] rounded-md object-cover bg-muted shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attempt.video_title}</p>
          <div className="flex items-center gap-2.5 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(attempt.updated_at)}
            </span>
            <span className="font-medium text-foreground">
              {attempt.progress_str}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Button size="sm" className="gap-1 shrink-0" onClick={onResume}>
          <Play className="h-3 w-3" />
          Resume
        </Button>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="gap-1">
        <ChevronLeft className="h-3.5 w-3.5" />
        Prev
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {page}/{totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="gap-1">
        Next
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function CompletedTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useCompletedAttempts(page);

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No sessions found"
        description="You haven't completed any dictation sessions yet. Start practicing now!"
        action={{ label: 'Browse Videos', onClick: () => navigate('/library'), icon: <BookOpen className="h-3.5 w-3.5" /> }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((attempt) => (
        <CompletedCard key={attempt.attempt_id} attempt={attempt} onClick={() => navigate(`/result/${attempt.attempt_id}`)} />
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

function InProgressTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useInProgressAttempts(page);

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  if (items.length === 0) {
    return (
      <EmptyState
        title="No sessions in progress"
        description="You don't have any sessions in progress."
        action={{ label: 'Browse Videos', onClick: () => navigate('/library'), icon: <BookOpen className="h-3.5 w-3.5" /> }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((attempt) => (
        <InProgressCard
          key={attempt.attempt_id}
          attempt={attempt}
          onResume={() => {
            const [current] = attempt.progress_str.split('/').map(Number);
            navigate(`/dictation/${attempt.video_id}`, {
              state: { resumeSessionId: attempt.attempt_id, resumeFrom: current },
            });
          }}
        />
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'in-progress', label: 'In Progress' },
];

export function HistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('completed');
  const { data: completedData } = useCompletedAttempts(1);
  const { data: inProgressData } = useInProgressAttempts(1);

  const totalSessions = (completedData?.total ?? 0) + (inProgressData?.total ?? 0);
  const completedItems = completedData?.items ?? [];
  const avgScore = completedItems.length > 0
    ? Math.round(
        completedItems.reduce((sum, a) => {
          const s = a.score != null ? (a.score > 0 && a.score <= 1 ? a.score * 100 : a.score) : 0;
          return sum + s;
        }, 0) / completedItems.filter((a) => a.score != null).length,
      )
    : 0;

  return (
    <PageShell className="min-h-full">
      <PageHeader
        title="Practice History"
        description="Review completed sessions or resume where you left off"
      />

      {totalSessions > 0 && (
        <SummaryStrip
          className="mb-3"
          items={[
            { label: 'sessions', value: totalSessions },
            { label: 'completed', value: completedData?.total ?? 0 },
            ...(avgScore > 0 ? [{ label: 'avg score', value: `${avgScore}%` }] : []),
          ]}
        />
      )}

      <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'completed' ? <CompletedTab /> : <InProgressTab />}
    </PageShell>
  );
}
