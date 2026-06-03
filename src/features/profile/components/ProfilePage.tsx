import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail, Calendar, Pencil, Loader2, Flame, Award, Target, BookMarked,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { CountBadge, HeaderActionButton, PageContainer, PageStickyArea, PageScrollArea, PageHeader } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type { UserProfileResponse } from '@/shared/types/api';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatJoinDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function avatarInitial(name: string) {
  return (name.trim()[0] ?? '?').toUpperCase();
}

interface FormState {
  displayName: string;
  audioSpeed: number;
}

function profileToForm(profile: UserProfileResponse): FormState {
  return {
    displayName: profile.display_name,
    audioSpeed: profile.preferences.audio_speed,
  };
}

function formIsDirty(form: FormState, profile: UserProfileResponse): boolean {
  return (
    form.displayName.trim() !== profile.display_name ||
    form.audioSpeed !== profile.preferences.audio_speed
  );
}

function validateForm(form: FormState): string | null {
  const name = form.displayName.trim();
  if (!name) return 'Display name is required.';
  if (name.length > 100) return 'Display name must be 100 characters or fewer.';
  if (form.audioSpeed < 0.5 || form.audioSpeed > 2) return 'Audio speed must be between 0.5× and 2×.';
  return null;
}

/* ─── Small pieces ─────────────────────────────────────────────────────────── */

function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

