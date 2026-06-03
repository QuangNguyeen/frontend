import { httpClient } from '@/shared/lib/httpClient';
import type {
  ClozeChunksResponse,
  ClozeResultResponse,
  ClozeSubmitRequest,
  ClozeFullResponse,
  ClozeSubmitAllRequest,
  ClozeSubmitAllResponse,
  DictationSessionResponse,
  PracticeMode,
  SentenceResultResponse,
  SubmitAnswerRequest,
} from '@/shared/types/api';

/**
 * Dictation service — session creation, sentence & cloze submission.
 * Contains zero UI logic or state.
 */
export const dictationService = {
  createSession: async (
    videoId: string,
    practiceMode: PracticeMode = 'sentence',
  ): Promise<DictationSessionResponse> => {
    const res = await httpClient.post<DictationSessionResponse>(
      '/api/v1/dictation/sessions',
      null,
      { params: { video_id: videoId, practice_mode: practiceMode } },
    );
    const data = res.data;
    // Backend returns session_id; normalize to id for frontend consistency
    const normalized = data as unknown as Record<string, unknown>;
    if (!data.id && normalized.session_id) {
      data.id = normalized.session_id as string;
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

  getClozeChunks: async (sessionId: string): Promise<ClozeChunksResponse> => {
    const res = await httpClient.get<ClozeChunksResponse>(
      `/api/v1/dictation/sessions/${sessionId}/cloze`,
    );
    return res.data;
  },

  submitCloze: async (
    sessionId: string,
    body: ClozeSubmitRequest,
  ): Promise<ClozeResultResponse> => {
    const res = await httpClient.post<ClozeResultResponse>(
      `/api/v1/dictation/sessions/${sessionId}/cloze-submit`,
      body,
    );
    return res.data;
  },

  getClozeFullData: async (
    sessionId: string,
    difficulty: string,
  ): Promise<ClozeFullResponse> => {
    const res = await httpClient.get<ClozeFullResponse>(
      `/api/v1/dictation/sessions/${sessionId}/cloze-full`,
      { params: { difficulty } },
    );
    return res.data;
  },

  submitClozeAll: async (
    sessionId: string,
    body: ClozeSubmitAllRequest,
  ): Promise<ClozeSubmitAllResponse> => {
    const res = await httpClient.post<ClozeSubmitAllResponse>(
      `/api/v1/dictation/sessions/${sessionId}/cloze-submit-all`,
      body,
    );
    return res.data;
  },
};
