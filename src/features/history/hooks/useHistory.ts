import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { historyService } from '../services/historyService';

// ─── Query keys ───────────────────────────────────────────────────────────────

const ALL_KEY = ['history'] as const;

export const historyKeys = {
  all: ALL_KEY,
  completed: (page: number) => [...ALL_KEY, 'completed', page] as const,
  inProgress: (page: number) => [...ALL_KEY, 'in-progress', page] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches paginated completed dictation attempts.
 * staleTime: 0 ensures fresh data on every navigation (progress changes often).
 */
export function useCompletedAttempts(page: number = 1) {
  return useQuery({
    queryKey: historyKeys.completed(page),
    queryFn: () => historyService.getCompleted(page),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

/**
 * Fetches paginated in-progress dictation attempts.
 * staleTime: 0 ensures fresh data on every navigation (progress changes often).
 */
export function useInProgressAttempts(page: number = 1) {
  return useQuery({
    queryKey: historyKeys.inProgress(page),
    queryFn: () => historyService.getInProgress(page),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}