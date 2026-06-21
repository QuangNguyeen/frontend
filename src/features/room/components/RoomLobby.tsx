import { useState } from 'react';
import { Copy, Check, Users, Play, Wifi, WifiOff, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { WSMemberInfo } from '../types/room';

interface RoomLobbyProps {
  roomCode: string;
  members: WSMemberInfo[];
  hostUserId: string | null;
  currentUserId: string | null;
  maxPlayers: number;
  maxReplays: number;
  examDurationMinutes: number;
  onReady: () => void;
  onStartGame: () => void;
}

export function RoomLobby({
  roomCode,
  members,
  hostUserId,
  currentUserId,
  maxPlayers,
  maxReplays,
  examDurationMinutes,
  onReady,
  onStartGame,
}: RoomLobbyProps) {
  const [copied, setCopied] = useState(false);
  const isHost = currentUserId === hostUserId;
  const currentMember = members.find(m => m.user_id === currentUserId);
  const allReady = members.length >= 2 && members.every(m => m.is_ready);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    toast.success('Room code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-page flex min-h-full items-start justify-center p-4 sm:items-center">
      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <div className="app-card p-5 text-center md:text-left">
        <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground mb-2">
          Room Code
        </p>
        <button
          onClick={handleCopy}
          className="inline-flex max-w-full items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 shadow-soft transition-colors hover:bg-muted/70 sm:px-5"
        >
          <span className="min-w-0 break-all font-mono text-xl font-bold tracking-[0.18em] sm:text-2xl sm:tracking-[0.28em]">{roomCode}</span>
          {copied
            ? <Check className="h-5 w-5 text-green-500" />
            : <Copy className="h-5 w-5 text-muted-foreground" />}
        </button>
        <p className="text-xs text-muted-foreground mt-2">Share this code with other players</p>

        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground md:justify-start">
          <span className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1">
            <Users className="h-3.5 w-3.5" /> Max {maxPlayers}
          </span>
          <span className="rounded-full border border-border bg-card px-2 py-1">Replays: {maxReplays}</span>
          <span className="rounded-full border border-border bg-card px-2 py-1">Time: {examDurationMinutes > 0 ? `${examDurationMinutes}min` : 'No limit'}</span>
        </div>
      </div>

      <div className="app-card p-4">
        <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          Players ({members.length}/{maxPlayers})
        </p>
        <div className="overflow-hidden rounded-lg border border-border bg-card divide-y divide-border">
          {members.map(m => {
            const isMe = m.user_id === currentUserId;
            const isMemberHost = m.user_id === hostUserId;
            return (
              <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-sm font-medium truncate', isMe && 'text-primary')}>
                      {m.display_name}
                    </span>
                    {isMemberHost && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                    {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.is_connected
                    ? <Wifi className="h-3.5 w-3.5 text-green-500" />
                    : <WifiOff className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    m.is_ready
                      ? 'bg-green-100 text-green-700'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {m.is_ready ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center md:col-span-2">
        <Button
          variant={currentMember?.is_ready ? 'outline' : 'default'}
          onClick={onReady}
          className="w-full sm:w-auto"
        >
          {currentMember?.is_ready ? 'Cancel Ready' : 'Ready Up'}
        </Button>

        {isHost && (
          <Button
            onClick={onStartGame}
            disabled={!allReady}
            className="w-full gap-1.5 sm:w-auto"
          >
            <Play className="h-4 w-4 fill-current" />
            Start Game
          </Button>
        )}
      </div>

      {isHost && !allReady && members.length >= 2 && (
        <p className="text-center text-xs text-muted-foreground md:col-span-2 sm:text-right">All players must be ready to start</p>
      )}
      {members.length < 2 && (
        <p className="text-center text-xs text-muted-foreground md:col-span-2 sm:text-right">Need at least 2 players to start</p>
      )}
      </div>
    </div>
  );
}
