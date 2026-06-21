import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dictationService } from '../services/dictationService';
import { historyKeys } from '@/features/history/hooks/useHistory';
import { dashboardKeys } from '@/features/dashboard/hooks/useDashboard';
import { videoKeys } from '@/features/library/hooks/useVideos';
import type {
  ClozeChunksResponse,
  ClozeResultResponse,
  ClozeSubmitRequest,
  ClozeFullResponse,
  ClozeSubmitAllRequest,
  ClozeSubmitAllResponse,
  DictationSessionResponse,
  PracticeMode,
  SubmitAnswerRequest,
  SentenceResultResponse,
} from '@/shared/types/api';

/**
 * Manages dictation session lifecycle for a given video.
 * The session is created lazily once both `videoId` and `practiceMode` are
 * known — this lets the setup screen render first and gate creation on the
 * user's mode pick.
 */
const pendingSessionKeys = new Set<string>();

export function useDictationSession(
  videoId: string | undefined,
  practiceMode: PracticeMode | null,
) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<DictationSessionResponse | null>(null);

  useEffect(() => {
    if (!videoId || !practiceMode || sessionId) return;
    const key = `${videoId}:${practiceMode}`;
    if (pendingSessionKeys.has(key)) return;
    pendingSessionKeys.add(key);
    dictationService
      .createSession(videoId, practiceMode)
      .then((s) => {
        setSessionId(s.id);
        setSessionData(s);
        queryClient.invalidateQueries({ queryKey: videoKeys.recommendations() });
      })
      .catch(console.error)
      .finally(() => pendingSessionKeys.delete(key));
  }, [videoId, practiceMode, sessionId, queryClient]);

  return { sessionId, sessionData };
}

/**
 * Returns a mutation for submitting a dictation answer.
 * Invalidates history cache on success so the History page shows fresh progress.
 */
export function useSubmitAnswer(sessionId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<SentenceResultResponse | null, Error, SubmitAnswerRequest>({
    mutationFn: (data: SubmitAnswerRequest) => {
      if (!sessionId) return Promise.resolve(null);
      return dictationService.submitAnswer(sessionId, data);
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.full });
      queryClient.invalidateQueries({ queryKey: videoKeys.recommendations() });
    },
  });
}

/**
 * Explicit session completion — called after the last sentence is submitted.
 * Safety net: even if the backend auto-completes on submit, this ensures it.
 */
export function useCompleteSession(sessionId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<{ status: string; score: number } | null, Error, void>({
    mutationFn: () => {
      if (!sessionId) return Promise.resolve(null);
      return dictationService.completeSession(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.full });
      queryClient.invalidateQueries({ queryKey: videoKeys.recommendations() });
    },
  });
}

/** Fetches the cloze paragraph chunks for a session (cloze-mode only). */
export function useClozeChunks(sessionId: string | null) {
  return useQuery<ClozeChunksResponse>({
    queryKey: ['dictation', 'cloze', sessionId],
    queryFn: () => dictationService.getClozeChunks(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity,        // chunks are deterministic per (video × mode)
  });
}

/** Mutation for submitting one cloze chunk's blanks. */
export function useSubmitCloze(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<ClozeResultResponse | null, Error, ClozeSubmitRequest>({
    mutationFn: (body) => {
      if (!sessionId) return Promise.resolve(null);
      return dictationService.submitCloze(sessionId, body);
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.full });
      queryClient.invalidateQueries({ queryKey: videoKeys.recommendations() });
    },
  });
}

/** Fetches the full-transcript cloze data for a session + difficulty. */
export function useClozeFullData(sessionId: string | null, difficulty: string) {
  return useQuery<ClozeFullResponse>({
    queryKey: ['dictation', 'cloze-full', sessionId, difficulty],
    queryFn: () => dictationService.getClozeFullData(sessionId!, difficulty),
    enabled: !!sessionId,
    staleTime: Infinity,
  });
}

/** Mutation for submitting all cloze blanks at once. */
export function useSubmitClozeAll(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<ClozeSubmitAllResponse | null, Error, ClozeSubmitAllRequest>({
    mutationFn: (body) => {
      if (!sessionId) return Promise.resolve(null);
      return dictationService.submitClozeAll(sessionId, body);
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.full });
      queryClient.invalidateQueries({ queryKey: videoKeys.recommendations() });
    },
  });
}
