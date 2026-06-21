import { useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  BookMarked,
  ArrowRight,
  AlertCircle,
  Flame,
  CalendarDays,
  Target,
  Clock3,
  CheckCircle2,
  BarChart3,
  Video,
  ListChecks,
  Percent,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDashboard, useDashboardHistory } from '../hooks/useDashboard';
import { useVideos } from '@/features/library/hooks/useVideos';
import { RecommendedVideosSection } from './RecommendedVideosSection';
import { CountBadge, PageContainer, PageStickyArea, PageScrollArea, PageHeader } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';
import type {
  HeatmapDay, HistoryEntryResponse, VideoResponse,
} from '@/shared/types/api';

const TODAY_GOAL_SENTENCES = 20;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatMonthDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildLast30Days(apiData: HeatmapDay[]): HeatmapDay[] {
  const lookup = new Map(apiData.map((d) => [d.date, d]));
  const today = new Date();
  const result: HeatmapDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    result.push(lookup.get(iso) ?? { date: iso, count: 0, level: 0 });
  }
  return result;
}

function findVideoForHistory(
  h: HistoryEntryResponse | undefined,
  videos: VideoResponse[],
): VideoResponse | undefined {
  if (!h) return undefined;
  return videos.find((v) => v.title === h.video_title);
}

function pickContinueTarget(
  history: HistoryEntryResponse[],
): HistoryEntryResponse | undefined {
  return history.find((h) => h.status !== 'completed') ?? history[0];
}

function progressToPercent(str?: string): number {
  if (!str) return 0;
  const [done, total] = str.split('/').map(Number);
  if (!total || Number.isNaN(done)) return 0;
  return (done / total) * 100;
}

/* ─── Small pieces ─────────────────────────────────────────────────────────── */

function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

function DashboardCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card shadow-soft',
        className,
      )}
      style={style}
    >
      {children}
    </section>
  );
}

