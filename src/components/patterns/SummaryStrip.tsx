import { cn } from '@/lib/utils';

interface SummaryItem {
  label: string;
  value: string | number;
}

interface SummaryStripProps {
  items: SummaryItem[];
  className?: string;
}

export function SummaryStrip({ items, className }: SummaryStripProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-3 py-2 rounded-lg border border-border bg-card text-xs text-muted-foreground shadow-soft',
        className,
      )}
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground tabular-nums">{item.value}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
}
