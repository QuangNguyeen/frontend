import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const dashboardKeys = {
  stats: ['dashboard', 'stats'] as const,
  history: (params?: object) => ['dashboard', 'history', params] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches the current user's overall stats (streak, accuracy, time, videos).
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats,
    queryFn: dashboardService.getStats,
  });
}

/**
 * Fetches paginated session history.
 *
 * @example
 * const { data: history } = useDashboardHistory({ limit: 5 });
 */
export function useDashboardHistory(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: dashboardKeys.history(params),
    queryFn: () => dashboardService.getHistory(params),
  });
}