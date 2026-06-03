import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, RefreshCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AppSelect } from '@/components/ui/app-select';

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

interface AdminTopBarProps {
  onOpenSidebar: () => void;
}

const pageTitles: Record<string, { title: string; breadcrumb: string; needsRange?: boolean }> = {
  '/admin': { title: 'Admin control center', breadcrumb: 'Admin / Overview', needsRange: true },
  '/admin/analytics': { title: 'Analytics', breadcrumb: 'Admin / Analytics', needsRange: true },
  '/admin/users': { title: 'Users', breadcrumb: 'Admin / Users' },
  '/admin/videos': { title: 'Videos', breadcrumb: 'Admin / Videos' },
  '/admin/transcriptions': { title: 'Transcriptions', breadcrumb: 'Admin / Transcriptions' },
  '/admin/reports': { title: 'Reports', breadcrumb: 'Admin / Reports', needsRange: true },
  '/admin/settings': { title: 'Settings', breadcrumb: 'Admin / Settings' },
};

export function AdminTopBar({ onOpenSidebar }: AdminTopBarProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [range, setRange] = useState('7d');

  const page = useMemo(() => {
    const match = Object.entries(pageTitles)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => location.pathname === path || location.pathname.startsWith(`${path}/`));

    return match?.[1] ?? { title: 'Admin', breadcrumb: 'Admin' };
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Open admin navigation"
          >
            <Menu className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {page.breadcrumb}
            </p>
            <h1 className="truncate text-sm font-extrabold tracking-tight sm:text-base">{page.title}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {page.needsRange && (
            <div className="hidden sm:block">
              <AppSelect
                value={range}
                onValueChange={setRange}
                options={RANGE_OPTIONS}
                size="sm"
              />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin'] })}
          >
            <RefreshCcw className="size-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back to app</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
