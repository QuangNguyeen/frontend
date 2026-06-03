import { httpClient } from '@/shared/lib/httpClient';
import type {
  AdminContentHealthResponse,
  AdminDifficultyRecalculationResponse,
  AdminEngagementResponse,
  AdminPatchUserRequest,
  AdminPatchVideoRequest,
  AdminRecentActivityResponse,
  AdminRetryTranscriptionResponse,
  AdminStatsResponse,
  AdminStudyHoursResponse,
  AdminTimeRange,
  AdminTopLearnersResponse,
  AdminTrafficResponse,
  AdminUserDetailResponse,
  AdminUserListResponse,
  AdminVideoListResponse,
  AdminVideoResponse,
} from '@/shared/types/api';

export interface AdminListParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export interface AdminVideoListParams extends AdminListParams {
  status?: string;
  active?: boolean;
  level?: string;
  language?: string;
  curated?: boolean;
}

export interface AdminUserListParams extends AdminListParams {
  is_admin?: boolean;
  is_active?: boolean;
}

function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>;
}

export const adminService = {
  getStats: async (): Promise<AdminStatsResponse> => {
    const res = await httpClient.get<AdminStatsResponse>('/api/v1/admin/stats');
    return res.data;
  },

  listVideos: async (params: AdminVideoListParams = {}): Promise<AdminVideoListResponse> => {
    const res = await httpClient.get<AdminVideoListResponse>('/api/v1/admin/videos', {
      params: cleanParams(params),
    });
    return res.data;
  },

  patchVideo: async (
    videoId: string,
    data: AdminPatchVideoRequest,
  ): Promise<AdminVideoResponse> => {
    const res = await httpClient.patch<AdminVideoResponse>(`/api/v1/admin/videos/${videoId}`, data);
    return res.data;
  },

  deleteVideo: async (videoId: string): Promise<void> => {
    await httpClient.delete(`/api/v1/admin/videos/${videoId}`);
  },

  retryTranscription: async (videoId: string): Promise<AdminRetryTranscriptionResponse> => {
    const res = await httpClient.post<AdminRetryTranscriptionResponse>(
      `/api/v1/admin/videos/${videoId}/retry-transcription`,
    );
    return res.data;
  },

  recalculateDifficulty: async (videoId: string): Promise<AdminDifficultyRecalculationResponse> => {
    const res = await httpClient.post<AdminDifficultyRecalculationResponse>(
      `/api/v1/admin/videos/${videoId}/recalculate-difficulty`,
    );
    return res.data;
  },

  listUsers: async (params: AdminUserListParams = {}): Promise<AdminUserListResponse> => {
    const res = await httpClient.get<AdminUserListResponse>('/api/v1/admin/users', {
      params: cleanParams(params),
    });
    return res.data;
  },

  getUser: async (userId: string): Promise<AdminUserDetailResponse> => {
    const res = await httpClient.get<AdminUserDetailResponse>(`/api/v1/admin/users/${userId}`);
    return res.data;
  },

  patchUser: async (
    userId: string,
    data: AdminPatchUserRequest,
  ): Promise<AdminUserDetailResponse> => {
    const res = await httpClient.patch<AdminUserDetailResponse>(`/api/v1/admin/users/${userId}`, data);
    return res.data;
  },

  getTraffic: async (timeRange: AdminTimeRange): Promise<AdminTrafficResponse> => {
    const res = await httpClient.get<AdminTrafficResponse>('/api/v1/admin/analytics/traffic', {
      params: { time_range: timeRange },
    });
    return res.data;
  },

  getStudyHours: async (timeRange: AdminTimeRange): Promise<AdminStudyHoursResponse> => {
    const res = await httpClient.get<AdminStudyHoursResponse>('/api/v1/admin/analytics/study-hours', {
      params: { time_range: timeRange },
    });
    return res.data;
  },

  getTopLearners: async (timeRange: AdminTimeRange): Promise<AdminTopLearnersResponse> => {
    const res = await httpClient.get<AdminTopLearnersResponse>('/api/v1/admin/analytics/top-learners', {
      params: { time_range: timeRange },
    });
    return res.data;
  },

  getContentHealth: async (): Promise<AdminContentHealthResponse> => {
    const res = await httpClient.get<AdminContentHealthResponse>('/api/v1/admin/analytics/content-health');
    return res.data;
  },

  getEngagement: async (timeRange: AdminTimeRange): Promise<AdminEngagementResponse> => {
    const res = await httpClient.get<AdminEngagementResponse>('/api/v1/admin/analytics/engagement', {
      params: { time_range: timeRange },
    });
    return res.data;
  },

  getRecentActivity: async (limit?: number): Promise<AdminRecentActivityResponse> => {
    const res = await httpClient.get<AdminRecentActivityResponse>('/api/v1/admin/analytics/recent-activity', {
      params: { limit: limit ?? 20 },
    });
    return res.data;
  },
};
