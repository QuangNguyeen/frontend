import { httpClient } from '@/shared/lib/httpClient';
import type {
  VideoResponse,
  TranscriptResponse,
  TranscriptLanguageResponse,
  LevelAnalysisResponse,
  ImportVideoRequest,
  ImportVideoResult,
  TranscriptBulkUpdateRequest,
  TranscriptBulkUpdateResponse,
  VideoEditStatusResponse,
  VideoCatalogParams,
  VideoListResponse,
  MyPracticeListParams,
  MyPracticeListResponse,
  PublishRequestCreateRequest,
  TranscriptFeedbackCreateRequest,
  VideoRecommendationsResponse,
} from '@/shared/types/api';

/** Drops undefined / empty-string / empty-array values so they aren't sent as query params. */
function cleanParams<T extends object>(params?: T): Partial<T> {
  if (!params) return {};
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => {
      if (v === undefined || v === '') return false;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    }),
  ) as Partial<T>;
}

/**
 * Serializes array query params by repeating the key without brackets
 * (e.g. `topic_tag=a&topic_tag=b`), which FastAPI reads as a list. Scalars
 * use the default serialization.
 */
const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

/**
 * Video service — all video and transcript API calls.
 * Contains zero UI logic or state.
 */
export const videoService = {
  /** Personalized public videos the current user has not practiced. */
  recommendations: async (limit = 6): Promise<VideoRecommendationsResponse> => {
    const res = await httpClient.get<VideoRecommendationsResponse>(
      '/api/v1/videos/recommendations',
      { params: { limit } },
    );
    return res.data;
  },

  /** Public catalog (published videos only). */
  list: async (params?: VideoCatalogParams): Promise<VideoResponse[]> => {
    const res = await httpClient.get('/api/v1/videos', {
      params: cleanParams(params),
      paramsSerializer: REPEAT_ARRAY_PARAMS,
    });
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  },

  /**
   * Public catalog with pagination metadata (items + total + total_pages).
   * Used by the Library's "Load more" flow so the real catalog size is known.
   */
  listPage: async (params?: VideoCatalogParams): Promise<VideoListResponse> => {
    const res = await httpClient.get('/api/v1/videos', {
      params: cleanParams(params),
      paramsSerializer: REPEAT_ARRAY_PARAMS,
    });
    const data = res.data;
    if (Array.isArray(data)) {
      return { items: data, total: data.length, page: 1, total_pages: 1 };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total ?? 0,
      page: data?.page ?? params?.page ?? 1,
      total_pages: data?.total_pages ?? 1,
    };
  },

  /** The current user's My Practice list (paginated). */
  listMyPractice: async (params?: MyPracticeListParams): Promise<MyPracticeListResponse> => {
    const res = await httpClient.get('/api/v1/videos/my-practice', {
      params: cleanParams(params),
      paramsSerializer: REPEAT_ARRAY_PARAMS,
    });
    const data = res.data;
    // Tolerate both bare arrays and paginated envelopes.
    if (Array.isArray(data)) {
      return { items: data, total: data.length, page: 1, total_pages: 1 };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total ?? 0,
      page: data?.page ?? params?.page ?? 1,
      total_pages: data?.total_pages ?? 1,
    };
  },

  /** Removes only the current user's My Practice entry (shared data is kept). */
  removeFromMyPractice: async (videoId: string): Promise<void> => {
    await httpClient.delete(`/api/v1/videos/my-practice/${videoId}`);
  },

  /** Ask an admin to publish a private/rejected video to the public catalog. */
  requestPublish: async (
    videoId: string,
    data: PublishRequestCreateRequest,
  ): Promise<void> => {
    await httpClient.post(`/api/v1/videos/${videoId}/publish-request`, data);
  },

  /** Submit transcript-correction feedback (video- or segment-level). */
  submitTranscriptFeedback: async (
    videoId: string,
    data: TranscriptFeedbackCreateRequest,
  ): Promise<void> => {
    await httpClient.post(`/api/v1/videos/${videoId}/transcript-feedback`, data);
  },

  get: async (videoId: string): Promise<VideoResponse> => {
    const res = await httpClient.get<VideoResponse>(`/api/v1/videos/${videoId}`);
    return res.data;
  },

  getTranscripts: async (videoId: string): Promise<TranscriptResponse[]> => {
    const res = await httpClient.get<TranscriptResponse[]>(`/api/v1/videos/${videoId}/transcripts`);
    return res.data;
  },

  getTranscriptLanguages: async (videoId: string): Promise<TranscriptLanguageResponse[]> => {
    const res = await httpClient.get<TranscriptLanguageResponse[]>(
      `/api/v1/videos/transcript-languages/${videoId}`,
    );
    return res.data;
  },

  /**
   * Imports a YouTube video into My Practice.
   * Returns the backend wrapper plus the HTTP status so callers can branch on
   * 201 (new), 200 (existing / already in practice), or 206 (partial transcript).
   * Accepts any 2xx so 206 isn't treated as an error by axios.
   */
  import: async (data: ImportVideoRequest): Promise<ImportVideoResult> => {
    const res = await httpClient.post('/api/v1/videos/import', data, {
      timeout: 120_000,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    const body = res.data ?? {};
    return {
      video: body.video,
      already_exists: Boolean(body.already_exists),
      already_in_my_practice: Boolean(body.already_in_my_practice),
      message: typeof body.message === 'string' ? body.message : '',
      similar_importers_count: body.similar_importers_count ?? 0,
      similar_importers: Array.isArray(body.similar_importers) ? body.similar_importers : [],
      http_status: res.status,
    };
  },

  analyzeLevel: async (videoId: string): Promise<LevelAnalysisResponse> => {
    const res = await httpClient.post<LevelAnalysisResponse>(
      `/api/v1/videos/${videoId}/analyze-level`,
    );
    return res.data;
  },

  delete: async (videoId: string): Promise<void> => {
    await httpClient.delete(`/api/v1/videos/${videoId}`);
  },

  refresh: async (videoId: string, maxSegmentDuration?: number): Promise<VideoResponse> => {
    const res = await httpClient.put<VideoResponse>(`/api/v1/videos/${videoId}/refresh`, null, {
      params: maxSegmentDuration ? { max_segment_duration: maxSegmentDuration } : undefined,
      timeout: 120_000,
    });
    return res.data;
  },

  updateTranscripts: async (
    videoId: string,
    payload: TranscriptBulkUpdateRequest,
  ): Promise<TranscriptBulkUpdateResponse> => {
    const res = await httpClient.put<TranscriptBulkUpdateResponse>(
      `/api/v1/videos/${videoId}/transcripts`,
      payload,
    );
    return res.data;
  },

  getTranscriptionStatus: async (videoId: string): Promise<{ status: string; error: string | null }> => {
    const res = await httpClient.get<{ status: string; error: string | null }>(
      `/api/v1/videos/${videoId}/transcription-status`,
    );
    return res.data;
  },

  getEditStatus: async (videoId: string): Promise<VideoEditStatusResponse> => {
    const res = await httpClient.get<VideoEditStatusResponse>(
      `/api/v1/videos/${videoId}/edit-status`,
    );
    return res.data;
  },
};
