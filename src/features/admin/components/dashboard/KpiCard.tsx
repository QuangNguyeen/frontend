import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: LucideIcon;
  tone: string;
  trend?: number | null;
  compact?: boolean;
}

function formatNumber(v: number | string) {
  if (typeof v === 'string') return v;
  return new Intl.NumberFormat().format(v);
}

export function KpiCard({ label, value, sub, icon: Icon, tone, trend, compact = false }: KpiCardProps) {
  return (
    <Card className={compact ? 'min-h-[82px] p-3.5' : 'min-h-[92px] rounded-xl p-2 sm:min-h-0 sm:rounded-2xl sm:p-4'}>
      <div className={compact ? 'flex items-start justify-between gap-2' : 'flex items-start justify-between gap-1.5 sm:gap-3'}>
        <div className="min-w-0">
          <p className={compact ? 'truncate text-[11px] font-bold uppercase text-muted-foreground' : 'truncate text-[8px] font-bold uppercase tracking-[0.06em] text-muted-foreground sm:text-xs sm:tracking-[0.12em]'}>
            {label}
          </p>
          <div className={compact ? 'mt-1 flex items-baseline gap-1.5' : 'mt-1.5 flex items-baseline gap-1 sm:mt-2 sm:gap-2'}>
            <p className={compact ? 'text-2xl font-extrabold tabular-nums tracking-tight' : 'text-xl font-extrabold tabular-nums tracking-tight sm:text-3xl'}>
              {formatNumber(value)}
            </p>
            {trend != null && trend !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                  trend > 0 ? 'text-accent-emerald' : 'text-destructive'
                }`}
              >
                {trend > 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {trend > 0 ? '+' : ''}
                {trend.toFixed(1)}%
              </span>
            )}
          </div>
          {sub && (
            <p className={compact ? 'mt-0.5 truncate text-xs text-muted-foreground' : 'mt-1 truncate text-[10px] text-muted-foreground sm:text-sm'}>{sub}</p>
          )}
        </div>
        <span
          className={`${compact ? 'size-8 rounded-lg' : 'size-7 rounded-lg sm:size-11 sm:rounded-xl'} inline-flex shrink-0 items-center justify-center ${tone}`}
        >
          <Icon className={compact ? 'size-4' : 'size-3.5 sm:size-5'} />
        </span>
      </div>
    </Card>
  );
}
