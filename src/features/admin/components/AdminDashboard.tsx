import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Loader2,
  MessageSquareWarning,
  RefreshCcw,
  SendToBack,
  Users,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminTimeRange } from '@/shared/types/api';
import {
  adminKeys,
  useAdminPublishRequests,
  useAdminStats,
  useAdminTranscriptFeedback,
} from '../hooks/useAdmin';
import { AdminPageShell } from './AdminPageShell';
import { AdminErrorState, AdminLoadingSkeleton } from './AdminStates';
import { TimeRangeSelector } from './dashboard/TimeRangeSelector';
import { KpiCard } from './dashboard/KpiCard';
import { TrafficChart } from './dashboard/TrafficChart';
import { RecentActivityFeed } from './dashboard/RecentActivityFeed';

export function AdminDashboard() {
  const [timeRange, setTimeRange] = useState<AdminTimeRange>('7d');
  const queryClient = useQueryClient();
  const { data: stats, isLoading, isError, isFetching } = useAdminStats();
  const publishRequests = useAdminPublishRequests({
    status: 'pending',
    page: 1,
    page_size: 1,
  }, true);
  const transcriptFeedback = useAdminTranscriptFeedback({
    status: 'pending',
    page: 1,
    page_size: 1,
  }, true);

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.all });
  };

  if (isLoading) {
    return (
      <AdminPageShell title="Admin control center">
        <AdminLoadingSkeleton rows={7} />
      </AdminPageShell>
    );
  }

  if (isError || !stats) {
    return (
      <AdminPageShell title="Admin control center">
        <AdminErrorState
          title="Unable to load admin stats"
          description="Check the API connection or admin permission."
          onRetry={handleRefresh}
        />
      </AdminPageShell>
    );
  }

  const pendingPublishCount = publishRequests.data?.total ?? 0;
  const pendingFeedbackCount = transcriptFeedback.data?.total ?? 0;
  const contentIssues = stats.failed_transcriptions + stats.pending_transcriptions;
  const kpis = [
    {
      label: 'Total Users',
      value: stats.total_users,
      sub: `${stats.new_users_today} new today`,
      icon: Users,
      tone: 'text-accent-blue bg-accent-blue/10',
    },
    {
      label: 'Active Today',
      value: stats.sessions_today,
      sub: 'Study sessions today',
      icon: Activity,
      tone: 'text-accent-emerald bg-accent-emerald/10',
    },
    {
      label: 'Total Videos',
      value: stats.total_videos,
      sub: 'Catalog inventory',
      icon: Video,
      tone: 'text-primary bg-primary-soft',
    },
    {
      label: 'Content Issues',
      value: contentIssues,
      sub: `${stats.failed_transcriptions} failed · ${stats.pending_transcriptions} pending`,
      icon: AlertTriangle,
      tone:
        stats.failed_transcriptions > 0
          ? 'text-destructive bg-destructive/10'
          : 'text-accent-yellow bg-accent-yellow/10',
    },
  ];

  return (
    <AdminPageShell
      title="Admin control center"
      description="System health, traffic, and operational work requiring attention."
      actions={
        <>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} compact />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            Refresh
          </Button>
        </>
      }
    >
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <section aria-labelledby="attention-heading">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="attention-heading" className="text-sm font-bold">Attention required</h2>
          <span className="text-xs text-muted-foreground">Operational queues</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: 'Failed transcriptions',
              count: stats.failed_transcriptions,
              href: '/admin/videos?status=failed',
              icon: AlertTriangle,
              tone: 'text-destructive bg-destructive/10',
            },
            {
              label: 'Publish requests',
              count: pendingPublishCount,
              href: '/admin/publish-requests',
              icon: SendToBack,
              tone: 'text-accent-yellow bg-accent-yellow/10',
            },
            {
              label: 'Transcript feedback',
              count: pendingFeedbackCount,
              href: '/admin/transcript-feedback',
              icon: MessageSquareWarning,
              tone: 'text-accent-blue bg-accent-blue/10',
            },
          ].map(({ label, count, href, icon: Icon, tone }) => (
            <Link
              key={label}
              to={href}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary-soft/40"
            >
              <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-extrabold tabular-nums">{count}</span>
                <span className="block truncate text-xs font-semibold text-muted-foreground">{label}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.75fr)]">
        <TrafficChart timeRange={timeRange} />
        <RecentActivityFeed />
      </div>
    </div>
    </AdminPageShell>
  );
}
