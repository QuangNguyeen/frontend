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
  ListChecks,
  Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer, PageStickyArea, PageScrollArea, PageHeader, RefreshButton } from '@/components/layout/PageShell';
import { useCompletedAttempts, useInProgressAttempts } from '../hooks/useHistory';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/patterns';
import type { HistoryAttemptResponse } from '@/shared/types/api';

type Tab = 'completed' | 'in-progress';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function parseProgress(progressStr: string): { current: number; total: number; percent: number } {
  const [current, total] = progressStr.split('/').map(Number);
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return {
    current: Number.isFinite(current) ? current : 0,
    total: Number.isFinite(total) ? total : 0,
    percent,
  };
}

function normalizeScore(score: number): number {
  return score > 0 && score <= 1 ? score * 100 : score;
}

function ScoreBadge({ score }: { score: number }) {
  const normalized = normalizeScore(score);
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-lg px-3 text-xs font-bold tabular-nums',
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
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-14 w-22 rounded-xl bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
          <div className="h-1.5 w-full bg-muted rounded-full" />
        </div>
        <div className="h-9 w-20 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

function SessionStatusBadge({ status }: { status: 'completed' | 'in-progress' | 'not-started' }) {
  const label =
    status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In progress' : 'Not started';
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-lg px-3 text-xs font-bold',
        status === 'completed' && 'bg-[color:var(--badge-success)]/12 text-[color:var(--badge-success)]',
        status === 'in-progress' && 'bg-primary-soft text-primary-hover',
        status === 'not-started' && 'bg-accent-orange/10 text-accent-orange',
      )}
    >
      {label}
    </span>
  );
}

function SessionProgressBar({ value, completed }: { value: number; completed?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-lg bg-primary-soft">
      <div
        className={cn(
          'h-full rounded-lg transition-[width] duration-500 ease-out',
          completed ? 'bg-[color:var(--badge-success)]' : 'bg-primary',
        )}
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}

function HistorySessionCard({
  attempt,
  status,
  onAction,
}: {
  attempt: HistoryAttemptResponse;
  status: 'completed' | 'in-progress';
  onAction: () => void;
}) {
  const progress = parseProgress(attempt.progress_str);
  const date = status === 'completed'
    ? attempt.completed_at ?? attempt.updated_at
    : attempt.updated_at;
  const actionLabel = status === 'completed' ? 'Review' : 'Resume';

  return (
    <button
      onClick={onAction}
      className="group w-full rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-all duration-150 hover:border-primary-light hover:shadow-soft-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {attempt.video_thumbnail ? (
          <img
            src={attempt.video_thumbnail}
            alt=""
            className="h-14 w-full rounded-xl object-cover bg-muted sm:w-22 shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="flex h-14 w-full items-center justify-center rounded-xl bg-primary-soft text-primary sm:w-22 shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-base font-bold leading-snug text-foreground line-clamp-2 group-hover:text-primary-hover transition-colors">
              {attempt.video_title}
            </p>
            <SessionStatusBadge status={status} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(date)}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              {status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {attempt.progress_str} sentences
            </span>
          </div>

          <div className="mt-3 max-w-xl">
            <SessionProgressBar value={status === 'completed' ? 100 : progress.percent} completed={status === 'completed'} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:flex-col sm:items-end">
          {attempt.score != null ? <ScoreBadge score={attempt.score} /> : <span />}
          <span
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors',
              status === 'completed'
                ? 'bg-primary-soft text-primary-hover group-hover:bg-primary-light/35'
                : 'bg-primary text-primary-foreground group-hover:bg-primary-hover',
            )}
          >
            {status === 'in-progress' && <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />}
            {actionLabel}
          </span>
        </div>
      </div>
    </button>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
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

function EmptyHistoryState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-soft">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <BookOpen className="h-5 w-5" />
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button className="mt-4" onClick={() => navigate('/library')}>
        Start practice
      </Button>
    </div>
  );
}

function CompletedTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useCompletedAttempts(page);

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  if (items.length === 0) {
    return (
      <EmptyHistoryState
        title="No completed sessions yet"
        description="Finish a dictation lesson to see it here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((attempt) => (
        <HistorySessionCard
          key={attempt.attempt_id}
          attempt={attempt}
          status="completed"
          onAction={() => navigate(`/result/${attempt.attempt_id}`)}
        />
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

function InProgressTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useInProgressAttempts(page);

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  if (items.length === 0) {
    return (
      <EmptyHistoryState
        title="No sessions in progress"
        description="Start a lesson and your active work will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((attempt) => (
        <HistorySessionCard
          key={attempt.attempt_id}
          attempt={attempt}
          status="in-progress"
          onAction={() => {
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

function SummaryStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative min-w-0 rounded-2xl border border-border bg-card px-3 py-3 shadow-soft sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-1.5">
        <p className="min-w-0 truncate pr-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px] sm:tracking-[0.14em]">
          {label}
        </p>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:h-9 sm:w-9">
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      </div>
      <p className="mt-3 truncate text-xl font-extrabold leading-none tracking-normal text-foreground tabular-nums sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function ProgressSummaryStats({
  sessions,
  completed,
  avgScore,
}: {
  sessions: number;
  completed: number;
  avgScore: number;
}) {
  return (
    <section className="grid grid-cols-3 gap-2 sm:gap-4">
      <SummaryStatCard label="Sessions" value={sessions} icon={ListChecks} />
      <SummaryStatCard label="Completed" value={completed} icon={CheckCircle2} />
      <SummaryStatCard label="Avg score" value={`${avgScore}%`} icon={Percent} />
    </section>
  );
}

function ProgressTabs({
  activeTab,
  onChange,
  completedCount,
  inProgressCount,
}: {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
  completedCount: number;
  inProgressCount: number;
}) {
  const counts: Record<Tab, number> = {
    completed: completedCount,
    'in-progress': inProgressCount,
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex rounded-xl border border-primary/20 bg-primary-soft/80 p-1 shadow-soft dark:border-primary/25 dark:bg-primary-soft/45">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                'flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-bold transition-all',
                active
                  ? 'bg-card text-primary-hover shadow-soft ring-1 ring-border/70 dark:bg-primary dark:text-primary-foreground dark:ring-primary/30'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground dark:text-muted-foreground dark:hover:bg-card/35 dark:hover:text-foreground',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs tabular-nums',
                  active
                    ? 'bg-primary-soft text-primary-hover dark:bg-primary-foreground/18 dark:text-primary-foreground'
                    : 'bg-card/70 text-muted-foreground dark:bg-card/45 dark:text-muted-foreground',
                )}
              >
                {counts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HistoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('completed');
  const { data: completedData, refetch: refetchCompleted } = useCompletedAttempts(1);
  const { data: inProgressData, refetch: refetchInProgress } = useInProgressAttempts(1);

  const totalSessions = (completedData?.total ?? 0) + (inProgressData?.total ?? 0);
  const completedItems = completedData?.items ?? [];
  const scoredItems = completedItems.filter((a) => a.score != null);
  const avgScore = scoredItems.length > 0
    ? Math.round(scoredItems.reduce((sum, a) => sum + normalizeScore(a.score!), 0) / scoredItems.length)
    : 0;

  const handleRefresh = () => {
    void refetchCompleted();
    void refetchInProgress();
  };

  return (
    <PageContainer>
      <PageStickyArea>
        <PageHeader
          title="Learning History"
          actions={<RefreshButton onClick={handleRefresh} />}
        />

        <ProgressSummaryStats
          sessions={totalSessions}
          completed={completedData?.total ?? 0}
          avgScore={avgScore}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold text-foreground">Sessions</p>
            <p className="text-sm text-muted-foreground">
              Continue practice or review previous results.
            </p>
          </div>
          <ProgressTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            completedCount={completedData?.total ?? 0}
            inProgressCount={inProgressData?.total ?? 0}
          />
        </div>
      </PageStickyArea>

      <PageScrollArea>
        {activeTab === 'completed' ? <CompletedTab /> : <InProgressTab />}
      </PageScrollArea>
    </PageContainer>
  );
}
