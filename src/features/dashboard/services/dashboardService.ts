import { httpClient } from '@/shared/lib/httpClient';
import type { DashboardStatsResponse, HistoryEntryResponse } from '@/shared/types/api';

/**
 * Dashboard service — stats and session history API calls.
 * Contains zero UI logic or state.
 */
export const dashboardService = {
  getStats: async (): Promise<DashboardStatsResponse> => {
    const res = await httpClient.get<DashboardStatsResponse>('/api/v1/dashboard/stats');
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