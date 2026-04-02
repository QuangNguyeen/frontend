import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { dictationService } from '../services/dictationService';
import type { SubmitAnswerRequest, SentenceResultResponse } from '@/shared/types/api';

/**
 * Manages dictation session lifecycle for a given video.
 * Creates the session once on mount and returns the stable session ID.
 * Session creation errors are non-fatal (scoring still degrades gracefully).
 *
 * @example
 * const sessionId = useDictationSession(videoId);
 */
export function useDictationSession(videoId: string | undefined): string | null {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId || sessionId) return;
    dictationService
      .createSession(videoId)
      .then((s) => setSessionId(s.id))
      .catch(console.error);
  }, [videoId, sessionId]);

  return sessionId;
}

/**
 * Returns a mutation for submitting a dictation answer.
 * Call mutate() with SubmitAnswerRequest; pass onSuccess to the mutate() call
 * for per-invocation callbacks (e.g. updating local score state).
 *
 * @example
 * const submitMutation = useSubmitAnswer(sessionId);
 * submitMutation.mutate({ sentence_index, user_input, hints_used, replay_count }, {
 *   onSuccess: (result) => updateScore(result.score),
 * });
 */
export function useSubmitAnswer(sessionId: string | null) {
  return useMutation<SentenceResultResponse | null, Error, SubmitAnswerRequest>({
    mutationFn: (data: SubmitAnswerRequest) => {
      if (!sessionId) return Promise.resolve(null);
      return dictationService.submitAnswer(sessionId, data);
    },
  });
}