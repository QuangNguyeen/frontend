import { BookOpen, Clock, Loader2, Repeat, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { AdminTimeRange } from '@/shared/types/api';
import { useAdminEngagement } from '../../hooks/useAdmin';

interface MetricTileProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  compact?: boolean;
}

function MetricTile({ label, value, sub, icon: Icon, tone, compact = false }: MetricTileProps) {
  return (
    <div className={`${compact ? 'p-2.5' : 'p-3'} rounded-xl border border-border bg-background`}>
      <div className="flex items-center gap-2">
        <Icon className={`${compact ? 'size-3.5' : 'size-4'} ${tone}`} />
        <p className={compact ? 'text-[10px] font-bold uppercase text-muted-foreground' : 'text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground'}>
          {label}
        </p>
      </div>
      <p className={compact ? 'mt-1 text-xl font-extrabold tabular-nums' : 'mt-1.5 text-2xl font-extrabold tabular-nums'}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

interface EngagementPanelProps {
  timeRange: AdminTimeRange;
  compact?: boolean;
}

export function EngagementPanel({ timeRange, compact = false }: EngagementPanelProps) {
  const { data, isLoading, isError } = useAdminEngagement(timeRange);

  return (
    <Card className={compact ? 'p-4' : 'p-5'}>
      <h3 className={compact ? 'text-sm font-bold' : 'text-base font-bold'}>Learning engagement</h3>

      {isLoading ? (
        <div className={`${compact ? 'mt-3 h-28' : 'mt-4 h-36'} flex items-center justify-center text-muted-foreground`}>
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : isError || !data ? (
        <div className={`${compact ? 'mt-3 h-28' : 'mt-4 h-36'} flex flex-col items-center justify-center gap-2 text-muted-foreground`}>
          <Target className="size-6 opacity-40" />
          <p className="text-sm">Data not yet available</p>
        </div>
      ) : (
        <div className={`${compact ? 'mt-3' : 'mt-4'} grid grid-cols-2 gap-2`}>
          <MetricTile
            label="Completion"
            value={`${data.completion_rate.toFixed(1)}%`}
            sub="of sessions finished"
            icon={Target}
            tone="text-accent-emerald"
            compact={compact}
          />
          <MetricTile
            label="Avg duration"
            value={`${Math.round(data.avg_session_duration)}m`}
            sub="per session"
            icon={Clock}
            tone="text-accent-blue"
            compact={compact}
          />
          <MetricTile
            label="Repeat rate"
            value={`${data.repeat_rate.toFixed(1)}%`}
            sub="users return in 7d"
            icon={Repeat}
            tone="text-accent-yellow"
            compact={compact}
          />
          <MetricTile
            label="Vocab/session"
            value={data.vocab_save_rate.toFixed(1)}
            sub="words saved avg"
            icon={BookOpen}
            tone="text-primary"
            compact={compact}
          />
        </div>
      )}
    </Card>
  );
}
