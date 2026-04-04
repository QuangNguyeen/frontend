import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dictationService } from '../services/dictationService';
import { historyKeys } from '@/features/history/hooks/useHistory';
import { dashboardKeys } from '@/features/dashboard/hooks/useDashboard';
import type {
  DictationSessionResponse,
  SubmitAnswerRequest,
  SentenceResultResponse,
} from '@/shared/types/api';

/**
 * Manages dictation session lifecycle for a given video.
 * Creates or resumes the session once on mount.
 * Returns the session ID and full session data (for resume support).
 */
const pendingSessionVideoIds = new Set<string>();

export function useDictationSession(videoId: string | undefined) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<DictationSessionResponse | null>(null);

  useEffect(() => {
    if (!videoId || sessionId || pendingSessionVideoIds.has(videoId)) return;
    pendingSessionVideoIds.add(videoId);
    dictationService
      .createSession(videoId)
      .then((s) => {
        setSessionId(s.id);
        setSessionData(s);
      })
      .catch(console.error)
      .finally(() => pendingSessionVideoIds.delete(videoId));
  }, [videoId, sessionId]);

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
    },
  });
}