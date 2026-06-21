import { cn } from '@/lib/utils';
import type { AdminTimeRange } from '@/shared/types/api';

const ranges: { value: AdminTimeRange; label: string; shortLabel: string }[] = [
  { value: '1d', label: 'Today', shortLabel: '1d' },
  { value: '7d', label: '7 days', shortLabel: '7d' },
  { value: '30d', label: '30 days', shortLabel: '30d' },
  { value: '90d', label: '90 days', shortLabel: '90d' },
];

interface TimeRangeSelectorProps {
  value: AdminTimeRange;
  onChange: (range: AdminTimeRange) => void;
  compact?: boolean;
}

export function TimeRangeSelector({ value, onChange, compact = false }: TimeRangeSelectorProps) {
  return (
    <div className={`${compact ? 'rounded-lg p-0.5' : 'rounded-xl p-1'} flex border border-border bg-background`}>
      {ranges.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          className={cn(
            compact
              ? 'inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold transition-colors sm:px-2.5'
              : 'inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold transition-colors',
            value === r.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <span className="sm:hidden">{r.shortLabel}</span>
          <span className="hidden sm:inline">{r.label}</span>
        </button>
      ))}
    </div>
  );
}
