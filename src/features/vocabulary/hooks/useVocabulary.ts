import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vocabularyService } from '../services/vocabularyService';
import type { SaveWordRequest, ReviewRequest } from '@/shared/types/api';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const vocabularyKeys = {
  all: ['vocabulary'] as const,
  list: (params?: object) => [...vocabularyKeys.all, 'list', params] as const,
  due: ['vocabulary', 'due'] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches the user's saved word list, optionally filtered by video.
 */
export function useVocabulary(params?: { video_id?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: vocabularyKeys.list(params),
    queryFn: () => vocabularyService.list(params),
  });
}

/**
 * Fetches words due for spaced-repetition review.
 */
export function useDueCards() {
  return useQuery({
    queryKey: vocabularyKeys.due,
    queryFn: vocabularyService.getDueCards,
  });
}

/**
 * Mutation to save a new word. Refreshes the vocabulary list on success.
 */
export function useSaveWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveWordRequest) => vocabularyService.saveWord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
    },
  });
}

/**
 * Mutation to submit a review for a due card.
 * Refreshes both the due-cards queue and the word list on success.
 */
export function useReviewWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wordId, data }: { wordId: string; data: ReviewRequest }) =>
      vocabularyService.reviewWord(wordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vocabularyKeys.due });
      queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
    },
  });
}

/**
 * Mutation to delete a saved word. Refreshes the vocabulary list on success.
 */
export function useDeleteWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wordId: string) => vocabularyService.deleteWord(wordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
    },
  });
}