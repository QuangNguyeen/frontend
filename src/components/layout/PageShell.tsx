import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden w-full px-4 sm:px-6 lg:px-8', className)}>
        {children}
      </div>
    </main>
  );
}

export function PageStickyArea({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('shrink-0 pt-6 pb-4 space-y-5 lg:pt-8', className)}>
      {children}
    </div>
  );
}

export function PageScrollArea({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto pt-2 pb-6 space-y-5 scrollbar-stable', className)}>
      {children}
    </div>
  );
}

/**
 * Unified page header used across every feature and admin page.
 *
 * One card holds the whole header: a title row (title + optional inline `meta`
 * badge on the left, `actions` on the right) and an optional `toolbar` row
 * (search / filters / chips) below a thin divider. When `toolbar` is omitted the
 * card collapses to just the title row.
 */
export function PageHeader({
  title,
  meta,
  actions,
  toolbar,
  className,
}: {
  /** Page title — moderate size, never oversized. */
  title: ReactNode;
  /** Small badge beside the title (e.g. an item count). Hidden when absent. */
  meta?: ReactNode;
  /** Buttons on the right side of the title row. */
  actions?: ReactNode;
  /** Tools row (search / dropdowns / filter chips) rendered below the title. */
  toolbar?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'rounded-2xl border border-border bg-card shadow-soft',
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-2xl font-extrabold leading-tight tracking-[-0.025em] text-foreground">
            {title}
          </h1>
          {meta && <div className="shrink-0">{meta}</div>}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {actions}
          </div>
        )}
      </div>
      {toolbar && (
        <div className="border-t border-border p-3 sm:px-5 sm:py-3">
          {toolbar}
        </div>
      )}
    </header>
  );
}

export function CountBadge({
  children,
  icon,
  tone = 'neutral',
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'primary';
}) {
  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-bold',
        tone === 'primary'
          ? 'border-primary/20 bg-primary-soft text-primary-hover'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function RefreshButton({
  onClick,
  disabled,
  label = 'Refresh',
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={label}
      title={label}
    >
      <RefreshCw className="h-4 w-4" />
    </button>
  );
}

export function HeaderActionButton({
  children,
  onClick,
  variant = 'primary',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
          : 'bg-primary-soft text-primary-hover hover:bg-primary-light/35',
      )}
    >
      {children}
    </button>
  );
}
