import { httpClient } from '@/shared/lib/httpClient';
import type {
  VideoResponse,
  TranscriptResponse,
  TranscriptLanguageResponse,
  LevelAnalysisResponse,
  ImportVideoRequest,
} from '@/shared/types/api';

/**
 * Video service — all video and transcript API calls.
 * Contains zero UI logic or state.
 */
export const videoService = {
  list: async (params?: {
    language?: string;
    level?: string;
    curated?: boolean;
  }): Promise<VideoResponse[]> => {
    const res = await httpClient.get<VideoResponse[]>('/api/v1/videos', { params });
    return res.data;
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

  import: async (data: ImportVideoRequest): Promise<VideoResponse> => {
    const res = await httpClient.post<VideoResponse>('/api/v1/videos/import', data);
    return res.data;
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
    });
    return res.data;
  },
};