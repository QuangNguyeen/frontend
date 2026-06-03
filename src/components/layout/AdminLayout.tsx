import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, LineChart, ShieldCheck, Users, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/analytics', label: 'Analytics', icon: LineChart },
  { to: '/admin/videos', label: 'Videos', icon: Video },
  { to: '/admin/users', label: 'Users', icon: Users },
];

export function AdminLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1200px] flex-col px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 flex-wrap items-center gap-3 pt-6 pb-3 lg:pt-8">
          <span className="inline-flex items-center gap-1 rounded-full border border-accent-yellow/35 bg-accent-yellow/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-accent-yellow">
            <ShieldCheck className="size-3" />
            Admin
          </span>
          <nav className="flex flex-wrap rounded-xl border border-border bg-card p-1">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-soft'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}