import { useEffect, useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  LayoutDashboard,
  History,
  BookMarked,
  Users,
  Headphones,
  Flame,
  LogOut,
  UserRound,
  Menu,
  PanelLeftClose,
  PanelLeft,
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
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const navItems = [
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/vocabulary', icon: BookMarked, label: 'Vocabulary' },
  { to: '/rooms', icon: Users, label: 'Rooms' },
];

const SIDEBAR_KEY = 'dictalearn-sidebar-collapsed';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    authService.getMe().then(setUser).catch(() => {});
  }, [isAuthenticated, setUser]);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: dashboard } = useDashboard();

  const displayName = user?.display_name ?? 'User';
  const streakDays = dashboard?.stats.current_streak ?? user?.streak_days ?? 0;
  const initial = displayName.charAt(0).toUpperCase();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const pathname = location.pathname;
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navContent = (
    <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
      {navItems.map(({ to, icon: Icon, label }) => {
        const active =
          location.pathname === to ||
          (to !== '/library' && location.pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium transition-all duration-150 ease-out',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-soft'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed && 'justify-center px-0',
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex border-r border-sidebar-border bg-sidebar flex-col shrink-0 transition-[width] duration-200',
          collapsed ? 'w-[52px]' : 'w-52',
        )}
      >
        {/* Logo */}
        <div className={cn('px-3 py-3 border-b border-sidebar-border', collapsed && 'px-2')}>
          <Link to="/library" className="flex items-center gap-2 group">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-soft">
              <Headphones className="size-3.5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-sm tracking-tight group-hover:opacity-80 transition-opacity">
                DictaLearn
              </span>
            )}
          </Link>
        </div>

        {navContent}

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="mx-2 mb-1 flex items-center justify-center h-8 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>

        {/* User */}
        <div className={cn('px-2 py-2 border-t border-sidebar-border', collapsed && 'px-1')}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                'flex items-center gap-2 p-1.5 w-full rounded-lg hover:bg-sidebar-accent transition-colors',
                collapsed && 'justify-center',
              )}>
                <div className="size-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                  {initial}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold truncate leading-tight">{displayName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Flame className="size-3 text-[color:var(--accent-amber)]" />
                      {streakDays}d
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <UserRound className="size-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="size-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-12 border-b border-border bg-background/95 backdrop-blur flex items-center px-3 gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
              <SheetTitle className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
                  <Headphones className="size-3.5 text-primary-foreground" />
                </div>
                DictaLearn
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 px-2 py-2 space-y-0.5">
              {navItems.map(({ to, icon: Icon, label }) => {
                const active =
                  location.pathname === to ||
                  (to !== '/library' && location.pathname.startsWith(to));
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium transition-all',
                      active
                        ? 'bg-primary text-primary-foreground shadow-soft'
                        : 'text-foreground/75 hover:bg-muted',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto px-3 py-3 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Flame className="size-3 text-[color:var(--accent-amber)]" />
                    {streakDays} day streak
                  </p>
                </div>
              </div>
              <button
                onClick={() => { navigate('/profile'); setMobileOpen(false); }}
                className="w-full text-left text-sm text-muted-foreground hover:text-foreground py-1.5 px-1 transition-colors"
              >
                Profile & settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left text-sm text-red-600 py-1.5 px-1"
              >
                Logout
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/library" className="flex items-center gap-1.5">
          <div className="size-6 rounded-md bg-primary flex items-center justify-center">
            <Headphones className="size-3 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">DictaLearn</span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Flame className="size-3.5 text-[color:var(--accent-amber)]" />
          <span className="font-semibold tabular-nums">{streakDays}</span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-12">
        <Outlet />
      </main>
    </div>
  );
}
