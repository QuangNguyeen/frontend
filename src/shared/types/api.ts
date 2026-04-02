// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  email: string;
  display_name: string;
  preferred_language: string;
  streak_days: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  display_name: string;
  password: string;
  preferred_language?: string;
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export interface VideoResponse {
  id: string;
  youtube_id: string;
  title: string;
  channel: string;
  duration: number;
  language: string;
  level: string | null;
  is_curated: boolean;
  is_active: boolean;
  thumbnail_url: string;
}

export interface TranscriptResponse {
  id: string;
  index: number;
  text: string;
  start_time: number;
  end_time: number;
  language: string;
  translation?: string;
}

export interface LevelAnalysisResponse {
  level: string;
  score: number;
  features: {
    avg_zipf: number;
    rare_ratio: number;
    avg_sent_length: number;
    avg_dep_depth: number;
    n_sentences: number;
    n_content_words: number;
  };
  error?: string | null;
}

export interface TranscriptLanguageResponse {
  language: string;
  language_code: string;
  is_generated: boolean;
  is_translatable: boolean;
}

export interface ImportVideoRequest {
  youtube_url: string;
  title?: string;
  channel?: string;
  language?: string;
  level?: string;
  languages?: string[];
  max_segment_duration?: number;
}

// ─── Dictation ────────────────────────────────────────────────────────────────

export interface DictationSessionResponse {
  id: string;
  video_id: string;
  user_id?: string;
  started_at?: string;
}

export interface SubmitAnswerRequest {
  sentence_index: number;
  user_input: string;
  hints_used?: number;
  replay_count?: number;
}

export interface WordDiffItem {
  word: string;
  status: 'correct' | 'wrong' | 'missing';
  expected: string | null;
}

export interface SentenceResultResponse {
  sentence_index: number;
  score: number;
  word_diffs: WordDiffItem[];
  correct_count: number;
  wrong_count: number;
  missing_count: number;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStatsResponse {
  total_sessions: number;
  total_time_minutes: number;
  average_accuracy: number;
  total_videos: number;
  streak_days: number;
}

export interface HistoryEntryResponse {
  id: string;
  video_title: string;
  type: string;
  score: number;
  duration_minutes: number;
  completed_at: string;
}

// ─── Vocabulary ───────────────────────────────────────────────────────────────

export interface SaveWordRequest {
  word: string;
  video_id?: string;
  context_sentence?: string;
  audio_start_time?: number;
  meaning?: string;
  note?: string;
  source?: string;
}

export interface SavedWordResponse {
  id: string;
  word: string;
  context_sentence: string | null;
  audio_start_time: number | null;
  meaning: string | null;
  note: string | null;
  source: string;
  video_id: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  created_at: string;
}

export interface FlashCardResponse {
  id: string;
  word: string;
  context_sentence: string | null;
  audio_start_time: number | null;
  video_id: string | null;
  meaning: string | null;
}

export interface DueCardsResponse {
  cards: FlashCardResponse[];
  total_due: number;
}

export interface ReviewRequest {
  quality: number;
}

export interface ReviewResponse {
  word_id: string;
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
}