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

export interface UpdateProfileRequest {
  display_name: string;
  preferred_language?: string | null;
}

// ─── User Profile (aggregated /api/v1/users/me) ──────────────────────────────

export interface UserPreferences {
  audio_speed: number;                       // 0.5 – 2.0
  theme: 'light' | 'dark' | 'system';
}

export interface UserStatsBlock {
  total_attempts: number;
  average_score: number;                     // 0–100, 1 dp
  total_vocabulary: number;
  current_streak: number;
  longest_streak: number;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  display_name: string;
  preferred_language: string;
  preferences: UserPreferences;
  created_at: string;
  stats: UserStatsBlock;
}

export interface UserUpdateRequest {
  display_name?: string;
  preferences?: Partial<UserPreferences>;
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
  is_auto_generated: boolean;
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

export interface TranscriptUpdateItem {
  transcript_id: string;
  text: string;
  is_deleted?: boolean;
}

export interface TranscriptBulkUpdateRequest {
  items: TranscriptUpdateItem[];
}

export interface TranscriptBulkUpdateResponse {
  updated: number;
}

export interface VideoEditStatusResponse {
  has_in_progress_attempt: boolean;
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

export type PracticeMode = 'sentence' | 'cloze';

export interface DictationSessionResponse {
  id: string;
  video_id?: string;
  user_id?: string;
  started_at?: string;
  total_sentences?: number;
  current_sentence_index?: number;
  resumed?: boolean;
  sentence_results?: DictationSessionSentenceResult[];
  practice_mode?: PracticeMode;
}

// ─── Cloze (paragraph fill-in-the-blanks) ────────────────────────────────────

export interface ClozeToken {
  text: string;                 // for non-blanks: includes trailing whitespace
  is_blank: boolean;
  blank_index?: number | null;
}

export interface ClozeChunk {
  chunk_index: number;
  start_time: number;
  end_time: number;
  tokens: ClozeToken[];
  blank_count: number;
}

export interface ClozeChunksResponse {
  practice_mode: 'cloze';
  chunks: ClozeChunk[];
}

export interface ClozeSubmitRequest {
  chunk_index: number;
  answers: string[];
}

export interface ClozeBlankResult {
  blank_index: number;
  given: string;
  expected: string;
  status: 'correct' | 'wrong';
}

export interface ClozeResultResponse {
  chunk_index: number;
  score: number;
  correct_count: number;
  total_count: number;
  results: ClozeBlankResult[];
  audio_start_time: number;
  audio_end_time: number;
}

// ─── Full-transcript cloze ──────────────────────────────────────────────────

export type ClozeDifficulty = 'easy' | 'medium' | 'hard';

export interface ClozeSegment {
  segment_index: number;
  start_time: number;
  end_time: number;
  tokens: ClozeToken[];
  blank_count: number;
}

export interface ClozeFullResponse {
  practice_mode: 'cloze';
  difficulty: string;
  total_blanks: number;
  segments: ClozeSegment[];
}

export interface ClozeSubmitAllRequest {
  difficulty: string;
  answers: string[];
}

export interface SegmentScore {
  segment_index: number;
  start_time: number;
  end_time: number;
  score: number;
  blank_results: ClozeBlankResult[];
}

export interface ClozeSubmitAllResponse {
  score: number;
  correct_count: number;
  total_count: number;
  results: ClozeBlankResult[];
  segment_scores: SegmentScore[];
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
  audio_url?: string;
  phonetic?: string;
  context_translation?: string;
  part_of_speech?: string;
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
  phonetic: string | null;
  audio_url: string | null;
  context_translation: string | null;
  part_of_speech: string | null;
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
  phonetic: string | null;
  audio_url: string | null;
  context_translation: string | null;
  part_of_speech: string | null;
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

export interface WordPreviewResponse {
  word: string;
  phonetic: string | null;
  meaning: string | null;
  audio_url: string | null;
  context_translation: string | null;
  is_saved: boolean;
  part_of_speech: string | null;
}