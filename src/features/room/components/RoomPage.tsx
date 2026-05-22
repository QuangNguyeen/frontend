import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Plus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { roomService } from '../services/roomService';
import { useRoomWebSocket } from '../hooks/useRoomWebSocket';
import { RoomLobby } from './RoomLobby';
import { RoomGamePage } from './RoomGamePage';
import { RoomResultPage } from './RoomResultPage';
import { CreateRoomModal } from './CreateRoomModal';
import { toast } from 'sonner';

function exitFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

export function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const prevPhaseRef = useRef('' as string);

  const ws = useRoomWebSocket(joined ? roomCode : undefined);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = ws.phase;

    if (ws.phase === 'playing' && prev !== 'playing') {
      gameContainerRef.current?.requestFullscreen().catch(() => {});
    }
    if (ws.phase === 'result' && prev === 'playing') {
      exitFullscreen();
    }
  }, [ws.phase]);

  const handleEndEarly = useCallback(() => {
    exitFullscreen();
    navigate('/rooms');
  }, [navigate]);

  useEffect(() => {
    if (!roomCode) return;

    setJoining(true);
    roomService
      .joinRoom(roomCode)
      .then(() => {
        setJoined(true);
        setError(null);
      })
      .catch((err) => {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || 'Failed to join room');
      })
      .finally(() => setJoining(false));
  }, [roomCode]);

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/rooms/${code}`);
  };

  const handleTimeExpired = useCallback(() => {
    toast.info('Time is up!');
  }, []);

  if (!roomCode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-5 gap-5">
        <h1 className="text-xl font-bold">Multiplayer Rooms</h1>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Button onClick={() => setShowCreate(true)} className="gap-1.5 rounded-xl h-10">
            <Plus className="h-4 w-4" />
            Create Room
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">or join existing</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="font-mono text-center tracking-widest text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
            />
            <Button onClick={handleJoinByCode} disabled={joinCode.length < 4} className="gap-1 rounded-xl">
              <LogIn className="h-4 w-4" />
              Join
            </Button>
          </div>
        </div>

        <CreateRoomModal open={showCreate} onOpenChange={setShowCreate} />
      </div>
    );
  }

  if (joining) {
    return (
      <div className="flex items-center justify-center min-h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Joining room…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">{error}</p>
        <Button variant="outline" onClick={() => navigate('/rooms/create')} className="rounded-xl">
          Back to Rooms
        </Button>
      </div>
    );
  }

  if (ws.phase === 'result' && ws.gameEnd) {
    return <RoomResultPage gameEnd={ws.gameEnd} currentUserId={user?.id ?? null} />;
  }

  if (ws.phase === 'playing' && ws.gameStart) {
    return (
      <div ref={gameContainerRef} className="h-full bg-background">
        <RoomGamePage
          gameStart={ws.gameStart}
          lastSubmitResult={ws.lastSubmitResult}
          rankings={ws.rankings}
          members={ws.members}
          currentUserId={user?.id ?? null}
          onSubmit={ws.sendSubmit}
          onTimeExpired={handleTimeExpired}
          onEndEarly={handleEndEarly}
        />
      </div>
    );
  }

  return (
    <RoomLobby
      roomCode={roomCode}
      members={ws.members}
      hostUserId={ws.hostUserId}
      currentUserId={user?.id ?? null}
      maxPlayers={ws.roomState?.max_players ?? 10}
      maxReplays={ws.roomState?.max_replays ?? 3}
      examDurationMinutes={ws.roomState?.exam_duration_minutes ?? 30}
      onReady={ws.sendReady}
      onStartGame={ws.sendStartGame}
    />
  );
}
