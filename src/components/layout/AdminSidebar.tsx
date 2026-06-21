import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, Headphones, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { adminNavigation } from './adminNavigation';

interface AdminSidebarProps {
  onNavigate?: () => void;
  mobile?: boolean;
}

export function AdminSidebar({ onNavigate, mobile = false }: AdminSidebarProps) {
  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name ?? 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        'admin-sidebar flex h-full flex-col border-r border-border bg-card text-card-foreground',
        mobile ? 'w-full border-r-0' : 'w-[72px] 2xl:w-56',
      )}
    >
      <div className={cn('border-b border-border', mobile ? 'px-4 py-4' : 'px-3 py-3 2xl:px-4')}>
        <Link to="/admin" onClick={onNavigate} className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Headphones size={18} strokeWidth={2} absoluteStrokeWidth />
          </span>
          <span className={cn('min-w-0', !mobile && 'hidden 2xl:block')}>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight">Admin Workspace</span>
              <span className="rounded-md border border-accent-yellow/35 bg-accent-yellow/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-accent-yellow">
                Admin
              </span>
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
              Content, users, and system operations
            </span>
          </span>
        </Link>
      </div>

      <nav className={cn('flex-1 space-y-1 overflow-y-auto py-3', mobile ? 'px-3' : 'px-2 2xl:px-3')}>
        {adminNavigation.map(({ to, label, description, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex h-10 items-center rounded-lg text-sm font-semibold transition-colors',
                mobile
                  ? 'gap-3 px-3'
                  : 'justify-center px-0 2xl:justify-start 2xl:gap-2.5 2xl:px-3',
                isActive
                  ? 'border border-primary/25 bg-primary-soft text-primary shadow-soft'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
            title={!mobile ? label : undefined}
            aria-label={label}
          >
            <Icon className="size-4 shrink-0" />
            <span className={cn(!mobile && 'hidden 2xl:block')}>{label}</span>
            {mobile && <span className="sr-only">{description}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={cn('space-y-3 border-t border-border py-3', mobile ? 'px-3' : 'px-2 2xl:px-3')}>
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className={cn(
            'flex h-10 items-center rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            mobile
              ? 'gap-2.5 px-3'
              : 'justify-center px-0 2xl:justify-start 2xl:gap-2.5 2xl:px-3',
          )}
          title={!mobile ? 'Back to app' : undefined}
          aria-label="Back to app"
        >
          <ArrowLeft className="size-4" />
          <span className={cn(!mobile && 'hidden 2xl:block')}>Back to app</span>
        </Link>

        <div
          className={cn(
            'flex items-center rounded-lg border border-border bg-background',
            mobile
              ? 'gap-2 px-3 py-2'
              : 'justify-center p-1.5 2xl:justify-start 2xl:gap-2 2xl:px-3 2xl:py-2',
          )}
          title={!mobile ? `${displayName}, Administrator` : undefined}
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-extrabold text-primary">
            {initial}
          </span>
          <span className={cn('min-w-0 flex-1', !mobile && 'hidden 2xl:block')}>
            <span className="block truncate text-sm font-bold">{displayName}</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-accent-yellow">
              <ShieldCheck className="size-3" />
              Administrator
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
