import { BarChart3, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  compact?: boolean;
}

export function ChartCard({
  title,
  subtitle,
  isLoading,
  isError,
  isEmpty,
  children,
  className,
  actions,
  compact = false,
}: ChartCardProps) {
  const stateHeight = compact ? 'h-44' : 'h-72';

  return (
    <Card className={`${compact ? 'p-4' : 'p-5'} ${className ?? ''}`}>
      <div className={`${compact ? 'mb-2.5' : 'mb-4'} flex items-start justify-between gap-3`}>
        <div>
          <h3 className={compact ? 'text-sm font-bold' : 'text-base font-bold'}>{title}</h3>
          {subtitle && (
            <p className={compact ? 'mt-0.5 text-xs text-muted-foreground' : 'mt-0.5 text-sm text-muted-foreground'}>{subtitle}</p>
          )}
        </div>
        {actions}
      </div>

      {isLoading ? (
        <div className={`flex ${stateHeight} items-center justify-center text-muted-foreground`}>
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className={`flex ${stateHeight} flex-col items-center justify-center gap-2 text-center text-muted-foreground`}>
          <BarChart3 className="size-8 opacity-40" />
          <p className="text-sm font-medium">Unable to load analytics</p>
          <p className={`${compact ? 'max-w-[220px]' : 'max-w-xs'} text-xs`}>
            Check the admin analytics API or try refreshing this time range.
          </p>
        </div>
      ) : isEmpty ? (
        <div className={`flex ${stateHeight} flex-col items-center justify-center gap-2 text-center text-muted-foreground`}>
          <BarChart3 className="size-8 opacity-40" />
          <p className="text-sm font-medium">No data for this period</p>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
