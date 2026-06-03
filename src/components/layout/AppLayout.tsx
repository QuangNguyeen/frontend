import {
  useEffect,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
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
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/app/ThemeProvider';
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

/* ─── constants ──────────────────────────────── */

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/library', icon: BookOpen, label: 'Practice' },
  { to: '/history', icon: History, label: 'Progress' },
  { to: '/vocabulary', icon: BookMarked, label: 'Vocabulary' },
  { to: '/rooms', icon: Users, label: 'Rooms' },
];

const SIDEBAR_KEY = 'sidebarCollapsed';
const LEGACY_SIDEBAR_KEY = 'dictalearn-sidebar-collapsed';

/* ─── shared sidebar primitives ──────────────── */

function SidebarIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="sidebar-icon-box">
      <Icon size={18} strokeWidth={2} absoluteStrokeWidth />
    </span>
  );
}

function useCollapsedTooltip(collapsed: boolean, label: string) {
  const [tooltip, setTooltip] = useState<{
    label: string;
    left: number;
    top: number;
  } | null>(null);

  const showTooltip = (
    event: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>,
  ) => {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const sidebar = event.currentTarget.closest('.sidebar');
    const sidebarRight =
      sidebar instanceof HTMLElement
        ? sidebar.getBoundingClientRect().right
        : rect.right;
    setTooltip({
      label,
      left: sidebarRight + 10,
      top: rect.top + rect.height / 2,
    });
  };

  const hideTooltip = () => setTooltip(null);

  const tooltipPortal =
    collapsed && tooltip && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            className="sidebar-tooltip"
            style={{ left: tooltip.left, top: tooltip.top }}
          >
            {tooltip.label}
          </div>,
          document.body,
        )
      : null;

  return {
    tooltipHandlers: {
      onBlur: hideTooltip,
      onFocus: showTooltip,
      onMouseEnter: showTooltip,
      onMouseLeave: hideTooltip,
    },
    tooltipPortal,
  };
}

/* ─── SidebarNavItem ─────────────────────────── */

function SidebarNavItem({
  to,
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  const { tooltipHandlers, tooltipPortal } = useCollapsedTooltip(collapsed, label);

  return (
    <>
      <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        data-tooltip={collapsed ? label : undefined}
        className={cn('sidebar-row', active && 'active')}
        {...tooltipHandlers}
      >
        <SidebarIcon icon={Icon} />
        <span className="sidebar-label">{label}</span>
      </Link>
      {tooltipPortal}
    </>
  );
}

/* ─── SidebarSection ─────────────────────────── */

function SidebarSection({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  return (
    <div className={cn(collapsed ? 'h-3' : 'mt-5 mb-2 px-2.5')}>
      <p
        className={cn(
          'text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap transition-opacity duration-[160ms]',
          collapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100',
        )}
      >
        {label}
      </p>
    </div>
  );
}

/* ─── ThemeToggle ────────────────────────────── */

function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { setTheme, resolved } = useTheme();
  const isDark = resolved === 'dark';
  const Icon = isDark ? Moon : Sun;
  const text = isDark ? 'Dark Mode' : 'Light Mode';
  const { tooltipHandlers, tooltipPortal } = useCollapsedTooltip(collapsed, text);

  return (
    <>
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        data-tooltip={collapsed ? text : undefined}
        className="sidebar-row sidebar-theme-row"
        {...tooltipHandlers}
      >
        <SidebarIcon icon={Icon} />
        <span className="sidebar-label">{text}</span>
        <span
          className="theme-switch"
          data-state={isDark ? 'dark' : 'light'}
          aria-hidden
        >
          <span className="theme-switch-track">
            <span className="theme-switch-thumb" />
          </span>
        </span>
      </button>
      {tooltipPortal}
    </>
  );
}

/* ─── SidebarCollapseButton ──────────────────── */

function SidebarCollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const tooltipText = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const { tooltipHandlers, tooltipPortal } = useCollapsedTooltip(
    collapsed,
    tooltipText,
  );

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label={tooltipText}
        data-tooltip={collapsed ? tooltipText : undefined}
        className="sidebar-row sidebar-collapse-row"
        {...tooltipHandlers}
      >
        <SidebarIcon icon={collapsed ? PanelLeft : PanelLeftClose} />
        <span className="sidebar-label">
          {collapsed ? 'Expand' : 'Collapse'}
        </span>
      </button>
      {tooltipPortal}
    </>
  );
}

/* ─── SidebarProfile ─────────────────────────── */

