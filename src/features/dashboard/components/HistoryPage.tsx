import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Clock, Calendar, Filter, Loader2, AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dashboardApi } from '@/shared/lib/api';
import { cn } from '@/lib/utils';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn(
      'text-sm font-semibold px-2.5 py-1 rounded-full',
      score >= 80 ? 'bg-green-100 text-green-700' :
      score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
    )}>
      {Math.round(score)}%
    </span>
  );
}

type SortKey = 'recent' | 'best';

export function HistoryPage() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>('recent');

  const { data: history = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['history-full'],
    queryFn: () => dashboardApi.getHistory({ limit: 100 }),
  });

  const sorted = [...history].sort((a, b) =>
    sort === 'best'
      ? b.score - a.score
      : new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );

  const totalTime = history.reduce((s, h) => s + h.duration_minutes, 0);
  const avgScore = history.length > 0
    ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length)
    : 0;
  const bestScore = history.length > 0 ? Math.max(...history.map((h) => h.score)) : 0;

  return (
    <div className="min-h-full">
      <div className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold">Session History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All your completed dictation sessions</p>
      </div>

      <div className="px-6 py-6 max-w-3xl space-y-6">
        {/* Summary */}
        {!isLoading && !isError && history.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{history.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Sessions</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{avgScore}%</p>
              <p className="text-xs text-muted-foreground mt-1">Avg. Accuracy</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{Math.round(totalTime)}m</p>
              <p className="text-xs text-muted-foreground mt-1">Total Time</p>
            </div>
          </div>
        )}

        {/* Sort filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1.5">
            {(['recent', 'best'] as SortKey[]).map((f) => (
              <button
                key={f}
                onClick={() => setSort(f)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all',
                  sort === f
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                )}
              >
                {f === 'recent' ? 'Most Recent' : 'Best Score'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading history...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">Failed to load history</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-medium mb-1">No sessions yet</p>
            <p className="text-sm">Complete a dictation session to see your history here.</p>
            <Button className="mt-4" size="sm" onClick={() => navigate('/library')}>Browse Videos</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((entry) => (
              <div key={entry.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.video_title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{formatDate(entry.completed_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{Math.round(entry.duration_minutes)}m
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <ScoreBadge score={entry.score} />
                      {entry.score === bestScore && history.length > 1 && (
                        <p className="text-xs text-yellow-500 font-medium mt-1 flex items-center gap-0.5 justify-end">
                          <TrendingUp className="h-3 w-3" />Best
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                      onClick={() => navigate(`/dictation/${entry.id}`)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />Retry
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}