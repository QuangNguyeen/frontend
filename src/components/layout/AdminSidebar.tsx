import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Captions,
  FileText,
  Headphones,
  LineChart,
  Settings,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';

const adminNavItems = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
  { to: '/admin/analytics', label: 'Analytics', icon: LineChart },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/videos', label: 'Videos', icon: Video },
  { to: '/admin/transcriptions', label: 'Transcriptions', icon: Captions },
  { to: '/admin/reports', label: 'Reports', icon: FileText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name ?? 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card text-card-foreground">
      <div className="border-b border-border px-4 py-4">
        <Link to="/admin" onClick={onNavigate} className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Headphones className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight">DictaLearn Admin</span>
              <span className="rounded-md border border-accent-yellow/35 bg-accent-yellow/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-accent-yellow">
                Admin
              </span>
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
              System controls, users, and content operations
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {adminNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold transition-colors',
                isActive
                  ? 'border border-primary/25 bg-primary-soft text-primary shadow-soft'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-border px-3 py-3">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to app
        </Link>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-extrabold text-primary">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
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
