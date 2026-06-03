import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageShell';

interface AdminPageShellProps {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}

export function AdminPageShell({
  title,
  meta,
  actions,
  toolbar,
  children,
}: AdminPageShellProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 pb-4">
        <PageHeader
          title={title}
          meta={meta}
          actions={actions}
          toolbar={toolbar}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-2 scrollbar-stable">
        {children}
      </div>
    </section>
  );
}