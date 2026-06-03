import { useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { AdminTimeRange } from '@/shared/types/api';
import { AdminPageShell } from '../AdminPageShell';
import { TimeRangeSelector } from '../dashboard/TimeRangeSelector';
import { TrafficChart } from '../dashboard/TrafficChart';
import { StudyHoursChart } from '../dashboard/StudyHoursChart';
import { TopLearnersTable } from '../dashboard/TopLearnersTable';
import { ContentHealthPanel } from '../dashboard/ContentHealthPanel';
import { EngagementPanel } from '../dashboard/EngagementPanel';
import { RecentActivityFeed } from '../dashboard/RecentActivityFeed';

export function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<AdminTimeRange>('7d');
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AdminPageShell
      title="Learning analytics"
      actions={
        <>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} compact />
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
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

      <div className="grid gap-4 xl:grid-cols-2">
        <TrafficChart timeRange={timeRange} />
        <StudyHoursChart timeRange={timeRange} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <TopLearnersTable timeRange={timeRange} />
        <div className="space-y-4">
          <EngagementPanel timeRange={timeRange} />
          <ContentHealthPanel />
        </div>
      </div>

      <RecentActivityFeed />
    </div>
    </AdminPageShell>
  );
}
