import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vocabularyService } from '../services/vocabularyService';
import type { SaveWordRequest, ReviewRequest, ImportJobStatus } from '@/shared/types/api';

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
 *
 * The backend returns the SavedWord row immediately after INSERT, so the first
 * response has null phonetic/audio_url/meaning/context_translation — enrichment
 * (Gemini + dictionaryapi.dev) runs in a background task and backfills those
 * fields a couple of seconds later. A delayed second invalidation picks up the
 * enriched row without the user needing to refresh.
 */
export function useSaveWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveWordRequest) => vocabularyService.saveWord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      }, 2500);
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
 * Mutation to update a word's meaning/note. Refreshes the vocabulary list on success.
 */
export function useUpdateWord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wordId, data }: { wordId: string; data: { meaning?: string; note?: string } }) =>
      vocabularyService.updateWord(wordId, data),
    onSuccess: () => {
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

/**
 * Mutation to import a vocabulary file (CSV/XLSX). Immediately invalidates the
 * word list so freshly-imported rows appear right away; background enrichment
 * (if requested) is tracked separately via {@link useImportJobStatus}.
 */
export function useImportVocabulary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, enrich }: { file: File; enrich: boolean }) =>
      vocabularyService.importWords(file, enrich),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
    },
  });
}

/**
 * Poll an import job's enrichment status while it is running. Stops polling once
 * the job reaches a terminal state ("completed" | "failed").
 */
export function useImportJobStatus(jobId: string | null, enabled: boolean) {
  return useQuery<ImportJobStatus>({
    queryKey: ['vocabulary', 'import', jobId],
    queryFn: () => vocabularyService.getImportStatus(jobId!),
    enabled: !!jobId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'processing' || status === 'pending' ? 2000 : false;
    },
    gcTime: 0,
  });
}