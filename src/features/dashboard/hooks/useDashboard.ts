import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';

export const dashboardKeys = {
  full: ['dashboard', 'full'] as const,
  history: (params?: object) => ['dashboard', 'history', params] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.full,
    queryFn: dashboardService.getFull,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useDashboardHistory(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: dashboardKeys.history(params),
    queryFn: () => dashboardService.getHistory(params),
  });
}