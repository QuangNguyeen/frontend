import { Trophy, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WSRankingEntry, WSMemberInfo } from '../types/room';

interface LiveLeaderboardProps {
  rankings: WSRankingEntry[];
  members: WSMemberInfo[];
  currentUserId: string | null;
  totalSentences: number;
}

export function LiveLeaderboard({ rankings, members, currentUserId, totalSentences }: LiveLeaderboardProps) {
  const displayList = rankings.length > 0
    ? rankings
    : members.map((m, i) => ({
        rank: i + 1,
        user_id: m.user_id,
        display_name: m.display_name,
        total_score: m.total_score,
        sentences_done: m.sentences_done,
        accuracy_pct: 0,
        is_finished: m.is_finished,
      }));

  const connectionMap = new Map(members.map(m => [m.user_id, m.is_connected ?? true]));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Leaderboard
        </p>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {displayList.map((entry) => {
          const isYou = entry.user_id === currentUserId;
          const isOnline = connectionMap.get(entry.user_id) ?? false;

          return (
            <div
              key={entry.user_id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                isYou && 'bg-primary/5',
              )}
            >
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                entry.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                entry.rank === 2 ? 'bg-muted text-muted-foreground' :
                entry.rank === 3 ? 'bg-orange-100 text-orange-600' :
                'bg-muted text-muted-foreground',
              )}>
                {entry.rank}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn('text-sm font-medium truncate', isYou && 'text-primary')}>
                    {entry.display_name}
                    {isYou && <span className="text-xs ml-1 opacity-60">(you)</span>}
                  </p>
                  {isOnline
                    ? <Wifi className="h-3 w-3 text-green-500 shrink-0" />
                    : <WifiOff className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{entry.sentences_done}/{totalSentences}</span>
                  {entry.is_finished && (
                    <span className="text-green-600 font-medium">Done</span>
                  )}
                </div>
              </div>

              <span className="text-sm font-bold tabular-nums">
                {entry.total_score.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
