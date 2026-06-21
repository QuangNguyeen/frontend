import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function AdminLoadingSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3 p-4', className)} aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-11 animate-pulse rounded-lg bg-muted"
          style={{ opacity: Math.max(0.35, 1 - index * 0.1) }}
        />
      ))}
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-5 text-center text-muted-foreground',
        compact ? 'min-h-40' : 'min-h-60',
      )}
    >
      <Icon className="size-8 opacity-45" />
      <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AdminErrorState({
  title = 'Unable to load this view',
  description = 'Check the API connection and try again.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </span>
      <h2 className="mt-3 text-base font-bold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <Loader2 className="hidden size-4" />
          Retry
        </Button>
      )}
    </Card>
  );
}

export function AdminTableFrame({
  title,
  icon: Icon,
  count,
  loading,
  children,
  footer,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  count?: number;
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex min-h-[480px] flex-col overflow-hidden', className)}>
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          {Icon && <Icon className="size-4 text-primary" />}
          <span>{typeof count === 'number' ? `${count.toLocaleString()} ` : ''}{title}</span>
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {footer}
    </Card>
  );
}
