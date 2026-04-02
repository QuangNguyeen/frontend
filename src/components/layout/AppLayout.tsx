import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  BookOpen,
  LayoutDashboard,
  History,
  BookMarked,
  Brain,
  Headphones,
  Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/vocabulary', icon: BookMarked, label: 'Vocabulary' },
  { to: '/vocabulary/review', icon: Brain, label: 'Flashcards' },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-sidebar flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <Link to="/library" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Headphones className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-base tracking-tight group-hover:opacity-80 transition-opacity">
              DictaLearn
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active =
              location.pathname === to ||
              (to !== '/library' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-1">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Alex Kim</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                7 day streak
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}