import { useNavigate } from 'react-router-dom';
import {
  Flame, TrendingUp, Clock, PlayCircle, BookOpen,
  ChevronRight, Target, Award, Loader2, AlertCircle, Trophy,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ActivityCalendar } from 'react-activity-calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useDashboard, useDashboardHistory } from '../hooks/useDashboard';
import { useVideos } from '@/features/library/hooks/useVideos';
import { cn } from '@/lib/utils';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Build a full Jan 1 → Dec 31 array for the current year,
 * merging in actual activity counts from the API.
 */
function buildFullYearHeatmap(apiData: Array<{ date: string; count: number; level: number }>) {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);   // Jan 1
  const end = new Date(year, 11, 31);   // Dec 31

  // Index API data by date string for O(1) lookup
  const lookup = new Map(apiData.map((d) => [d.date, d]));

  const result: Array<{ date: string; count: number; level: number }> = [];
  const d = new Date(start);
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10); // "2026-01-01"
    const entry = lookup.get(iso);
    result.push(entry ?? { date: iso, count: 0, level: 0 });
    d.setDate(d.getDate() + 1);
  }
  return result;
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn(
      'text-xs font-semibold px-2 py-0.5 rounded-full',
      score >= 80 ? 'bg-green-100 text-green-700' :
      score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700',
    )}>
      {Math.round(score)}%
    </span>
  );
}

/* ─── Skeleton Loaders ─────────────────────────────────────────────────────── */

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
          <div className="h-9 w-9 rounded-lg bg-muted mb-3" />
          <div className="h-7 w-16 bg-muted rounded mb-1" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="animate-pulse bg-muted/50 rounded-lg" style={{ height }} />
  );
}

/* ─── Stat Card ────────────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center mb-3', accent ?? 'bg-muted')}>
          {icon}
        </div>
        <p className="text-2xl font-bold leading-none mb-1">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
      </CardContent>
    </Card>
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
  const currentYear = new Date().getFullYear();
  const heatmap = buildFullYearHeatmap(data?.heatmap ?? []);
  const trend = data?.accuracy_trend ?? [];

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = user?.display_name ?? 'there';

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold">{greeting}, {displayName}!</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="px-6 py-6 max-w-5xl space-y-8">

        {/* ── Stats Cards ─────────────────────────────────────────────────── */}
        {isLoading ? <StatsSkeleton /> : isError || !stats ? (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />Failed to load stats
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              icon={<Flame className="h-5 w-5 text-orange-500" />}
              label="Current Streak"
              value={`${stats.current_streak}d`}
              sub={`Longest: ${stats.longest_streak}d`}
              accent="bg-orange-100"
            />
            <StatCard
              icon={<Target className="h-5 w-5 text-blue-600" />}
              label="Avg. Accuracy"
              value={`${Math.round(stats.average_accuracy)}%`}
              sub={`${stats.total_sessions} sessions`}
              accent="bg-blue-100"
            />
            <StatCard
              icon={<Trophy className="h-5 w-5 text-amber-500" />}
              label="Sentences Done"
              value={`${stats.total_sentences}`}
              accent="bg-amber-100"
            />
            <StatCard
              icon={<Award className="h-5 w-5 text-green-600" />}
              label="Videos Studied"
              value={`${stats.total_videos}`}
              accent="bg-green-100"
            />
            <StatCard
              icon={<Clock className="h-5 w-5 text-violet-600" />}
              label="Total Sessions"
              value={`${stats.total_sessions}`}
              accent="bg-violet-100"
            />
          </div>
        )}

        {/* ── Activity Heatmap ────────────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Learning Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton height={160} /> : heatmap.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No activity yet. Start a dictation session!
              </p>
            ) : (
              <div className="overflow-x-auto pb-2">
                <ActivityCalendar
                  data={heatmap}
                  blockSize={12}
                  blockMargin={3}
                  blockRadius={3}
                  fontSize={12}
                  hideColorLegend={false}
                  hideMonthLabels={false}
                  labels={{
                    totalCount: `{{count}} sessions in ${currentYear}`,
                  }}
                  theme={{
                    light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
                    dark: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Accuracy Trend ──────────────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Accuracy Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <ChartSkeleton /> : trend.length < 2 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Complete at least 2 sessions to see your accuracy trend.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Accuracy']}
                  />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#accuracyGradient)"
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Two columns: Recent + Suggested ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent sessions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Recent Sessions
              </h2>
              <button
                onClick={() => navigate('/history')}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            {historyLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                    <div className="h-10 w-14 rounded bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-3/4 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <PlayCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No recent sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start learning to see your progress here!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                    <img
                      src={h.video_thumbnail}
                      alt=""
                      className="h-10 w-14 rounded object-cover shrink-0 bg-muted"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.video_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.completed_at ? formatDate(h.completed_at) : formatDate(h.updated_at)}
                        {' · '}
                        <span className={h.status === 'completed' ? 'text-green-600' : 'text-amber-600'}>
                          {h.status === 'completed' ? 'Completed' : `In progress (${h.progress_str})`}
                        </span>
                      </p>
                    </div>
                    {h.score != null && <ScoreBadge score={h.score} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suggested next */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Suggested Next
            </h2>
            <div className="space-y-2">
              {videos.slice(0, 3).map((v) => (
                <div key={v.id} className="bg-card border border-border rounded-lg flex items-center gap-3 overflow-hidden">
                  <img
                    src={v.thumbnail_url}
                    alt=""
                    className="h-14 w-20 object-cover shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `https://placehold.co/80x56/1a1a2e/white?text=${encodeURIComponent(v.channel)}`;
                    }}
                  />
                  <div className="flex-1 min-w-0 py-1">
                    <p className="text-sm font-medium truncate leading-snug">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{v.channel}</p>
                  </div>
                  <Button size="icon-sm" variant="ghost" className="mr-2 shrink-0" onClick={() => navigate(`/dictation/${v.id}`)}>
                    <PlayCircle className="h-5 w-5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full gap-2 mt-1" onClick={() => navigate('/library')}>
                <BookOpen className="h-3.5 w-3.5" />Browse All Videos
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}