function MetricCard({
  label, value, sub, icon, tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'emerald';
}) {
  const isEmerald = tone === 'emerald';
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-shadow duration-200',
        isEmerald
          ? 'bg-primary text-primary-foreground border-transparent shadow-soft-lg'
          : 'bg-card border-border shadow-soft hover:shadow-soft-lg',
      )}
    >
      <div
        className={cn(
          'mb-4 flex h-9 w-9 items-center justify-center rounded-xl',
          isEmerald ? 'bg-white/15' : 'bg-muted',
        )}
      >
        {icon}
      </div>
      <p
        className={cn(
          'text-[11px] font-bold tracking-[0.14em] uppercase',
          isEmerald ? 'text-white/85' : 'text-muted-foreground',
        )}
      >
        {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">
        {value}
      </p>
      {sub && (
        <p className={cn('mt-2 text-sm leading-snug', isEmerald ? 'text-white/85' : 'text-muted-foreground')}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─── Skeletons ───────────────────────────────────────────────────────────── */

function HeaderSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-5 rounded-[18px] border border-border bg-card px-6 py-5 shadow-soft">
      <div className="h-16 w-16 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded" />
        <div className="h-3 w-36 bg-muted rounded" />
      </div>
      <div className="h-10 w-28 bg-muted rounded-xl" />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5">
          <div className="h-8 w-8 rounded-lg bg-muted mb-3" />
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-6 w-20 bg-muted rounded mt-2" />
          <div className="h-3 w-28 bg-muted rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="animate-pulse rounded-[18px] border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-11 rounded-xl bg-muted" />
          <div className="h-11 rounded-xl bg-muted" />
        </div>
        <div className="space-y-5">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="h-2 rounded-full bg-muted" />
          <div className="flex justify-between">
            <div className="h-3 w-12 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function ProfilePage() {
  const { data: profile, isLoading, isError, error } = useProfile();
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();
  const setUser = useAuthStore((s) => s.setUser);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [touched, setTouched] = useState(false);
  const validationError = form ? validateForm(form) : null;

  // Sync form with loaded profile
  useEffect(() => {
    if (!profile || form) return;
    queueMicrotask(() => setForm(profileToForm(profile)));
  }, [profile, form]);

  const isDirty = useMemo(
    () => (profile && form ? formIsDirty(form, profile) : false),
    [profile, form],
  );

  const handleEditProfile = () => {
    nameInputRef.current?.focus();
    nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSave = async () => {
    if (!form || !profile) return;
    setTouched(true);
    if (validationError) return;

    try {
      const updated = await updateProfile({
        display_name: form.displayName.trim(),
        preferences: { audio_speed: form.audioSpeed },
      });
      setUser({
        id: updated.id,
        email: updated.email,
        display_name: updated.display_name,
        preferred_language: updated.preferred_language,
        streak_days: updated.stats.current_streak,
        is_admin: updated.is_admin,
      });
      toast.success('Profile saved');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save your changes';
      toast.error(msg);
    }
  };

  const handleReset = () => {
    if (profile) setForm(profileToForm(profile));
    setTouched(false);
  };

  const stats = profile?.stats;

  return (
    <PageContainer>
      <PageStickyArea>
        <PageHeader
          title="Your profile"
          actions={<CountBadge tone="primary">Account &amp; Preferences</CountBadge>}
        />
      </PageStickyArea>

      <PageScrollArea>

      {isError ? (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
          <AlertCircle className="h-5 w-5" />
          {error instanceof Error ? error.message : 'Failed to load profile'}
        </div>
      ) : (
        <>
          {!profile ? (
            <HeaderSkeleton />
          ) : (
            <section className="dash-enter flex flex-col gap-4 rounded-[18px] border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground shadow-soft">
                  {avatarInitial(profile.display_name)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-extrabold tracking-[-0.02em] text-foreground">
                    {profile.display_name}
                  </h2>
                  <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {profile.email}
                  </p>
                  <p className="mt-1.5 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" /> Joined {formatJoinDate(profile.created_at)}
                  </p>
                </div>
              </div>
              <HeaderActionButton onClick={handleEditProfile}>
                <Pencil className="h-4 w-4" /> Edit profile
              </HeaderActionButton>
            </section>
          )}

          <section className="dash-enter">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <MicroLabel>Your progress</MicroLabel>
              {stats && (
                <p className="text-sm font-medium text-muted-foreground tabular-nums">
                  Longest streak: {stats.longest_streak}d
                </p>
              )}
            </div>
            {!stats ? (
              <StatsSkeleton />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Attempts" value={`${stats.total_attempts}`} sub="Completed dictations" icon={<Target className="h-5 w-5" />} />
                <MetricCard label="Average score" value={`${stats.average_score.toFixed(1)}%`} sub="Across all attempts" icon={<Award className="h-5 w-5" />} tone="emerald" />
                <MetricCard label="Vocabulary" value={`${stats.total_vocabulary}`} sub="Words saved" icon={<BookMarked className="h-5 w-5" />} />
                <MetricCard label="Current streak" value={`${stats.current_streak}d`} sub={stats.current_streak > 0 ? 'Keep going!' : 'Start a session today'} icon={<Flame className="h-5 w-5 text-accent-orange" />} />
              </div>
            )}
          </section>

          <section className="dash-enter">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <MicroLabel>Settings &amp; preferences</MicroLabel>
              {profile && isDirty && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isPending}
                  className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Discard changes
                </button>
              )}
            </div>

            {!profile || !form ? (
              <SettingsSkeleton />
            ) : (
              <div className="rounded-[18px] border border-border bg-card p-5 shadow-soft sm:p-6">
                <div className="grid gap-8 lg:grid-cols-2">
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-base font-bold tracking-[-0.01em]">Account</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Your visible identity inside DictaLearn.</p>
                    </div>
                    <div>
                      <label htmlFor="displayName" className="mb-2 block text-sm font-bold">Display name</label>
                      <input
                        ref={nameInputRef}
                        id="displayName"
                        type="text"
                        value={form.displayName}
                        onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                        onBlur={() => setTouched(true)}
                        maxLength={100}
                        className={cn(
                          'h-11 w-full rounded-xl border bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-3 focus:ring-ring/15',
                          touched && validationError ? 'border-destructive' : 'border-input focus:border-primary',
                        )}
                      />
                      <p className="mt-2 text-xs font-medium text-muted-foreground">How your name appears across the app.</p>
                      {touched && validationError && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4" /> {validationError}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold">Email</label>
                      <div className="flex h-11 w-full items-center rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground">
                        {profile.email}
                      </div>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">Tied to your account; not editable here.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-bold tracking-[-0.01em]">Practice</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Defaults for new listening sessions.</p>
                    </div>
                    <div>
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <label htmlFor="audioSpeed" className="text-sm font-bold">Default audio speed</label>
                        <span className="text-sm font-bold tabular-nums text-primary-hover">{form.audioSpeed.toFixed(2)}×</span>
                      </div>
                      <input
                        id="audioSpeed"
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.05}
                        value={form.audioSpeed}
                        onChange={(e) => setForm({ ...form, audioSpeed: parseFloat(e.target.value) })}
                        className="w-full accent-primary"
                      />
                      <div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground tabular-nums">
                        <span>0.50×</span>
                        <span>1.00×</span>
                        <span>2.00×</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end border-t border-border pt-5">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || isPending || !!validationError}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      'Save changes'
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>

          {isLoading && !profile && <StatsSkeleton />}
        </>
      )}
      </PageScrollArea>
    </PageContainer>
  );
}
