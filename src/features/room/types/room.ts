import type { WordDiffItem } from '@/shared/types/api';

// ── HTTP ──────────────────────────────────────────────────────────────────────

export interface CreateRoomRequest {
  video_id: string;
  max_players: number;
  max_replays: number;
  exam_duration_minutes: number;
}

export interface CreateRoomResponse {
  room_code: string;
  room_id: string;
}

export interface JoinRoomResponse {
  room_code: string;
  status: string;
  host_user_id: string;
  video_id: string;
  max_replays: number;
  exam_duration_minutes: number;
  total_sentences: number;
  member_count: number;
}

export interface RoomSnapshotMember {
  user_id: string;
  display_name: string;
  is_ready: boolean;
  sentences_done: number;
  total_score: number;
  is_finished: boolean;
  is_connected?: boolean;
}

export interface RoomSnapshotResponse {
  room_code: string;
  status: string;
  host_user_id: string;
  video_id: string;
  max_replays: number;
  exam_duration_minutes: number;
  total_sentences: number;
  members: RoomSnapshotMember[];
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export interface WSSentenceInfo {
  index: number;
  start_time: number;
  end_time: number;
}

export interface WSMemberInfo {
  user_id: string;
  display_name: string;
  is_ready: boolean;
  sentences_done: number;
  total_score: number;
  is_finished: boolean;
  is_connected?: boolean;
}

export interface WSRankingEntry {
  rank: number;
  user_id: string;
  display_name: string;
  total_score: number;
  sentences_done: number;
  accuracy_pct: number;
  is_finished: boolean;
}

export interface WSRoomState {
  status: string;
  max_players: number;
  max_replays: number;
  exam_duration_minutes: number;
  host_user_id: string;
  video_id: string;
  total_sentences: number;
  members: WSMemberInfo[];
  your_sentences_done: number;
}

export interface WSGameStart {
  youtube_id: string;
  total_sentences: number;
  max_replays: number;
  exam_duration_minutes: number;
  exam_ends_at: string | null;
  sentences: WSSentenceInfo[];
}

export interface WSSubmitResult {
  sentence_index: number;
  correct_text: string;
  accuracy_score: number;
  time_bonus: number;
  final_score: number;
  is_skipped: boolean;
  word_diffs: WordDiffItem[];
}

export interface WSLeaderboardUpdate {
  rankings: WSRankingEntry[];
}

export interface WSGameEnd {
  reason: 'all_finished' | 'time_up' | 'host_ended';
  final_rankings: WSRankingEntry[];
}

export interface WSSubmitPayload {
  sentence_index: number;
  user_input: string;
  is_skipped: boolean;
  replay_count: number;
}

export type RoomPhase = 'lobby' | 'playing' | 'result';
