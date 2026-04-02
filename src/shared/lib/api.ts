import axios from 'axios';
import type {
  TokenResponse,
  UserResponse,
  RegisterRequest,
  VideoResponse,
  TranscriptResponse,
  TranscriptLanguageResponse,
  LevelAnalysisResponse,
  ImportVideoRequest,
  DictationSessionResponse,
  SubmitAnswerRequest,
  SentenceResultResponse,
  DashboardStatsResponse,
  HistoryEntryResponse,
  SaveWordRequest,
  SavedWordResponse,
  DueCardsResponse,
  ReviewRequest,
  ReviewResponse,
} from '../types/api';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    const res = await api.post<TokenResponse>('/api/v1/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },

  register: async (data: RegisterRequest): Promise<UserResponse> => {
    const res = await api.post<UserResponse>('/api/v1/auth/register', data);
    return res.data;
  },

  getMe: async (): Promise<UserResponse> => {
    const res = await api.get<UserResponse>('/api/v1/auth/me');
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const res = await api.post<TokenResponse>('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    return res.data;
  },
};

// ─── Videos ───────────────────────────────────────────────────────────────────

export const videosApi = {
  list: async (params?: { language?: string; level?: string; curated?: boolean }): Promise<VideoResponse[]> => {
    const res = await api.get<VideoResponse[]>('/api/v1/videos', { params });
    return res.data;
  },

  get: async (videoId: string): Promise<VideoResponse> => {
    const res = await api.get<VideoResponse>(`/api/v1/videos/${videoId}`);
    return res.data;
  },

  getTranscripts: async (videoId: string): Promise<TranscriptResponse[]> => {
    const res = await api.get<TranscriptResponse[]>(`/api/v1/videos/${videoId}/transcripts`);
    return res.data;
  },

  getTranscriptLanguages: async (videoId: string): Promise<TranscriptLanguageResponse[]> => {
    const res = await api.get<TranscriptLanguageResponse[]>(`/api/v1/videos/transcript-languages/${videoId}`);
    return res.data;
  },

  import: async (data: ImportVideoRequest): Promise<VideoResponse> => {
    const res = await api.post<VideoResponse>('/api/v1/videos/import', data);
    return res.data;
  },

  analyzeLevel: async (videoId: string): Promise<LevelAnalysisResponse> => {
    const res = await api.post<LevelAnalysisResponse>(`/api/v1/videos/${videoId}/analyze-level`);
    return res.data;
  },

  delete: async (videoId: string): Promise<void> => {
    await api.delete(`/api/v1/videos/${videoId}`);
  },

  refresh: async (videoId: string, maxSegmentDuration?: number): Promise<VideoResponse> => {
    const res = await api.put<VideoResponse>(`/api/v1/videos/${videoId}/refresh`, null, {
      params: maxSegmentDuration ? { max_segment_duration: maxSegmentDuration } : undefined,
    });
    return res.data;
  },
};

// ─── Dictation ────────────────────────────────────────────────────────────────

export const dictationApi = {
  createSession: async (videoId: string): Promise<DictationSessionResponse> => {
    const res = await api.post<DictationSessionResponse>('/api/v1/dictation/sessions', null, {
      params: { video_id: videoId },
    });
    return res.data;
  },

  submitAnswer: async (sessionId: string, data: SubmitAnswerRequest): Promise<SentenceResultResponse> => {
    const res = await api.post<SentenceResultResponse>(
      `/api/v1/dictation/sessions/${sessionId}/submit`,
      data,
    );
    return res.data;
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: async (): Promise<DashboardStatsResponse> => {
    const res = await api.get<DashboardStatsResponse>('/api/v1/dashboard/stats');
    return res.data;
  },

  getHistory: async (params?: { limit?: number; offset?: number }): Promise<HistoryEntryResponse[]> => {
    const res = await api.get<HistoryEntryResponse[]>('/api/v1/dashboard/history', { params });
    return res.data;
  },
};

// ─── Vocabulary ───────────────────────────────────────────────────────────────

export const vocabularyApi = {
  saveWord: async (data: SaveWordRequest): Promise<SavedWordResponse> => {
    const res = await api.post<SavedWordResponse>('/api/v1/vocabulary/save', data);
    return res.data;
  },

  list: async (params?: { video_id?: string; limit?: number; offset?: number }): Promise<SavedWordResponse[]> => {
    const res = await api.get<SavedWordResponse[]>('/api/v1/vocabulary', { params });
    return res.data;
  },

  getDueCards: async (): Promise<DueCardsResponse> => {
    const res = await api.get<DueCardsResponse>('/api/v1/vocabulary/due');
    return res.data;
  },

  reviewWord: async (wordId: string, data: ReviewRequest): Promise<ReviewResponse> => {
    const res = await api.post<ReviewResponse>(`/api/v1/vocabulary/${wordId}/review`, data);
    return res.data;
  },

  deleteWord: async (wordId: string): Promise<void> => {
    await api.delete(`/api/v1/vocabulary/${wordId}`);
  },
};