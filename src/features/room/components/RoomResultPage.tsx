import { Trophy, Medal, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { WSGameEnd } from '../types/room';

interface RoomResultPageProps {
  gameEnd: WSGameEnd;
  currentUserId: string | null;
}

export function RoomResultPage({ gameEnd, currentUserId }: RoomResultPageProps) {
  const rankings = gameEnd.final_rankings;
  const myRank = rankings.find(r => r.user_id === currentUserId);

  const reasonLabel =
    gameEnd.reason === 'time_up' ? 'Time expired' :
    gameEnd.reason === 'host_ended' ? 'Host ended the game' :
    'All players finished';

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-5 gap-5">
      <div className="text-center">
        <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-1">Game Over!</h1>
        <p className="text-sm text-muted-foreground">{reasonLabel}</p>
      </div>

      {myRank && (
        <div className="text-center px-6 py-4 bg-card border border-border rounded-2xl shadow-soft">
          <p className="text-sm text-muted-foreground mb-1">Your Result</p>
          <p className="text-3xl font-bold tabular-nums">#{myRank.rank}</p>
          <p className="text-lg font-semibold tabular-nums mt-1">
            {myRank.total_score.toFixed(1)} pts
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {myRank.sentences_done} sentences completed
          </p>
        </div>
      )}

      <div className="w-full max-w-md">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Medal className="h-4 w-4" />
          Final Rankings
        </h2>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {rankings.map((entry) => {
            const isYou = entry.user_id === currentUserId;
            return (
              <div
                key={entry.user_id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  isYou && 'bg-primary/5',
                )}
              >
                <span className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                  entry.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                  entry.rank === 2 ? 'bg-gray-100 text-gray-600' :
                  entry.rank === 3 ? 'bg-orange-100 text-orange-600' :
                  'bg-muted text-muted-foreground',
                )}>
                  {entry.rank}
                </span>

                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', isYou && 'text-primary')}>
                    {entry.display_name}
                    {isYou && <span className="text-xs ml-1 opacity-60">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {entry.sentences_done} sentences
                  </p>
                </div>

                <span className="text-base font-bold tabular-nums">
                  {entry.total_score.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Link to="/library">
        <Button variant="outline" className="gap-1.5 rounded-xl">
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Button>
      </Link>
    </div>
  );
}
