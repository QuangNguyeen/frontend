import { useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  LayoutDashboard,
  History,
  BookMarked,
  Headphones,
  Flame,
  LogOut,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { authService } from '@/features/auth/services/authService';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/vocabulary', icon: BookMarked, label: 'Vocabulary' },
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    authService.getMe().then(setUser).catch(() => {});
  }, [location.pathname, isAuthenticated, setUser]);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: dashboard } = useDashboard();

  const displayName = user?.display_name ?? 'User';
  const streakDays = dashboard?.stats.current_streak ?? user?.streak_days ?? 0;
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-sidebar-border">
          <Link to="/library" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-soft">
              <Headphones className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight group-hover:opacity-80 transition-opacity">
              DictaLearn
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active =
              location.pathname === to ||
              (to !== '/library' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3.5 h-11 rounded-lg text-[15px] font-medium transition-all duration-150 ease-out',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-soft'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-2 py-2 w-full rounded-lg hover:bg-sidebar-accent transition-colors">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-base font-semibold shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[15px] font-semibold truncate leading-tight">{displayName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Flame className="h-3.5 w-3.5 text-[color:var(--accent-amber)]" />
                    {streakDays} day streak
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-52">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <UserRound className="h-4 w-4 mr-2" />
                Profile &amp; settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
