import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAdminPageMeta } from './adminNavigation';

interface AdminTopBarProps {
  onOpenSidebar: () => void;
}

export function AdminTopBar({ onOpenSidebar }: AdminTopBarProps) {
  const location = useLocation();
  const page = getAdminPageMeta(location.pathname);

  return (
    <header className="shrink-0 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-5">
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
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {page.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
