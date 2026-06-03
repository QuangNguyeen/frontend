import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle,
  LogIn,
  Loader2,
  Rss,
  UserPlus,
  Video,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { AdminRecentActivity } from '@/shared/types/api';
import { useAdminRecentActivity } from '../../hooks/useAdmin';

const typeConfig: Record<
  AdminRecentActivity['type'],
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  user_signup: { icon: UserPlus, tone: 'text-accent-blue bg-accent-blue/10' },
  user_login: { icon: LogIn, tone: 'text-accent-emerald bg-accent-emerald/10' },
  session_completed: { icon: CheckCircle, tone: 'text-accent-emerald bg-accent-emerald/10' },
  video_added: { icon: Video, tone: 'text-primary bg-primary-soft' },
  transcription_failed: { icon: AlertTriangle, tone: 'text-destructive bg-destructive/10' },
};

export function RecentActivityFeed() {
  const { data, isLoading, isError } = useAdminRecentActivity();

  return (
    <Card className="p-5">
      <h3 className="text-base font-bold">Recent activity</h3>

      {isLoading ? (
        <div className="mt-4 flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : isError || !data ? (
        <div className="mt-4 flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Rss className="size-6 opacity-40" />
          <p className="text-sm">Activity feed not yet available</p>
        </div>
      ) : data.activities.length === 0 ? (
        <div className="mt-4 flex h-48 items-center justify-center text-sm text-muted-foreground">
          No recent activity.
        </div>
      ) : (
        <div className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
          {data.activities.map((activity) => {
            const config = typeConfig[activity.type];
            const Icon = config.icon;
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/40"
              >
                <span
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${config.tone}`}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
