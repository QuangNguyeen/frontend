import { httpClient } from '@/shared/lib/httpClient';
import type {
  SaveWordRequest,
  SavedWordResponse,
  DueCardsResponse,
  ReviewRequest,
  ReviewResponse,
  WordPreviewResponse,
} from '@/shared/types/api';

/**
 * Vocabulary service — saved words and spaced-repetition review API calls.
 * Contains zero UI logic or state.
 */
export const vocabularyService = {
  list: async (params?: {
    video_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<SavedWordResponse[]> => {
    const res = await httpClient.get<SavedWordResponse[]>('/api/v1/vocabulary', { params });
    return res.data;
  },

  saveWord: async (data: SaveWordRequest): Promise<SavedWordResponse> => {
    const res = await httpClient.post<SavedWordResponse>('/api/v1/vocabulary/save', data);
    return res.data;
  },

  getDueCards: async (): Promise<DueCardsResponse> => {
    const res = await httpClient.get<DueCardsResponse>('/api/v1/vocabulary/due');
    return res.data;
  },

  reviewWord: async (wordId: string, data: ReviewRequest): Promise<ReviewResponse> => {
    const res = await httpClient.post<ReviewResponse>(
      `/api/v1/vocabulary/${wordId}/review`,
      data,
    );
    return res.data;
  },

  updateWord: async (
    wordId: string,
    data: { meaning?: string; note?: string },
  ): Promise<SavedWordResponse> => {
    const res = await httpClient.patch<SavedWordResponse>(
      `/api/v1/vocabulary/${wordId}`,
      data,
    );
    return res.data;
  },

  deleteWord: async (wordId: string): Promise<void> => {
    await httpClient.delete(`/api/v1/vocabulary/${wordId}`);
  },

  previewWord: async (word: string, context?: string): Promise<WordPreviewResponse> => {
    const res = await httpClient.get<WordPreviewResponse>('/api/v1/vocabulary/preview', {
      params: { word, context },
      timeout: 30_000,
    });
    return res.data;
  },
};