import { cn } from '@/lib/utils';
import type { AdminTimeRange } from '@/shared/types/api';

const ranges: { value: AdminTimeRange; label: string }[] = [
  { value: '1d', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
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
              ? 'inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold transition-colors'
              : 'inline-flex h-8 items-center rounded-lg px-3 text-sm font-semibold transition-colors',
            value === r.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
