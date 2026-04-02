import { httpClient } from '@/shared/lib/httpClient';
import type {
  DictationSessionResponse,
  SubmitAnswerRequest,
  SentenceResultResponse,
} from '@/shared/types/api';

/**
 * Dictation service — session creation and answer submission.
 * Contains zero UI logic or state.
 */
export const dictationService = {
  createSession: async (videoId: string): Promise<DictationSessionResponse> => {
    const res = await httpClient.post<DictationSessionResponse>(
      '/api/v1/dictation/sessions',
      null,
      { params: { video_id: videoId } },
    );
    return res.data;
  },

  submitAnswer: async (
    sessionId: string,
    data: SubmitAnswerRequest,
  ): Promise<SentenceResultResponse> => {
    const res = await httpClient.post<SentenceResultResponse>(
      `/api/v1/dictation/sessions/${sessionId}/submit`,
      data,
    );
    return res.data;
  },
};