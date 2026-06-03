import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  WSRoomState,
  WSGameStart,
  WSSubmitResult,
  WSLeaderboardUpdate,
  WSGameEnd,
  WSMemberInfo,
  WSRankingEntry,
  WSSubmitPayload,
  RoomPhase,
} from '../types/room';

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/^http/, 'ws');

interface UseRoomWebSocketReturn {
  phase: RoomPhase;
  roomState: WSRoomState | null;
  gameStart: WSGameStart | null;
  lastSubmitResult: WSSubmitResult | null;
  rankings: WSRankingEntry[];
  gameEnd: WSGameEnd | null;
  members: WSMemberInfo[];
  hostUserId: string | null;
  isConnected: boolean;
  sendReady: () => void;
  sendStartGame: () => void;
  sendSubmit: (payload: WSSubmitPayload) => void;
  sendForceEnd: () => void;
}

export function useRoomWebSocket(roomCode: string | undefined): UseRoomWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectDelay = useRef(1000);

  const [isConnected, setIsConnected] = useState(false);
  const [phase, setPhase] = useState<RoomPhase>('lobby');
  const [roomState, setRoomState] = useState<WSRoomState | null>(null);
  const [gameStart, setGameStart] = useState<WSGameStart | null>(null);
  const [lastSubmitResult, setLastSubmitResult] = useState<WSSubmitResult | null>(null);
  const [rankings, setRankings] = useState<WSRankingEntry[]>([]);
  const [gameEnd, setGameEnd] = useState<WSGameEnd | null>(null);
  const [members, setMembers] = useState<WSMemberInfo[]>([]);
  const [hostUserId, setHostUserId] = useState<string | null>(null);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    function connect() {
      const url = `${WS_BASE}/api/v1/rooms/ws/${roomCode}?token=${token}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectDelay.current = 1000;
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 10000);
          connect();
        }, reconnectDelay.current);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const { type, payload } = msg;

        switch (type) {
          case 'room_state': {
            const state = payload as WSRoomState;
            setRoomState(state);
            setMembers(state.members);
            setHostUserId(state.host_user_id);
            if (state.status === 'active') setPhase('playing');
            else if (state.status === 'finished') setPhase('result');
            else setPhase('lobby');
            break;
          }
          case 'member_joined':
            setMembers(prev => {
              if (prev.find(m => m.user_id === payload.user_id)) return prev;
              return [...prev, {
                user_id: payload.user_id,
                display_name: payload.display_name,
                is_ready: false,
                sentences_done: 0,
                total_score: 0,
                is_finished: false,
                is_connected: true,
              }];
            });
            break;
          case 'member_ready':
            setMembers(prev =>
              prev.map(m =>
                m.user_id === payload.user_id ? { ...m, is_ready: payload.is_ready } : m
              )
            );
            break;
          case 'member_status':
            setMembers(prev =>
              prev.map(m =>
                m.user_id === payload.user_id ? { ...m, is_connected: payload.is_connected } : m
              )
            );
            break;
          case 'host_changed':
            setHostUserId(payload.new_host_user_id);
            break;
          case 'game_start':
            setGameStart(payload as WSGameStart);
            setPhase('playing');
            break;
          case 'submit_result':
            setLastSubmitResult(payload as WSSubmitResult);
            break;
          case 'leaderboard_update':
            setRankings((payload as WSLeaderboardUpdate).rankings);
            break;
          case 'game_end':
            setGameEnd(payload as WSGameEnd);
            setPhase('result');
            break;
        }
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [roomCode]);

  return {
    phase,
    roomState,
    gameStart,
    lastSubmitResult,
    rankings,
    gameEnd,
    members,
    hostUserId,
    isConnected,
    sendReady: useCallback(() => send({ type: 'ready' }), [send]),
    sendStartGame: useCallback(() => send({ type: 'start_game' }), [send]),
    sendSubmit: useCallback((payload: WSSubmitPayload) => send({ type: 'submit', payload }), [send]),
    sendForceEnd: useCallback(() => send({ type: 'force_end' }), [send]),
  };
}
