import { httpClient } from '@/shared/lib/httpClient';
import type {
  SaveWordRequest,
  SavedWordResponse,
  DueCardsResponse,
  ReviewRequest,
  ReviewResponse,
  WordPreviewResponse,
  ImportResult,
  ImportJobStatus,
} from '@/shared/types/api';

/** Trigger a browser download from a Blob response. */
function downloadBlob(data: Blob, filename: string) {
  const url = window.URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

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

  importWords: async (file: File, enrich: boolean): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('enrich', String(enrich));
    const res = await httpClient.post<ImportResult>('/api/v1/vocabulary/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return res.data;
  },

  getImportStatus: async (jobId: string): Promise<ImportJobStatus> => {
    const res = await httpClient.get<ImportJobStatus>(
      `/api/v1/vocabulary/import/${jobId}/status`,
    );
    return res.data;
  },

  exportWords: async (): Promise<void> => {
    const res = await httpClient.get('/api/v1/vocabulary/export', { responseType: 'blob' });
    downloadBlob(res.data as Blob, 'vocabulary.csv');
  },

  downloadTemplate: async (): Promise<void> => {
    const res = await httpClient.get('/api/v1/vocabulary/import/template', {
      responseType: 'blob',
    });
    downloadBlob(res.data as Blob, 'vocabulary_template.csv');
  },
};