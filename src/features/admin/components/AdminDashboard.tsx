import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Clock3,
  Loader2,
  RefreshCcw,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AdminTimeRange } from '@/shared/types/api';
import { adminKeys, useAdminStats } from '../hooks/useAdmin';
import { AdminPageShell } from './AdminPageShell';
import { TimeRangeSelector } from './dashboard/TimeRangeSelector';
import { KpiCard } from './dashboard/KpiCard';
import { TrafficChart } from './dashboard/TrafficChart';
import { StudyHoursChart } from './dashboard/StudyHoursChart';
import { TopLearnersTable } from './dashboard/TopLearnersTable';
import { ContentHealthPanel } from './dashboard/ContentHealthPanel';
import { EngagementPanel } from './dashboard/EngagementPanel';

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function AdminDashboard() {
  const [timeRange, setTimeRange] = useState<AdminTimeRange>('7d');
  const queryClient = useQueryClient();
  const { data: stats, isLoading, isError, isFetching } = useAdminStats();

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.all });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Unable to load admin stats</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Check the API connection or admin permission.
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            Retry
          </Button>
        </div>
      </Card>
    );
  }

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
      sub: 'Users with login or study activity',
      icon: Activity,
      tone: 'text-accent-emerald bg-accent-emerald/10',
    },
    {
      label: 'New Users Today',
      value: stats.new_users_today,
      sub: 'Registered today',
      icon: TrendingUp,
      tone: 'text-primary bg-primary-soft',
    },
    {
      label: 'Total Videos',
      value: stats.total_videos,
      sub: `${stats.pending_transcriptions} pending`,
      icon: Video,
      tone: 'text-primary bg-primary-soft',
    },
    {
      label: 'Total Sessions',
      value: stats.total_sessions,
      sub: `${stats.sessions_today} active today`,
      icon: Clock3,
      tone: 'text-accent-yellow bg-accent-yellow/10',
    },
    {
      label: 'Study Hours',
      value: formatHours(stats.total_sessions * 5),
      sub: 'Estimated from sessions',
      icon: Clock3,
      tone: 'text-accent-blue bg-accent-blue/10',
    },
  ];

  return (
    <AdminPageShell
      title="Admin control center"
      actions={
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-lg border border-border bg-background px-2 py-1 font-semibold text-muted-foreground">
              Vocab <span className="text-foreground">{stats.total_vocabulary_words}</span>
            </span>
            <span
              className={`rounded-lg border px-2 py-1 font-semibold ${
                stats.failed_transcriptions > 0
                  ? 'border-destructive/25 bg-destructive/10 text-destructive'
                  : 'border-border bg-background text-muted-foreground'
              }`}
            >
              Failed <span className="text-foreground">{stats.failed_transcriptions}</span>
            </span>
          </div>
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

      {/* KPI Cards */}
      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} compact />
        ))}
      </div>

      {/* Failed Transcriptions Alert */}
      {stats.failed_transcriptions > 0 && (
        <Card className="border-destructive/30 bg-destructive/10 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <AlertTriangle className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-destructive">
                  Failed transcriptions need attention
                </h3>
                <p className="text-xs text-muted-foreground">
                  {stats.failed_transcriptions} video
                  {stats.failed_transcriptions === 1 ? '' : 's'} failed during STT.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/videos">Review videos</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-3 xl:grid-cols-2">
        <TrafficChart timeRange={timeRange} compact />
        <StudyHoursChart timeRange={timeRange} compact />
      </div>

      {/* Middle Section: Top Learners + Panels */}
      <div className="grid gap-3 xl:grid-cols-[1.45fr_1fr]">
        <TopLearnersTable timeRange={timeRange} compact limit={5} viewAllHref="/admin/analytics" />
        <div className="space-y-3">
          <ContentHealthPanel compact />
          <EngagementPanel timeRange={timeRange} compact />
        </div>
      </div>
    </div>
    </AdminPageShell>
  );
}
