// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  email: string;
  display_name: string;
  preferred_language: string;
  streak_days: number;
  is_admin: boolean;
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
  is_admin: boolean;
  preferred_language: string;
  preferences: UserPreferences;
  created_at: string;
  stats: UserStatsBlock;
}

export interface UserUpdateRequest {
  display_name?: string;
  preferences?: Partial<UserPreferences>;
}

// ─── Topic Tags ───────────────────────────────────────────────────────────────

/** Fixed, admin-managed catalog tag. Users may only select active ones. */
export interface TopicTag {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface TopicTagCreateRequest {
  slug: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface TopicTagUpdateRequest {
  slug?: string;
  name?: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export type PublishStatus = 'private' | 'pending_review' | 'published' | 'rejected';

export type TranscriptionStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface VideoResponse {
  id: string;
  youtube_id: string;
  title: string;
  channel: string;
  duration: number;
  language: string;
  level: string | null;
  difficulty_score?: number | null;
  difficulty_level?: string | null;
  difficulty_label?: string | null;
  is_curated: boolean;
  is_active: boolean;
  is_auto_generated: boolean;
  transcription_status: TranscriptionStatus;
  transcription_error: string | null;
  thumbnail_url: string;
  play_count: number;
  best_score: number | null;
  // Publish / review workflow
  publish_status?: PublishStatus;
  published_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  // Tags: public (admin-approved) vs personal (current user's My Practice selection)
  topic_tags?: TopicTag[];
  my_topic_tags?: TopicTag[];
  // Date the current user added this video to My Practice
  my_practice_created_at?: string | null;
}

export type RecommendationStrategy = 'personalized' | 'cold_start';

export type RecommendationReasonCode =
  | 'same_channel'
  | 'topic_match'
  | 'level_match'
  | 'level_progression'
  | 'preferred_language'
  | 'curated'
  | 'popular'
  | 'new_content';

export interface VideoRecommendationItem {
  video: VideoResponse;
  reason_code: RecommendationReasonCode;
  reason_text: string;
}

export interface VideoRecommendationsResponse {
  strategy: RecommendationStrategy;
  items: VideoRecommendationItem[];
}

/** A user who has also imported the same video. */
export interface SimilarImporter {
  id: string;
  display_name: string;
}

/** Response wrapper returned by POST /videos/import. */
export interface ImportVideoResponse {
  video: VideoResponse;
  already_exists: boolean;
  already_in_my_practice: boolean;
  message: string;
  similar_importers_count: number;
  similar_importers: SimilarImporter[];
}

/** Import result enriched with the HTTP status so the UI can branch on 201/200/206. */
export interface ImportVideoResult extends ImportVideoResponse {
  http_status: number;
}

// ─── My Practice ──────────────────────────────────────────────────────────────

export interface MyPracticeListParams {
  publish_status?: PublishStatus;
  language?: string;
  level?: string;
  transcription_status?: TranscriptionStatus;
  /** One or more personal topic-tag slugs to filter by. */
  topic_tag?: string | string[];
  page?: number;
  page_size?: number;
}

export interface MyPracticeListResponse {
  items: VideoResponse[];
  total: number;
  page: number;
  total_pages: number;
}

/** Paginated public catalog response (GET /videos). */
export interface VideoListResponse {
  items: VideoResponse[];
  total: number;
  page: number;
  total_pages: number;
}

export interface PublishRequestCreateRequest {
  /** Optional message, max 2000 chars. */
  message?: string;
}

export interface TranscriptFeedbackCreateRequest {
  /** Set for segment-level feedback. */
  transcript_id?: string;
  /** Required correction explanation, 1–5000 chars. */
  message: string;
  /** Optional corrected text, max 5000 chars. */
  suggested_text?: string;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export interface AdminStatsResponse {
  total_users: number;
  total_videos: number;
  total_sessions: number;
  total_vocabulary_words: number;
  pending_transcriptions: number;
  failed_transcriptions: number;
  new_users_today: number;
  sessions_today: number;
}

export interface AdminVideoResponse extends VideoResponse {
  difficulty_factors?: Record<string, unknown> | null;
  created_by: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface AdminVideoListResponse {
  items: AdminVideoResponse[];
  total: number;
  page: number;
  total_pages: number;
}

export interface AdminPatchVideoRequest {
  is_active?: boolean;
  is_curated?: boolean;
  level?: string | null;
}

export interface AdminRetryTranscriptionResponse {
  video_id: string;
  status: string;
  task_id: string | null;
}

export interface AdminDifficultyRecalculationResponse {
  video_id: string;
  difficulty_score: number;
  difficulty_level: string;
  difficulty_label: string;
  factors: Record<string, unknown>;
  explanation: string[];
  recommendedModes: Record<string, boolean>;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  display_name: string;
  preferred_language: string;
  streak_days: number;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  total_sessions: number;
  total_vocabulary: number;
}

export interface AdminUserDetailResponse extends AdminUserResponse {
  stats: UserStatsBlock;
}

export interface AdminUserListResponse {
  items: AdminUserResponse[];
  total: number;
  page: number;
  total_pages: number;
}

export interface AdminPatchUserRequest {
  is_admin?: boolean;
  is_active?: boolean;
  email?: string;
  password?: string;
}

// ─── Admin: Publish Review Queue ──────────────────────────────────────────────

export type PublishRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface PublishRequestResponse {
  id: string;
  video_id: string;
  status: PublishRequestStatus;
  message: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_by_email: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  video: VideoResponse | null;
}

export interface PublishRequestListParams {
  status?: PublishRequestStatus;
  page?: number;
  page_size?: number;
}

export interface PublishRequestListResponse {
  items: PublishRequestResponse[];
  total: number;
  page: number;
  total_pages: number;
}

/** Body for approve/reject. topic_tag_ids selects the public catalog tags on approval. */
export interface PublishReviewActionRequest {
  admin_note?: string;
  topic_tag_ids?: string[];
}

/** Body for PUT /admin/videos/{video_id}/topic-tags. */
export interface VideoTopicTagsUpdateRequest {
  topic_tag_ids: string[];
}

// ─── Admin: Transcript Feedback Queue ─────────────────────────────────────────

export type TranscriptFeedbackStatus = 'pending' | 'reviewed' | 'resolved' | 'rejected';

export interface AdminTranscriptFeedbackResponse {
  id: string;
  video_id: string;
  transcript_id: string | null;
  message: string;
  suggested_text: string | null;
  status: TranscriptFeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  video_title: string | null;
  transcript_text: string | null;
}

export interface TranscriptFeedbackListParams {
  status?: TranscriptFeedbackStatus;
  page?: number;
  page_size?: number;
}

export interface AdminTranscriptFeedbackListResponse {
  items: AdminTranscriptFeedbackResponse[];
  total: number;
  page: number;
  total_pages: number;
}

export interface TranscriptFeedbackPatchRequest {
  status?: TranscriptFeedbackStatus;
  admin_note?: string;
}

// ─── Admin Analytics ────────────────────────────────────────────────────────

export type AdminTimeRange = '1d' | '7d' | '30d' | '90d';

export interface AdminTrafficPoint {
  date: string;
  active_users: number;
  new_users: number;
}

export interface AdminTrafficResponse {
  points: AdminTrafficPoint[];
  time_range: AdminTimeRange;
}

export interface AdminStudyHoursPoint {
  date: string;
  total_minutes: number;
  avg_minutes_per_user: number;
}

export interface AdminStudyHoursResponse {
  points: AdminStudyHoursPoint[];
  time_range: AdminTimeRange;
}

export interface AdminTopLearner {
  user_id: string;
  display_name: string;
  email: string;
  study_minutes: number;
  sessions: number;
  avg_accuracy: number;
  streak: number;
}

export interface AdminTopLearnersResponse {
  learners: AdminTopLearner[];
  time_range: AdminTimeRange;
}

export interface AdminContentHealthResponse {
  total_videos: number;
  ready: number;
  pending: number;
  processing: number;
  failed: number;
  curated: number;
  levels: Record<string, number>;
}

export interface AdminEngagementResponse {
  completion_rate: number;
  avg_session_duration: number;
  repeat_rate: number;
  vocab_save_rate: number;
}

export interface AdminRecentActivity {
  id: string;
  type: 'user_signup' | 'user_login' | 'session_completed' | 'video_added' | 'transcription_failed';
  description: string;
  user_name: string | null;
  timestamp: string;
}

export interface AdminRecentActivityResponse {
  activities: AdminRecentActivity[];
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
  start_time?: number;
  end_time?: number;
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
  title?: string | null;
  channel?: string | null;
  language?: string;
  level?: string | null;
  languages?: string[];
  max_segment_duration?: number;
  /** IDs of active topic tags to attach as personal My Practice tags. */
  topic_tag_ids?: string[];
}

/** Public catalog filters — GET /videos (published videos only). */
export interface VideoCatalogParams {
  language?: string;
  level?: string;
  curated?: boolean;
  /** One or more public topic-tag slugs to filter by. */
  topic_tag?: string | string[];
  page?: number;
  page_size?: number;
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
  skipped?: boolean;
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
  is_skipped?: boolean;
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

// ─── Vocabulary import ───────────────────────────────────────────────────────

export interface ImportResult {
  job_id: string | null;
  imported: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
  total_words: number;
  enrich_queued: boolean;
}

export interface ImportJobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total: number;
  enriched: number;
  phase: 'meanings' | 'audio' | 'translations' | 'done';
  progress_pct: number;
  error: string | null;
}

export type ImportColumnMapping = {
  word: string;
  meaning?: string;
  phonetic?: string;
  note?: string;
  context_sentence?: string;
};
