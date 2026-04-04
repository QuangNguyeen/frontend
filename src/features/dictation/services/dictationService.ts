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
    const data = res.data;
    // Backend returns session_id; normalize to id for frontend consistency
    if (!data.id && (data as Record<string, unknown>).session_id) {
      data.id = (data as Record<string, unknown>).session_id as string;
    }
    return data;
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

  completeSession: async (
    sessionId: string,
  ): Promise<{ status: string; score: number }> => {
    const res = await httpClient.post<{ status: string; score: number }>(
      `/api/v1/dictation/sessions/${sessionId}/complete`,
    );
    return res.data;
  },
};