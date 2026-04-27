import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail, Calendar, Pencil, Loader2, Flame, Award, Target, BookMarked,
  AlertCircle, Sun, Moon, MonitorSmartphone, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { cn } from '@/lib/utils';
import type { UserPreferences, UserProfileResponse } from '@/shared/types/api';

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
  theme: UserPreferences['theme'];
}

function profileToForm(profile: UserProfileResponse): FormState {
  return {
    displayName: profile.display_name,
    audioSpeed: profile.preferences.audio_speed,
    theme: profile.preferences.theme,
  };
}

function formIsDirty(form: FormState, profile: UserProfileResponse): boolean {
  return (
    form.displayName.trim() !== profile.display_name ||
    form.audioSpeed !== profile.preferences.audio_speed ||
    form.theme !== profile.preferences.theme
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
        'p-7 rounded-2xl border transition-shadow duration-200',
        isEmerald
          ? 'bg-[color:var(--accent-emerald)] text-[color:var(--accent-emerald-foreground)] border-transparent shadow-soft-lg'
          : 'bg-card border-border shadow-soft hover:shadow-soft-lg',
      )}
    >
      <div
        className={cn(
          'h-10 w-10 rounded-xl flex items-center justify-center mb-5',
          isEmerald ? 'bg-white/15' : 'bg-muted',
        )}
      >
        {icon}
      </div>
      <p
        className={cn(
          'text-xs font-semibold tracking-[0.08em] uppercase',
          isEmerald ? 'text-white/85' : 'text-muted-foreground',
        )}
      >
        {label}
      </p>
      <p className="text-3xl font-semibold mt-2 leading-none tabular-nums tracking-tight">
        {value}
      </p>
      {sub && (
        <p className={cn('text-sm mt-3 leading-snug', isEmerald ? 'text-white/85' : 'text-muted-foreground')}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ThemeOption({
  value, label, icon, selected, onSelect,
}: {
  value: UserPreferences['theme'];
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: (v: UserPreferences['theme']) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'flex flex-col items-center gap-2 px-5 py-5 rounded-xl border text-base font-medium transition-all duration-150 ease-out',
        selected
          ? 'border-foreground bg-muted/60 shadow-soft'
          : 'border-border bg-card hover:bg-muted/40 hover:border-foreground/40',
      )}
      aria-pressed={selected}
    >
      <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center', selected ? 'bg-foreground text-background' : 'bg-muted')}>
        {icon}
      </span>
      {label}
      {selected && (
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Check className="h-3 w-3" /> selected
        </span>
      )}
    </button>
  );
}

/* ─── Skeletons ───────────────────────────────────────────────────────────── */

function HeaderSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-soft px-10 py-9 flex items-center gap-7 animate-pulse">
      <div className="h-20 w-20 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="h-7 w-56 bg-muted rounded" />
        <div className="h-4 w-72 bg-muted rounded" />
        <div className="h-3 w-40 bg-muted rounded" />
      </div>
      <div className="h-12 w-32 bg-muted rounded-xl" />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-7 bg-card border border-border rounded-2xl">
          <div className="h-10 w-10 rounded-xl bg-muted mb-5" />
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-8 w-20 bg-muted rounded mt-3" />
          <div className="h-3 w-28 bg-muted rounded mt-3" />
        </div>
      ))}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-soft p-10 animate-pulse space-y-8">
      <div>
        <div className="h-3 w-32 bg-muted rounded mb-3" />
        <div className="h-12 bg-muted rounded-xl" />
      </div>
      <div>
        <div className="h-3 w-32 bg-muted rounded mb-3" />
        <div className="h-2 bg-muted rounded-full" />
      </div>
      <div>
        <div className="h-3 w-32 bg-muted rounded mb-3" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
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
    if (profile && !form) setForm(profileToForm(profile));
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
        preferences: { audio_speed: form.audioSpeed, theme: form.theme },
      });
      setUser({
        id: updated.id,
        email: updated.email,
        display_name: updated.display_name,
        preferred_language: updated.preferred_language,
        streak_days: updated.stats.current_streak,
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
    <div className="min-h-full bg-background">
      <header
        className="border-b border-border bg-card px-8 sm:px-14 py-8 flex items-baseline justify-between gap-6 dash-enter"
        style={{ animationDelay: '0ms' }}
      >
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Your profile
        </h1>
        <p className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground shrink-0">
          Account &amp; preferences
        </p>
      </header>

      <div className="px-8 sm:px-14 py-14 max-w-[1180px] space-y-16">

        {isError ? (
          <div className="flex items-center gap-2 text-destructive text-base">
            <AlertCircle className="h-5 w-5" />
            {error instanceof Error ? error.message : 'Failed to load profile'}
          </div>
        ) : (
          <>
            {/* Header card */}
            {!profile ? (
              <HeaderSkeleton />
            ) : (
              <section
                className="bg-card border border-border rounded-2xl shadow-soft px-8 sm:px-10 py-9 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-7 dash-enter"
                style={{ animationDelay: '60ms' }}
              >
                <div className="h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-semibold shrink-0 shadow-soft">
                  {avatarInitial(profile.display_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-semibold tracking-tight truncate">
                    {profile.display_name}
                  </h2>
                  <p className="text-base text-muted-foreground mt-1.5 inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" /> {profile.email}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0" /> Joined {formatJoinDate(profile.created_at)}
                  </p>
                </div>
                <button
                  onClick={handleEditProfile}
                  className="group inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-foreground text-background text-base font-medium transition-all duration-150 ease-out hover:-translate-y-px shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground"
                >
                  <Pencil className="h-4 w-4" /> Edit profile
                </button>
              </section>
            )}

            {/* Stats */}
            <section className="dash-enter" style={{ animationDelay: '140ms' }}>
              <div className="flex items-baseline justify-between mb-5">
                <MicroLabel>Your progress</MicroLabel>
                {stats && (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Longest streak: {stats.longest_streak}d
                  </p>
                )}
              </div>
              {!stats ? (
                <StatsSkeleton />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <MetricCard
                    label="Attempts"
                    value={`${stats.total_attempts}`}
                    sub="Completed dictations"
                    icon={<Target className="h-5 w-5" />}
                  />
                  <MetricCard
                    label="Average score"
                    value={`${stats.average_score.toFixed(1)}%`}
                    sub="Across all attempts"
                    icon={<Award className="h-5 w-5" />}
                    tone="emerald"
                  />
                  <MetricCard
                    label="Vocabulary"
                    value={`${stats.total_vocabulary}`}
                    sub="Words saved"
                    icon={<BookMarked className="h-5 w-5" />}
                  />
                  <MetricCard
                    label="Current streak"
                    value={`${stats.current_streak}d`}
                    sub={stats.current_streak > 0 ? 'Keep going!' : 'Start a session today'}
                    icon={<Flame className="h-5 w-5 text-[color:var(--accent-amber)]" />}
                  />
                </div>
              )}
            </section>

            {/* Settings */}
            <section className="dash-enter" style={{ animationDelay: '220ms' }}>
              <div className="flex items-baseline justify-between mb-5">
                <MicroLabel>Settings &amp; preferences</MicroLabel>
                {profile && isDirty && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isPending}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Discard changes
                  </button>
                )}
              </div>

              {!profile || !form ? (
                <SettingsSkeleton />
              ) : (
                <div className="bg-card border border-border rounded-2xl shadow-soft p-8 sm:p-10 space-y-10">
                  {/* Display name */}
                  <div>
                    <label htmlFor="displayName" className="block text-base font-semibold mb-2.5">
                      Display name
                    </label>
                    <p className="text-sm text-muted-foreground mb-3">
                      How your name appears across DictaLearn.
                    </p>
                    <input
                      ref={nameInputRef}
                      id="displayName"
                      type="text"
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      onBlur={() => setTouched(true)}
                      maxLength={100}
                      className={cn(
                        'w-full max-w-md h-12 px-4 text-base rounded-xl border bg-background transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-ring',
                        touched && validationError ? 'border-destructive' : 'border-border',
                      )}
                    />
                    {touched && validationError && (
                      <p className="text-sm text-destructive mt-2 inline-flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4" /> {validationError}
                      </p>
                    )}
                  </div>

                  {/* Email (read-only) */}
                  <div>
                    <label className="block text-base font-semibold mb-2.5">Email</label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Tied to your account; not editable here.
                    </p>
                    <div className="w-full max-w-md h-12 px-4 flex items-center text-base rounded-xl border border-border bg-muted/40 text-muted-foreground">
                      {profile.email}
                    </div>
                  </div>

                  <div className="border-t border-border" />

                  {/* Audio speed */}
                  <div>
                    <div className="flex items-baseline justify-between mb-2.5">
                      <label htmlFor="audioSpeed" className="text-base font-semibold">
                        Default audio speed
                      </label>
                      <span className="text-base font-semibold tabular-nums">
                        {form.audioSpeed.toFixed(2)}×
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Initial playback speed for new dictation sessions.
                    </p>
                    <input
                      id="audioSpeed"
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={form.audioSpeed}
                      onChange={(e) => setForm({ ...form, audioSpeed: parseFloat(e.target.value) })}
                      className="w-full max-w-md accent-[color:var(--accent-emerald)]"
                    />
                    <div className="flex justify-between max-w-md mt-2 text-xs text-muted-foreground tabular-nums">
                      <span>0.50×</span>
                      <span>1.00×</span>
                      <span>2.00×</span>
                    </div>
                  </div>

                  {/* Theme */}
                  <div>
                    <label className="block text-base font-semibold mb-2.5">Theme</label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Match your system or pick a fixed look.
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-w-md">
                      <ThemeOption
                        value="system"
                        label="System"
                        icon={<MonitorSmartphone className="h-4 w-4" />}
                        selected={form.theme === 'system'}
                        onSelect={(v) => setForm({ ...form, theme: v })}
                      />
                      <ThemeOption
                        value="light"
                        label="Light"
                        icon={<Sun className="h-4 w-4" />}
                        selected={form.theme === 'light'}
                        onSelect={(v) => setForm({ ...form, theme: v })}
                      />
                      <ThemeOption
                        value="dark"
                        label="Dark"
                        icon={<Moon className="h-4 w-4" />}
                        selected={form.theme === 'dark'}
                        onSelect={(v) => setForm({ ...form, theme: v })}
                      />
                    </div>
                  </div>

                  {/* Save bar */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!isDirty || isPending || !!validationError}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl text-base font-semibold transition-all duration-150 ease-out',
                        'bg-[color:var(--accent-emerald)] text-[color:var(--accent-emerald-foreground)] shadow-soft-lg',
                        'hover:brightness-110 hover:-translate-y-px',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent-emerald)]',
                        'disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-soft',
                      )}
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

            {isLoading && !profile && (
              <div className="space-y-16">
                <StatsSkeleton />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
