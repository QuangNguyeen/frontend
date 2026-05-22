import { useNavigate } from 'react-router-dom';
import {
  PlayCircle, BookMarked, ArrowRight, AlertCircle, Flame,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDashboard, useDashboardHistory } from '../hooks/useDashboard';
import { useVideos } from '@/features/library/hooks/useVideos';
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
        'text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 px-5 py-4 min-w-0">
      <MicroLabel>{label}</MicroLabel>
      <p className="text-xl font-semibold mt-1.5 leading-none tabular-nums tracking-tight">
        {value}
      </p>
      {sub && <p className="text-sm text-muted-foreground mt-1.5 leading-snug">{sub}</p>}
    </div>
  );
}

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

function Hero({
  streak,
  todaySessions,
  continueTarget,
  continueVideo,
  onContinue,
  onVocabulary,
  onLibrary,
}: {
  streak: number;
  todaySessions: number;
  continueTarget?: HistoryEntryResponse;
  continueVideo?: VideoResponse;
  onContinue: () => void;
  onVocabulary: () => void;
  onLibrary: () => void;
}) {
  const todayProgress = Math.min(todaySessions / TODAY_GOAL_SENTENCES, 1);
  const inProgress = continueTarget && continueTarget.status !== 'completed';
  const ctaLabel = continueTarget
    ? inProgress ? 'Continue' : 'Start new session'
    : 'Start your first session';
  const ctaTitle = continueTarget?.video_title ?? 'Pick a video from your library';
  const ctaProgressPct = inProgress ? progressToPercent(continueTarget.progress_str) : 0;

  return (
    <section className="grid grid-cols-12 gap-5 lg:gap-8 items-center">
      {/* Streak numeral — 5/12 */}
      <div
        className="col-span-12 lg:col-span-5 dash-enter"
        style={{ animationDelay: '0ms' }}
      >
        <MicroLabel className="flex items-center gap-1.5">
          <Flame className="h-3 w-3 text-[color:var(--accent-amber)]" />
          Current streak
        </MicroLabel>
        <p
          className="font-semibold tracking-[-0.04em] leading-[0.88] mt-2 tabular-nums text-[color:var(--accent-amber)]"
          style={{ fontSize: 'clamp(4rem, 10vw, 7rem)' }}
        >
          {streak}
        </p>
        <div className="mt-4 max-w-sm">
          <p className="text-sm text-foreground leading-snug">
            <span className="text-muted-foreground">Today's goal:</span>{' '}
            <span className="font-semibold tabular-nums">
              {todaySessions} / {TODAY_GOAL_SENTENCES} sentences
            </span>
          </p>
          <div className="mt-2 h-1.5 w-full bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-[color:var(--accent-emerald)] transition-[width] duration-700 ease-out"
              style={{ width: `${todayProgress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* CTA stack — 7/12 */}
      <div
        className="col-span-12 lg:col-span-7 flex flex-col gap-2.5 dash-enter"
        style={{ animationDelay: '100ms' }}
      >
        <button
          onClick={onContinue}
          className="group relative flex items-center gap-4 h-16 px-4 bg-[color:var(--accent-emerald)] text-[color:var(--accent-emerald-foreground)] rounded-xl overflow-hidden shadow-soft-lg transition-all duration-150 ease-out hover:brightness-110 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent-emerald)]"
        >
          {continueVideo?.thumbnail_url ? (
            <img
              src={continueVideo.thumbnail_url}
              alt=""
              className="h-11 w-16 object-cover rounded-md shrink-0 bg-black/20"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-11 w-16 rounded-md bg-white/15 flex items-center justify-center shrink-0">
              <PlayCircle className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 text-left min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase opacity-85">
              {ctaLabel}
            </p>
            <p className="text-base font-semibold truncate mt-0.5 leading-tight">
              {ctaTitle}
            </p>
          </div>
          {inProgress && continueTarget?.progress_str && (
            <span className="text-base font-semibold tabular-nums opacity-95 shrink-0">
              {continueTarget.progress_str}
            </span>
          )}
          <ArrowRight className="h-5 w-5 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
          {inProgress && (
            <span
              className="absolute bottom-0 left-0 h-[2px] bg-white/80 transition-[width] duration-700 ease-out"
              style={{ width: `${ctaProgressPct}%` }}
            />
          )}
        </button>

        <button
          onClick={onVocabulary}
          className="group flex items-center gap-3 h-12 px-4 border border-border bg-card rounded-xl transition-all duration-150 ease-out hover:border-foreground/60 hover:bg-muted/40 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BookMarked className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium flex-1 text-left">Review vocabulary</span>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
        </button>

        <button
          onClick={onLibrary}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors self-start mt-1 inline-flex items-center gap-1.5"
        >
          Browse library
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

/* ─── 30-day timeline ─────────────────────────────────────────────────────── */

function Timeline({
  days,
  avgAccuracy,
}: {
  days: HeatmapDay[];
  avgAccuracy?: number;
}) {
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  return (
    <section className="dash-enter" style={{ animationDelay: '200ms' }}>
      <div className="flex items-baseline justify-between mb-3">
        <MicroLabel>Last 30 days</MicroLabel>
        {avgAccuracy != null && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {Math.round(avgAccuracy)}% avg accuracy
          </p>
        )}
      </div>
      <div className="flex items-end gap-[3px] h-20 border-t border-b border-border py-3">
        {days.map((d, i) => {
          const h = d.count > 0 ? Math.max(10, (d.count / maxCount) * 72) : 3;
          const color =
            d.level >= 3 ? 'var(--accent-emerald)' :
            d.level >= 1 ? 'var(--accent-amber)' :
            'var(--border)';
          return (
            <div
              key={d.date}
              className="flex-1 min-w-0 rounded-[2px] dash-bar transition-[filter,transform] duration-150 ease-out hover:brightness-90"
              style={{
                height: `${h}px`,
                backgroundColor: color,
                animationDelay: `${240 + i * 14}ms`,
              }}
              title={`${formatMonthDay(d.date)} · ${d.count} session${d.count === 1 ? '' : 's'}`}
            />
          );
        })}
      </div>
      <div className="flex items-baseline justify-between mt-3 flex-wrap gap-y-2">
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatMonthDay(days[0].date)}
        </p>
        <div className="flex items-center gap-5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[color:var(--accent-amber)]" />
            active
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[color:var(--accent-emerald)]" />
            high intensity
          </span>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">Today</p>
      </div>
    </section>
  );
}

/* ─── Skeletons ───────────────────────────────────────────────────────────── */

function HeroSkeleton() {
  return (
    <section className="grid grid-cols-12 gap-5 lg:gap-8 items-center animate-pulse">
      <div className="col-span-12 lg:col-span-5">
        <div className="h-3 w-32 bg-muted rounded" />
        <div
          className="mt-2 bg-muted rounded"
          style={{ height: 'clamp(3.5rem, 8vw, 6rem)', width: '60%' }}
        />
        <div className="mt-3 h-4 w-48 bg-muted rounded" />
        <div className="mt-2 h-1 w-full max-w-xs bg-muted rounded" />
      </div>
      <div className="col-span-12 lg:col-span-7 flex flex-col gap-2.5">
        <div className="h-16 bg-muted rounded-xl" />
        <div className="h-12 bg-muted/60 rounded-xl" />
      </div>
    </section>
  );
}

function TimelineSkeleton() {
  return (
    <section className="animate-pulse">
      <div className="h-3 w-24 bg-muted rounded mb-4" />
      <div className="flex items-end gap-[3px] h-24 border-t border-b border-border py-3">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-muted rounded-[2px]"
            style={{ height: `${10 + ((i * 7) % 55)}px` }}
          />
        ))}
      </div>
    </section>
  );
}

function StatsSkeleton() {
  return (
    <section className="flex divide-x divide-border border-y border-border bg-card rounded-xl shadow-soft animate-pulse overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex-1 px-5 py-4">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-6 w-20 bg-muted rounded mt-2" />
          <div className="h-3 w-28 bg-muted rounded mt-2" />
        </div>
      ))}
    </section>
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
    <div className="min-h-full bg-background">
      {/* Greeting bar */}
      <header
        className="border-b border-border bg-card px-[var(--page-px)] sm:px-8 py-3 flex items-baseline justify-between gap-4 dash-enter"
        style={{ animationDelay: '0ms' }}
      >
        <h1 className="text-lg font-semibold tracking-tight">
          {greeting}, {displayName}.
        </h1>
        <p className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground shrink-0">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </p>
      </header>

      <div className="px-[var(--page-px)] sm:px-8 py-[var(--page-py)] max-w-[1240px] space-y-6">

        {isError ? (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" /> Failed to load dashboard
          </div>
        ) : isLoading ? (
          <>
            <HeroSkeleton />
            <TimelineSkeleton />
            <StatsSkeleton />
          </>
        ) : (
          <>
            <Hero
              streak={stats?.current_streak ?? 0}
              todaySessions={todaySessions}
              continueTarget={continueTarget}
              continueVideo={continueVideo}
              onContinue={goContinue}
              onVocabulary={() => navigate('/vocabulary')}
              onLibrary={() => navigate('/library')}
            />

            <Timeline days={last30} avgAccuracy={stats?.average_accuracy} />

            {stats && (
              <section
                className="flex divide-x divide-border border-y border-border bg-card rounded-xl shadow-soft dash-enter overflow-hidden"
                style={{ animationDelay: '300ms' }}
              >
                <Stat
                  label="Sessions"
                  value={`${stats.total_sessions}`}
                  sub={`${stats.total_time_minutes} min total`}
                />
                <Stat
                  label="Accuracy"
                  value={`${Math.round(stats.average_accuracy)}%`}
                  sub="All-time avg"
                />
                <Stat
                  label="Sentences"
                  value={`${stats.total_sentences}`}
                />
                <Stat
                  label="Videos"
                  value={`${stats.total_videos}`}
                  sub={`Longest streak: ${stats.longest_streak}d`}
                />
              </section>
            )}
          </>
        )}

        {/* Recent sessions */}
        <section className="dash-enter" style={{ animationDelay: '400ms' }}>
          <div className="flex items-baseline justify-between mb-3">
            <MicroLabel>Recent sessions</MicroLabel>
            <button
              onClick={() => navigate('/history')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {historyLoading ? (
            <ul className="border-t border-border animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center gap-4 border-b border-border py-3.5 px-3"
                >
                  <div className="h-3 w-14 bg-muted rounded" />
                  <div className="h-4 flex-1 bg-muted rounded" />
                  <div className="h-4 w-14 bg-muted rounded" />
                </li>
              ))}
            </ul>
          ) : history.length === 0 ? (
            <div className="border-t border-b border-border py-6 text-center bg-card rounded-xl">
              <div className="h-8 w-8 mx-auto rounded-full border border-border flex items-center justify-center mb-2">
                <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">No sessions yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Start a dictation to see your progress here.
              </p>
            </div>
          ) : (
            <ul className="border-t border-border">
              {history.map((h) => {
                const video = findVideoForHistory(h, videos);
                const clickable = !!video;
                return (
                  <li
                    key={h.id}
                    onClick={clickable ? () => navigate(`/dictation/${video!.id}`) : undefined}
                    className={cn(
                      'flex items-center gap-4 border-b border-border py-3.5 px-3 -mx-3 rounded-md transition-colors duration-150 ease-out',
                      clickable && 'cursor-pointer hover:bg-muted/60',
                    )}
                  >
                    <p className="text-sm tabular-nums text-muted-foreground w-16 shrink-0">
                      {formatMonthDay(h.completed_at ?? h.updated_at)}
                    </p>
                    <p className="flex-1 text-base font-medium truncate">{h.video_title}</p>
                    <p
                      className={cn(
                        'text-sm tabular-nums shrink-0',
                        h.status === 'completed'
                          ? 'text-muted-foreground'
                          : 'text-[color:var(--accent-amber)] font-semibold',
                      )}
                    >
                      {h.status === 'completed' ? 'Done' : h.progress_str}
                    </p>
                    {h.score != null && (
                      <p className="text-base font-semibold tabular-nums w-14 text-right shrink-0">
                        {Math.round(h.score)}%
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
