import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Flame, TrendingUp, Clock, PlayCircle, BookOpen,
  ChevronRight, Target, Award, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dashboardApi, videosApi } from '@/shared/lib/api';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { cn } from '@/lib/utils';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn(
      'text-xs font-semibold px-2 py-0.5 rounded-full',
      score >= 80 ? 'bg-green-100 text-green-700' :
      score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
    )}>
      {Math.round(score)}%
    </span>
  );
}

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center mb-3', accent ?? 'bg-muted')}>
        {icon}
      </div>
      <p className="text-2xl font-bold leading-none mb-1">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  );
}

// Mock weekly activity (backend doesn't have this endpoint yet)
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_SESSIONS = [2, 1, 0, 3, 2, 1, 0];

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['dashboard-history', 5],
    queryFn: () => dashboardApi.getHistory({ limit: 5 }),
  });

  const { data: videos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: () => videosApi.list(),
  });

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = user?.display_name ?? 'there';

  return (
    <div className="min-h-full">
      <div className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold">{greeting}, {displayName}! 👋</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="px-6 py-6 max-w-4xl space-y-8">
        {/* Stats */}
        {statsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading stats...</span>
          </div>
        ) : statsError || !stats ? (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />Failed to load stats
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Flame className="h-5 w-5 text-orange-500" />}
              label="Day Streak"
              value={`${stats.streak_days}`}
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
              icon={<Clock className="h-5 w-5 text-violet-600" />}
              label="Study Time"
              value={`${Math.round(stats.total_time_minutes)}m`}
              sub="Total practice"
              accent="bg-violet-100"
            />
            <StatCard
              icon={<Award className="h-5 w-5 text-green-600" />}
              label="Videos Studied"
              value={`${stats.total_videos}`}
              sub="All time"
              accent="bg-green-100"
            />
          </div>
        )}

        {/* Weekly activity */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            This Week
          </h2>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-end gap-3 h-20">
              {WEEK_DAYS.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={cn('w-full rounded-sm', WEEK_SESSIONS[i] > 0 ? 'bg-primary' : 'bg-muted')}
                      style={{ height: WEEK_SESSIONS[i] > 0 ? `${(WEEK_SESSIONS[i] / 3) * 100}%` : '6px' }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Two columns */}
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
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="h-4 w-4 animate-spin" />Loading...
              </div>
            ) : history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">No sessions yet. Start practicing!</div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.video_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(h.completed_at)} · {Math.round(h.duration_minutes)}m
                      </p>
                    </div>
                    <ScoreBadge score={h.score} />
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