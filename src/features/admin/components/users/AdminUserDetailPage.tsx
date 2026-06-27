import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Flame,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Target,
  Trophy,
  BookMarked,
  Clock3,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { extractApiError } from '@/shared/lib/httpClient';
import { useAdminUser, usePatchAdminUser } from '../../hooks/useAdmin';
import { AdminPageShell } from '../AdminPageShell';
import { UserAnalyticsPanel } from './UserAnalyticsPanel';
import { toast } from 'sonner';

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const { data: user, isLoading, isError } = useAdminUser(userId ?? null);
  const patchUser = usePatchAdminUser();
  const [credentialEmail, setCredentialEmail] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [pendingAccessAction, setPendingAccessAction] = useState<'role' | 'active' | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setCredentialEmail(user?.email ?? '');
      setCredentialPassword('');
    });
  }, [user?.email, user?.id]);

  if (isLoading) {
    return (
      <AdminPageShell
        title="User detail"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/users">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        }
      >
        <div className="flex min-h-[360px] items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </AdminPageShell>
    );
  }

  if (isError || !user) {
    return (
      <AdminPageShell
        title="User not found"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/users">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        }
      >
        <Card className="p-5">
          <h2 className="text-lg font-bold">User not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The user may have been removed or the ID is invalid.
          </p>
        </Card>
      </AdminPageShell>
    );
  }

  const isSelf = user.id === currentUser?.id;
  const normalizedCredentialEmail = credentialEmail.trim().toLowerCase();
  const credentialsChanged = normalizedCredentialEmail !== user.email.trim().toLowerCase() || credentialPassword.length > 0;
  const canSaveCredentials =
    credentialsChanged &&
    normalizedCredentialEmail.length > 0 &&
    (credentialPassword.length === 0 || credentialPassword.length >= 8) &&
    !patchUser.isPending;

  const handleCredentialSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSaveCredentials) return;

    patchUser.mutate(
      {
        userId: user.id,
        data: {
          email: normalizedCredentialEmail,
          ...(credentialPassword ? { password: credentialPassword } : {}),
        },
      },
      {
        onSuccess: () => {
          setCredentialPassword('');
          toast.success('User credentials updated');
        },
        onError: (err) => {
          toast.error(extractApiError(err, 'Could not update user credentials'));
        },
      },
    );
  };

  const confirmAccessAction = () => {
    if (!pendingAccessAction) return;
    patchUser.mutate(
      {
        userId: user.id,
        data:
          pendingAccessAction === 'role'
            ? { is_admin: !user.is_admin }
            : { is_active: !user.is_active },
      },
      { onSettled: () => setPendingAccessAction(null) },
    );
  };

  const statTiles = [
    {
      label: 'Total Attempts',
      value: user.stats.total_attempts,
      icon: Clock3,
      tone: 'text-accent-blue',
    },
    {
      label: 'Average Accuracy',
      value: `${user.stats.average_score}%`,
      icon: Target,
      tone: 'text-accent-emerald',
    },
    {
      label: 'Vocabulary Saved',
      value: user.stats.total_vocabulary,
      icon: BookMarked,
      tone: 'text-primary',
    },
    {
      label: 'Current Streak',
      value: user.stats.current_streak,
      icon: Flame,
      tone: 'text-accent-yellow',
    },
    {
      label: 'Longest Streak',
      value: user.stats.longest_streak,
      icon: Trophy,
      tone: 'text-accent-orange',
    },
    {
      label: 'Total Sessions',
      value: user.total_sessions,
      icon: BarChart3,
      tone: 'text-accent-blue',
    },
  ];

  return (
    <AdminPageShell
      title={user.display_name}
      description="Review account activity, access, and login credentials."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/users">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      }
    >
    <div className="space-y-3">
      {/* User Header */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-extrabold text-primary">
              {user.display_name.charAt(0).toUpperCase()}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold">{user.display_name}</h2>
                {user.is_admin && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent-yellow/35 bg-accent-yellow/15 px-2 py-0.5 text-xs font-bold text-accent-yellow">
                    <ShieldCheck className="size-3" />
                    Admin
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    user.is_active
                      ? 'border border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald'
                      : 'border border-border text-muted-foreground'
                  }`}
                >
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-3.5 text-primary" />
                  Joined {formatDate(user.created_at)}
                </span>
                <span>Last login: {formatDate(user.last_login_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(isSelf && user.is_admin) || patchUser.isPending}
              onClick={() => setPendingAccessAction('role')}
            >
              {user.is_admin ? 'Revoke admin' : 'Make admin'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isSelf || patchUser.isPending}
              onClick={() => setPendingAccessAction('active')}
            >
              {user.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Credential reset */}
      <Card className="p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold">Reset login credentials</h3>
          <p className="text-sm text-muted-foreground">
            Update this user&apos;s login email or set a new password. Leave password blank to keep it unchanged.
          </p>
        </div>
        <form onSubmit={handleCredentialSubmit} className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label htmlFor="admin-reset-email" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="admin-reset-email"
                type="email"
                value={credentialEmail}
                onChange={(event) => setCredentialEmail(event.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-ring/15"
                placeholder="user@example.com"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="admin-reset-password" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              New password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="admin-reset-password"
                type="password"
                value={credentialPassword}
                onChange={(event) => setCredentialPassword(event.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-ring/15"
                placeholder="At least 8 characters"
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {credentialPassword.length > 0 && credentialPassword.length < 8 && (
              <p className="mt-1.5 text-xs font-medium text-destructive">Password must be at least 8 characters.</p>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!canSaveCredentials}
            className="h-9 whitespace-nowrap"
          >
            {patchUser.isPending ? (
              <><Loader2 className="size-4 animate-spin" /> Saving...</>
            ) : (
              'Save credentials'
            )}
          </Button>
        </form>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Card key={tile.label} className="p-3">
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${tile.tone}`} />
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {tile.label}
                </p>
              </div>
              <p className="mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight">
                {typeof tile.value === 'number'
                  ? new Intl.NumberFormat().format(tile.value)
                  : tile.value}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Learning analytics */}
      <UserAnalyticsPanel stats={user.stats} totalSessions={user.total_sessions} />
      <AlertDialog
        open={Boolean(pendingAccessAction)}
        onOpenChange={(open) => !open && setPendingAccessAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAccessAction === 'role'
                ? user.is_admin ? 'Revoke administrator access?' : 'Grant administrator access?'
                : user.is_active ? 'Deactivate this account?' : 'Activate this account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAccessAction === 'role'
                ? `This changes the administration permissions available to ${user.display_name}.`
                : `This changes whether ${user.display_name} can sign in and use the application.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={patchUser.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingAccessAction === 'active' && user.is_active ? 'destructive' : 'default'}
              disabled={patchUser.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmAccessAction();
              }}
            >
              {patchUser.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </AdminPageShell>
  );
}
