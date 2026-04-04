import { httpClient } from '@/shared/lib/httpClient';
import type { DashboardFullResponse, HistoryEntryResponse } from '@/shared/types/api';

export const dashboardService = {
  getFull: async (): Promise<DashboardFullResponse> => {
    const res = await httpClient.get<DashboardFullResponse>('/api/v1/dashboard/full');
    return res.data;
  },

  getHistory: async (params?: {
    limit?: number;
    offset?: number;
  }): Promise<HistoryEntryResponse[]> => {
    const res = await httpClient.get<HistoryEntryResponse[]>('/api/v1/dashboard/history', {
      params,
    });
    return res.data;
  },
};