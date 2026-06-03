import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, Loader2, Video, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAdminContentHealth } from '../../hooks/useAdmin';

const statusConfig = [
  { key: 'ready', label: 'Ready', icon: CheckCircle, color: 'text-accent-emerald', bg: 'bg-accent-emerald' },
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-accent-yellow', bg: 'bg-accent-yellow' },
  { key: 'processing', label: 'Processing', icon: Loader2, color: 'text-accent-blue', bg: 'bg-accent-blue' },
  { key: 'failed', label: 'Failed', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive' },
] as const;

interface ContentHealthPanelProps {
  compact?: boolean;
}

export function ContentHealthPanel({ compact = false }: ContentHealthPanelProps) {
  const { data, isLoading, isError } = useAdminContentHealth();

  return (
    <Card className={compact ? 'p-4' : 'p-5'}>
      <h3 className={compact ? 'text-sm font-bold' : 'text-base font-bold'}>Content &amp; transcription health</h3>

      {isLoading ? (
        <div className={`${compact ? 'mt-3 h-24' : 'mt-4 h-36'} flex items-center justify-center text-muted-foreground`}>
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : isError || !data ? (
        <div className={`${compact ? 'mt-3 h-24' : 'mt-4 h-36'} flex flex-col items-center justify-center gap-2 text-muted-foreground`}>
          <Video className="size-6 opacity-40" />
          <p className="text-sm">Data not yet available</p>
        </div>
      ) : (
        <div className={compact ? 'mt-3 space-y-3' : 'mt-4 space-y-4'}>
          <div className="flex items-center gap-2 text-sm">
            <Video className="size-4 text-primary" />
            <span className="font-bold">{data.total_videos}</span>
            <span className="text-muted-foreground">total videos</span>
            {data.curated > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-accent-yellow">{data.curated} curated</span>
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className={`${compact ? 'h-2' : 'h-3'} flex overflow-hidden rounded-full bg-muted`}>
              {statusConfig.map(({ key, bg }) => {
                const count = data[key];
                if (count === 0 || data.total_videos === 0) return null;
                const pct = (count / data.total_videos) * 100;
                return (
                  <div
                    key={key}
                    className={`${bg} transition-all`}
                    style={{ width: `${pct}%`, minWidth: count > 0 ? 4 : 0 }}
                  />
                );
              })}
            </div>

            <div className={`${compact ? 'gap-1.5 text-xs' : 'gap-2 text-sm'} grid grid-cols-2`}>
              {statusConfig.map(({ key, label, icon: Icon, color }) => (
                <div key={key} className="flex items-center gap-2">
                  <Icon className={`size-3.5 ${color}`} />
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-bold tabular-nums">{data[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {data.failed > 0 && (
            <Link
              to="/admin/videos?status=failed"
              className="inline-flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15"
            >
              <AlertTriangle className="size-4" />
              {data.failed} failed — review now
            </Link>
          )}

          {!compact && Object.keys(data.levels).length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                By level
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.levels).map(([level, count]) => (
                  <span
                    key={level}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold tabular-nums"
                  >
                    {level} <span className="text-muted-foreground">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
