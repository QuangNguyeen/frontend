import { cn } from '@/lib/utils';

interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

function FilterChip({ selected, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'h-11 px-3.5 text-xs font-semibold rounded-xl border transition-all',
        selected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-border bg-card hover:bg-primary-soft hover:border-primary/30 text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { FilterChip };
export type { FilterChipProps };
