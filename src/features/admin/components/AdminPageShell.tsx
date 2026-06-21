import type { ReactNode } from 'react';
interface AdminPageShellProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}

export function AdminPageShell({
  title,
  description,
  meta,
  actions,
  toolbar,
  children,
}: AdminPageShellProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="page-header shrink-0 border-b border-border bg-background py-2.5 sm:py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-base font-extrabold leading-tight text-foreground sm:text-xl">
                {title}
              </h1>
              {meta && <div className="shrink-0">{meta}</div>}
            </div>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5">
              {actions}
            </div>
          )}
        </div>
        {toolbar && (
          <div className="mt-2 border-t border-border pt-2 sm:mt-2.5 sm:pt-2.5">
            {toolbar}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-2.5 sm:py-3 scrollbar-stable">
        {children}
      </div>
    </section>
  );
}
