import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Loader2, MoreHorizontal, RefreshCcw, Search, ShieldCheck, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppSelect } from '@/components/ui/app-select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import type { AdminUserResponse } from '@/shared/types/api';
import { useAdminUser, useAdminUsers, usePatchAdminUser } from '../../hooks/useAdmin';
import { AdminPageShell } from '../AdminPageShell';
import { AdminPagination } from '../AdminPagination';
import { AdminEmptyState, AdminLoadingSkeleton } from '../AdminStates';

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'true', label: 'Admins' },
  { value: 'false', label: 'Users' },
];

const ACCOUNT_OPTIONS = [
  { value: '', label: 'All accounts' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

function parseBool(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function RoleBadge({ user }: { user: AdminUserResponse }) {
  return user.is_admin ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent-yellow/35 bg-accent-yellow/15 px-2 py-0.5 text-xs font-bold text-accent-yellow">
      <ShieldCheck className="size-3" />
      Admin
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-bold text-muted-foreground">
      User
    </span>
  );
}

export function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    user: AdminUserResponse;
    type: 'role' | 'active';
  } | null>(null);
  const pageSize = 20;

  const params = useMemo(
    () => ({
      search,
      is_admin: parseBool(role),
      is_active: parseBool(active),
      page,
      page_size: pageSize,
    }),
    [active, page, role, search],
  );

  const { data, isLoading, isFetching, refetch } = useAdminUsers(params);
  const selectedUser = useAdminUser(selectedUserId);
  const patchUser = usePatchAdminUser();

  const confirmAction = () => {
    if (!pendingAction) return;
    const { user, type } = pendingAction;
    patchUser.mutate(
      {
        userId: user.id,
        data:
          type === 'role'
            ? { is_admin: !user.is_admin }
            : { is_active: !user.is_active },
      },
      { onSettled: () => setPendingAction(null) },
    );
  };

  return (
    <AdminPageShell
      title="Users"
      description="Search accounts, review learning activity, and manage access."
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh
        </Button>
      }
      toolbar={
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_140px_140px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-9 pl-9"
              placeholder="Search name or email"
            />
          </label>
          <AppSelect
            value={role}
            onValueChange={(val) => { setRole(val); setPage(1); }}
            options={ROLE_OPTIONS}
            size="sm"
            triggerClassName="w-full"
          />
          <AppSelect
            value={active}
            onValueChange={(val) => { setActive(val); setPage(1); }}
            options={ACCOUNT_OPTIONS}
            size="sm"
            triggerClassName="w-full"
          />
        </div>
      }
    >
      <>
        <Card className="flex min-h-[360px] flex-col overflow-hidden sm:min-h-[520px]">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Users className="size-4 text-primary" />
              {data?.total ?? 0} user{data?.total === 1 ? '' : 's'}
            </div>
            {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>

          {isLoading ? (
            <AdminLoadingSkeleton rows={8} />
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-auto scrollbar-stable">
                <table className="w-full min-w-[640px] text-left text-sm sm:min-w-[760px]">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-xs uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Name + Email</th>
                      <th className="px-3 py-2.5 font-bold">Role</th>
                      <th className="px-3 py-2.5 font-bold">Active</th>
                      <th className="hidden px-3 py-2.5 font-bold lg:table-cell">Last login</th>
                      <th className="px-3 py-2.5 font-bold">Sessions</th>
                      <th className="hidden px-3 py-2.5 font-bold xl:table-cell">Vocab</th>
                      <th className="admin-actions-col px-4 py-2.5 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data?.items ?? []).map((user) => {
                      const isSelf = user.id === currentUser?.id;
                      return (
                        <tr
                          key={user.id}
                          className="h-12 cursor-pointer align-middle transition-colors hover:bg-muted/35"
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">
                                {user.display_name.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <Link
                                  to={`/admin/users/${user.id}`}
                                  className="max-w-[280px] truncate font-bold hover:text-primary hover:underline"
                                >
                                  {user.display_name}
                                </Link>
                                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5"><RoleBadge user={user} /></td>
                          <td className="px-3 py-2.5">
                            <span
                              className={
                                user.is_active
                                  ? 'font-semibold text-accent-emerald'
                                  : 'font-semibold text-muted-foreground'
                              }
                            >
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">{formatDate(user.last_login_at)}</td>
                          <td className="px-3 py-2.5 font-semibold tabular-nums">{user.total_sessions}</td>
                          <td className="hidden px-3 py-2.5 font-semibold tabular-nums xl:table-cell">{user.total_vocabulary}</td>
                          <td className="admin-actions-col px-4 py-2.5">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs"
                                disabled={isSelf && user.is_admin}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPendingAction({ user, type: 'role' });
                                }}
                              >
                                {user.is_admin ? 'Revoke' : 'Admin'}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="More user actions">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    disabled={isSelf}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setPendingAction({ user, type: 'active' });
                                    }}
                                  >
                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedUserId(user.id);
                                  }}>
                                    View stats
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data?.items.length === 0 && (
                <AdminEmptyState
                  compact
                  title="No matching users"
                  description="Adjust the search or account filters and try again."
                  icon={Users}
                />
              )}
              <AdminPagination
                page={page}
                totalPages={data?.total_pages ?? 1}
                total={data?.total ?? 0}
                pageSize={pageSize}
                isFetching={isFetching}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>

        <Sheet open={Boolean(selectedUserId)} onOpenChange={(open) => !open && setSelectedUserId(null)}>
          <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-4 sm:w-[420px] sm:p-5">
            <SheetHeader>
              <SheetTitle>User overview</SheetTitle>
            </SheetHeader>
            {selectedUser.isLoading ? (
              <div className="flex min-h-[260px] items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : selectedUser.data ? (
              <div className="mt-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    User Detail
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold">{selectedUser.data.display_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.data.email}</p>
                </div>
                <RoleBadge user={selectedUser.data} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-bold text-muted-foreground">Attempts</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{selectedUser.data.stats.total_attempts}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-bold text-muted-foreground">Accuracy</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{selectedUser.data.stats.average_score}%</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-bold text-muted-foreground">Vocabulary</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{selectedUser.data.stats.total_vocabulary}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-xs font-bold text-muted-foreground">Longest streak</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{selectedUser.data.stats.longest_streak}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                <CalendarClock className="size-4 text-primary" />
                Joined {formatDate(selectedUser.data.created_at)}
              </div>
              <Button asChild className="mt-4 w-full">
                <Link to={`/admin/users/${selectedUser.data.id}`}>
                  Open full profile
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              </div>
            ) : (
              <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                Unable to load user detail.
              </div>
            )}
          </SheetContent>
        </Sheet>

        <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingAction?.type === 'role'
                  ? pendingAction.user.is_admin ? 'Revoke administrator access?' : 'Grant administrator access?'
                  : pendingAction?.user.is_active ? 'Deactivate this account?' : 'Activate this account?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction?.type === 'role'
                  ? `This changes the permissions available to ${pendingAction.user.display_name}.`
                  : `This changes whether ${pendingAction?.user.display_name ?? 'this user'} can sign in and use the application.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={patchUser.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={pendingAction?.type === 'active' && pendingAction.user.is_active ? 'destructive' : 'default'}
                disabled={patchUser.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  confirmAction();
                }}
              >
                {patchUser.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </AdminPageShell>
  );
}
