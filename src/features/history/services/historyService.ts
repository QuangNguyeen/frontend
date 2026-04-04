import { httpClient } from '@/shared/lib/httpClient';
import type { HistoryPaginatedResponse } from '@/shared/types/api';

/**
 * History service — completed and in-progress dictation attempts.
 * Contains zero UI logic or state.
 */
export const historyService = {
  getCompleted: async (page: number = 1): Promise<HistoryPaginatedResponse> => {
    const res = await httpClient.get<HistoryPaginatedResponse>(
      '/api/v1/dictation/attempts/completed',
      { params: { page } },
    );
    return res.data;
  },

  getInProgress: async (page: number = 1): Promise<HistoryPaginatedResponse> => {
    const res = await httpClient.get<HistoryPaginatedResponse>(
      '/api/v1/dictation/attempts/in-progress',
      { params: { page } },
    );
    return res.data;
  },
};