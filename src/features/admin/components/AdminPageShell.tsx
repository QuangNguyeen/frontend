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
      <div className="shrink-0 border-b border-border bg-background py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate text-xl font-extrabold leading-tight text-foreground">
                {title}
              </h1>
              {meta && <div className="shrink-0">{meta}</div>}
            </div>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {actions}
            </div>
          )}
        </div>
        {toolbar && (
          <div className="mt-3 border-t border-border pt-3">
            {toolbar}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto py-4 scrollbar-stable">
        {children}
      </div>
    </section>
  );
}
