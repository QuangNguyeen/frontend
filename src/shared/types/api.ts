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
  play_count: number;
  best_score: number | null;
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

export interface DictationSessionSentenceResult {
  sentence_index: number;
  score: number;
  word_diff: WordDiffItem[];
}

export interface DictationSessionResponse {
  id: string;
  video_id?: string;
  user_id?: string;
  started_at?: string;
  total_sentences?: number;
  current_sentence_index?: number;
  resumed?: boolean;
  sentence_results?: DictationSessionSentenceResult[];
}

export interface SubmitAnswerRequest {
  sentence_index: number;
  user_input: string;
  hints_used?: number;
  replay_count?: number;
}

export interface WordDiffItem {
  word: string;
  status: 'correct' | 'wrong' | 'missing' | 'extra';
  expected: string | null;
}

export interface SentenceResultResponse {
  sentence_index: number;
  score: number;
  word_diffs: WordDiffItem[];
  correct_count: number;
  wrong_count: number;
  missing_count: number;
  // Vocabulary saving context
  original_text: string;
  video_id: string;
  audio_start_time: number;
  word_difficulty: Record<string, number>; // word → 0.0 (easy) to 1.0 (hard)
}

// ─��─ History / Attempts ────────────────────────���─────────────────────────────

export interface HistoryAttemptResponse {
  attempt_id: string;
  video_id: string;
  status: string;
  score: number | null;
  progress_str: string; // e.g. "5/10"
  video_title: string;
  video_thumbnail: string;
  error_summary: Record<string, unknown> | null;
  updated_at: string;
  completed_at: string | null;
}

export interface HistoryPaginatedResponse {
  items: HistoryAttemptResponse[];
  total: number;
  page: number;
  total_pages: number;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStatsResponse {
  total_sessions: number;
  total_sentences: number;
  total_time_minutes: number;
  average_accuracy: number;
  total_videos: number;
  current_streak: number;
  longest_streak: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
  level: number;
}

export interface AccuracyPoint {
  date: string;
  score: number;
  accuracy: number;
}

export interface DashboardFullResponse {
  stats: DashboardStatsResponse;
  heatmap: HeatmapDay[];
  accuracy_trend: AccuracyPoint[];
}

export interface HistoryEntryResponse {
  id: string;
  video_title: string;
  video_thumbnail: string;
  type: string;
  status: string;
  score: number | null;
  progress_str: string;
  completed_at: string | null;
  updated_at: string;
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