function ProgressBar({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const pct = Math.max(0, Math.min(value, 100));
  return (
    <div className={cn('h-2 overflow-hidden rounded-lg bg-muted', className)}>
      <div
        className={cn(
          'h-full rounded-lg bg-primary transition-[width] duration-700 ease-out',
          indicatorClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-lg px-2.5 text-xs font-bold tabular-nums',
        tone === 'success' && 'bg-primary/10 text-primary',
        tone === 'warning' && 'bg-[color:var(--accent-amber)]/15 text-[color:var(--accent-amber)]',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

function GoalSummaryCard({
  streak,
  todaySessions,
}: {
  streak: number;
  todaySessions: number;
}) {
  const todayProgress = Math.min(todaySessions / TODAY_GOAL_SENTENCES, 1) * 100;
  return (
    <DashboardCard className="p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <MicroLabel className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-[color:var(--accent-amber)]" />
            Current streak
          </MicroLabel>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-extrabold leading-none tracking-[-0.04em] text-[color:var(--accent-amber)] tabular-nums">
              {streak}
            </span>
            <span className="pb-1 text-sm font-semibold text-muted-foreground">
              day{streak === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <MicroLabel className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" />
              Today&apos;s goal
            </MicroLabel>
            <span className="text-sm font-bold tabular-nums">
              {todaySessions}/{TODAY_GOAL_SENTENCES}
            </span>
          </div>
          <ProgressBar
            value={todayProgress}
            className="mt-3 bg-border/60"
            indicatorClassName="shadow-[0_0_8px_rgb(15_159_131_/_0.35)]"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            sentences completed today
          </p>
        </div>
      </div>
    </DashboardCard>
  );
}

function ContinueLearningCard({
  continueTarget,
  continueVideo,
  onContinue,
}: {
  continueTarget?: HistoryEntryResponse;
  continueVideo?: VideoResponse;
  onContinue: () => void;
}) {
  const inProgress = continueTarget && continueTarget.status !== 'completed';
  const ctaTitle = continueTarget?.video_title ?? 'Pick a video from your library';
  const progress = inProgress ? progressToPercent(continueTarget.progress_str) : 0;

  return (
    <DashboardCard className="overflow-hidden">
      <button
        onClick={onContinue}
        className="group grid w-full gap-4 bg-linear-to-br from-primary to-accent-blue p-5 text-left text-white transition-all duration-150 hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[154px_minmax(0,1fr)_auto] sm:p-6"
      >
        {continueVideo?.thumbnail_url ? (
          <img
            src={continueVideo.thumbnail_url}
            alt=""
            className="h-32 w-full rounded-xl bg-white/15 object-cover shadow-soft sm:h-28"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center rounded-xl bg-white/15 text-white sm:h-28">
            <PlayCircle className="h-8 w-8" />
          </div>
        )}

        <div className="min-w-0 self-center">
          <MicroLabel className="text-white/80">Continue learning</MicroLabel>
          <h2 className="mt-2 truncate text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
            {ctaTitle}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {inProgress && continueTarget?.progress_str ? (
              <span className="inline-flex h-7 items-center rounded-lg bg-white/18 px-3 text-xs font-bold tabular-nums text-white ring-1 ring-white/20">
                {continueTarget.progress_str}
              </span>
            ) : (
              <span className="inline-flex h-7 items-center rounded-lg bg-white/18 px-3 text-xs font-bold tabular-nums text-white ring-1 ring-white/20">
                Ready to start
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/75">
              <Clock3 className="h-3.5 w-3.5" />
              Dictation session
            </span>
          </div>
          {inProgress && (
            <ProgressBar
              value={progress}
              className="mt-4 h-2.5 bg-white/20"
              indicatorClassName="bg-white"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 self-center sm:flex-col sm:items-end">
          <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-primary-hover shadow-soft transition-transform duration-150 group-hover:-translate-y-0.5">
            Continue
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </button>
    </DashboardCard>
  );
}

function ReviewVocabularyCard({ onVocabulary }: { onVocabulary: () => void }) {
  return (
    <button
      onClick={onVocabulary}
      className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-all duration-150 hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <BookMarked className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Review vocabulary</span>
        <span className="block truncate text-xs text-muted-foreground">
          Practice saved words before your next session
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <DashboardCard className="p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/25">
      <div className="flex items-start justify-between gap-3">
        <MicroLabel>{label}</MicroLabel>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-extrabold leading-none tracking-[-0.03em] tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
    </DashboardCard>
  );
}

/* ─── Activity chart ──────────────────────────────────────────────────────── */

function ActivityChart({
  days,
  avgAccuracy,
}: {
  days: HeatmapDay[];
  avgAccuracy?: number;
}) {
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  return (
    <DashboardCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <MicroLabel className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            Last 30 days activity
          </MicroLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily listening sessions
          </p>
        </div>
        {avgAccuracy != null && (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Average accuracy
            </p>
            <p className="mt-0.5 text-xl font-extrabold leading-none tabular-nums">
              {Math.round(avgAccuracy)}%
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-border bg-background/60 p-3">
        <div className="grid h-28 [grid-template-columns:repeat(30,minmax(0,1fr))] items-end gap-1">
          {days.map((d, i) => {
            const h = d.count > 0 ? Math.max(14, (d.count / maxCount) * 100) : 4;
            const color =
              d.level >= 3 ? 'bg-primary' :
              d.level >= 2 ? 'bg-primary-light' :
              d.level >= 1 ? 'bg-accent-yellow' :
              'bg-primary-soft';
            return (
              <div
                key={d.date}
                className="flex h-full items-end"
                title={`${formatMonthDay(d.date)} · ${d.count} session${d.count === 1 ? '' : 's'}`}
              >
                <div
                  className={cn(
                    'w-full rounded-t-md dash-bar transition-all duration-150 hover:brightness-95',
                    color,
                  )}
                  style={{
                    height: `${h}%`,
                    animationDelay: `${120 + i * 12}ms`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">{formatMonthDay(days[0].date)}</span>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent-yellow" />
            active
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary-light" />
            great
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            peak
          </span>
        </div>
        <span>Today</span>
      </div>
    </DashboardCard>
  );
}

function RecentSessionRow({
  entry,
  video,
  onOpen,
}: {
  entry: HistoryEntryResponse;
  video?: VideoResponse;
  onOpen: () => void;
}) {
  const clickable = !!video;
  const isCompleted = entry.status === 'completed';
  return (
    <li>
      <button
        type="button"
        onClick={clickable ? onOpen : undefined}
        disabled={!clickable}
        className={cn(
          'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-150 sm:grid-cols-[86px_minmax(0,1fr)_auto_auto]',
          clickable && 'hover:border-border hover:bg-muted/35',
          !clickable && 'cursor-default',
        )}
      >
        <span className="hidden text-xs font-semibold tabular-nums text-muted-foreground sm:block">
          {formatMonthDay(entry.completed_at ?? entry.updated_at)}
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <span className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            isCompleted ? 'bg-primary/10 text-primary' : 'bg-[color:var(--accent-amber)]/15 text-[color:var(--accent-amber)]',
          )}>
            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{entry.video_title}</span>
            <span className="block text-xs text-muted-foreground sm:hidden">
              {formatMonthDay(entry.completed_at ?? entry.updated_at)}
            </span>
          </span>
        </span>
        <Badge tone={isCompleted ? 'success' : 'warning'}>
          {isCompleted ? 'Done' : entry.progress_str}
        </Badge>
        {entry.score != null && (
          <span className="hidden w-14 text-right text-sm font-extrabold tabular-nums sm:block">
            {Math.round(entry.score)}%
          </span>
        )}
      </button>
    </li>
  );
}

/* ─── Skeletons ───────────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="h-56 rounded-2xl border border-border bg-card shadow-soft" />
        <div className="space-y-4">
          <div className="h-40 rounded-2xl border border-border bg-card shadow-soft" />
          <div className="h-20 rounded-2xl border border-border bg-card shadow-soft" />
        </div>
      </div>
      <div className="h-56 rounded-2xl border border-border bg-card shadow-soft" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-border bg-card shadow-soft" />
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError } = useDashboard();
  const { data: history = [], isLoading: historyLoading } = useDashboardHistory({ limit: 5 });
  const { data: videos = [] } = useVideos();

  const stats = data?.stats;
  const last30 = buildLast30Days(data?.heatmap ?? []);
  const todaySessions = last30[last30.length - 1]?.count ?? 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = user?.display_name ?? 'there';

  const continueTarget = pickContinueTarget(history);
  const continueVideo = findVideoForHistory(continueTarget, videos);

  const goContinue = () => {
    if (continueVideo) navigate(`/dictation/${continueVideo.id}`);
    else navigate('/library');
  };

  return (
    <PageContainer>
      <PageStickyArea>
        <PageHeader
          title={`${greeting}, ${displayName}.`}
          actions={(
            <CountBadge icon={<CalendarDays className="h-4 w-4 text-primary" />}>
              {new Date().toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
            </CountBadge>
          )}
        />
      </PageStickyArea>

      <PageScrollArea>

        {isError ? (
          <DashboardCard className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> Failed to load dashboard
          </DashboardCard>
        ) : isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <GoalSummaryCard
                streak={stats?.current_streak ?? 0}
                todaySessions={todaySessions}
              />
              <div className="flex flex-col gap-4">
                <ContinueLearningCard
                  continueTarget={continueTarget}
                  continueVideo={continueVideo}
                  onContinue={goContinue}
                />
                <ReviewVocabularyCard onVocabulary={() => navigate('/vocabulary')} />
              </div>
            </section>

            <RecommendedVideosSection />

            <ActivityChart days={last30} avgAccuracy={stats?.average_accuracy} />

            {stats && (
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={ListChecks}
                  label="Sessions"
                  value={`${stats.total_sessions}`}
                  sub={`${stats.total_time_minutes} min total`}
                />
                <StatCard
                  icon={Percent}
                  label="Accuracy"
                  value={`${Math.round(stats.average_accuracy)}%`}
                  sub="All-time avg"
                />
                <StatCard
                  icon={Target}
                  label="Sentences"
                  value={`${stats.total_sentences}`}
                  sub="Completed lines"
                />
                <StatCard
                  icon={Video}
                  label="Videos"
                  value={`${stats.total_videos}`}
                  sub={`Longest streak: ${stats.longest_streak}d`}
                />
              </section>
            )}
          </>
        )}

        {/* Recent sessions */}
        <DashboardCard className="dash-enter p-4 sm:p-5" style={{ animationDelay: '400ms' }}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <MicroLabel>Recent sessions</MicroLabel>
              <p className="mt-1 text-sm text-muted-foreground">
                Your latest listening practice
              </p>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-all hover:border-primary/30 hover:text-primary"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {historyLoading ? (
            <ul className="space-y-2 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[86px_minmax(0,1fr)_72px] items-center gap-3 rounded-xl border border-border px-3 py-3"
                >
                  <div className="h-3 w-14 rounded bg-muted" />
                  <div className="h-4 rounded bg-muted" />
                  <div className="h-6 rounded-full bg-muted" />
                </li>
              ))}
            </ul>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 py-8 text-center">
              <div className="h-8 w-8 mx-auto rounded-full border border-border flex items-center justify-center mb-2">
                <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">No sessions yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Start a dictation to see your progress here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {history.map((h) => {
                const video = findVideoForHistory(h, videos);
                return (
                  <RecentSessionRow
                    key={h.id}
                    entry={h}
                    video={video}
                    onOpen={() => navigate(`/dictation/${video!.id}`)}
                  />
                );
              })}
            </ul>
          )}
        </DashboardCard>
      </PageScrollArea>
    </PageContainer>
  );
}