function SidebarProfile({
  collapsed,
  displayName,
  initial,
  onNavigateProfile,
  onLogout,
}: {
  collapsed: boolean;
  displayName: string;
  initial: string;
  onNavigateProfile: () => void;
  onLogout: () => void;
}) {
  const { tooltipHandlers, tooltipPortal } = useCollapsedTooltip(
    collapsed,
    'Profile',
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${displayName} profile menu`}
            data-tooltip={collapsed ? 'Profile' : undefined}
            className="sidebar-row sidebar-profile-row"
            {...tooltipHandlers}
          >
            <span className="sidebar-icon-box">
              <span className="profile-avatar">{initial}</span>
            </span>
            <span className="sidebar-label profile-text">
              <span className="block truncate text-sm font-bold leading-tight">
                {displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Account profile
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-48">
          <DropdownMenuItem onClick={onNavigateProfile}>
            <UserRound className="size-4 mr-2" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onLogout}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="size-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {tooltipPortal}
    </>
  );
}

/* ─── SidebarHeader ──────────────────────────── */

function SidebarHeader() {
  return (
    <Link
      to="/dashboard"
      aria-label="DictaLearn dashboard"
      className="sidebar-brand"
    >
      <span className="sidebar-brand-logo">
        <Headphones size={20} strokeWidth={2} absoluteStrokeWidth />
      </span>
      <span className="sidebar-brand-text">
        <span className="block text-[15px] font-extrabold tracking-tight text-foreground transition-colors duration-150">
          DictaLearn
        </span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Listening Lab
        </span>
      </span>
    </Link>
  );
}

/* ─── AppLayout ──────────────────────────────── */

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
  const visibleNavItems = user?.is_admin
    ? [...navItems, { to: '/admin', icon: ShieldCheck, label: 'Admin' }]
    : navItems;

  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) return stored === '1' || stored === 'true';
    return localStorage.getItem(LEGACY_SIDEBAR_KEY) === '1';
  });
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop sidebar ─────────────────────── */}
      <aside
        data-collapsed={collapsed ? 'true' : 'false'}
        className="sidebar hidden lg:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
      >
        <SidebarHeader />

        {/* Main: nav */}
        <div className="sidebar-panel flex-1 min-h-0 overflow-y-auto">
          <SidebarSection label="Learn" collapsed={collapsed} />
          <nav className="space-y-1.5">
            {visibleNavItems.map(({ to, icon, label }) => {
              const active =
                location.pathname === to ||
                (to !== '/library' && location.pathname.startsWith(to));
              return (
                <SidebarNavItem
                  key={to}
                  to={to}
                  icon={icon}
                  label={label}
                  active={active}
                  collapsed={collapsed}
                />
              );
            })}
          </nav>
        </div>


        {/* Bottom: utilities + profile */}
        <div className="sidebar-panel shrink-0 space-y-1.5 border-t border-sidebar-border py-3">
          <ThemeToggle collapsed={collapsed} />
          <SidebarCollapseButton
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
          <SidebarProfile
            collapsed={collapsed}
            displayName={displayName}
            initial={initial}
            onNavigateProfile={() => navigate('/profile')}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────── */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="rounded-lg p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-50 flex-col bg-sidebar p-0 text-sidebar-foreground"
          >
            <SheetHeader className="border-b border-sidebar-border px-5 pb-4 pt-5">
              <SheetTitle className="flex items-center gap-2 text-left">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
                  <Headphones className="size-3.5 text-primary-foreground" />
                </div>
                <span>
                  <span className="block text-base font-extrabold leading-tight">
                    DictaLearn
                  </span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Listening Lab
                  </span>
                </span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 space-y-1 px-3 py-4">
              <p className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                Learn
              </p>
              {visibleNavItems.map(({ to, icon: Icon, label }) => {
                const active =
                  location.pathname === to ||
                  (to !== '/library' && location.pathname.startsWith(to));
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-primary-soft hover:text-foreground',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-sidebar-border px-4 py-4">
              <ThemeToggle />

              <div className="mt-3 rounded-2xl border border-sidebar-border bg-sidebar-accent px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Streak
                </p>
                <p className="mt-1 flex items-center gap-2 font-bold tabular-nums text-foreground">
                  <Flame className="size-4 shrink-0 text-accent-yellow" />
                  <span className="text-xl">{streakDays}</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    day{streakDays === 1 ? '' : 's'}
                  </span>
                </p>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Flame className="size-3 text-accent-amber" />
                    {streakDays} day streak
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  navigate('/profile');
                  setMobileOpen(false);
                }}
                className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                Logout
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary">
            <Headphones className="size-3 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm">DictaLearn</span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Flame className="size-3.5 text-accent-amber" />
          <span className="font-semibold tabular-nums">{streakDays}</span>
        </div>
      </div>

      {/* ── Main content ────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden lg:pt-0 pt-14">
        <Outlet />
      </main>
    </div>
  );
}
