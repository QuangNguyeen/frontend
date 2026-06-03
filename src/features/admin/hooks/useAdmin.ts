import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminPatchUserRequest, AdminPatchVideoRequest, AdminTimeRange } from '@/shared/types/api';
import {
  adminService,
  type AdminUserListParams,
  type AdminVideoListParams,
} from '../services/adminService';

/** Admin dashboards should feel live while the page is open. */
const ADMIN_LIVE_QUERY_OPTIONS = {
  staleTime: 0,
  refetchInterval: 5_000,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: true,
} as const;

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  traffic: (range: AdminTimeRange) => [...adminKeys.all, 'traffic', range] as const,
  studyHours: (range: AdminTimeRange) => [...adminKeys.all, 'study-hours', range] as const,
  topLearners: (range: AdminTimeRange) => [...adminKeys.all, 'top-learners', range] as const,
  contentHealth: () => [...adminKeys.all, 'content-health'] as const,
  engagement: (range: AdminTimeRange) => [...adminKeys.all, 'engagement', range] as const,
  recentActivity: () => [...adminKeys.all, 'recent-activity'] as const,
  videos: (params: AdminVideoListParams) => [...adminKeys.all, 'videos', params] as const,
  users: (params: AdminUserListParams) => [...adminKeys.all, 'users', params] as const,
  user: (userId: string) => [...adminKeys.all, 'user', userId] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: adminService.getStats,
    ...ADMIN_LIVE_QUERY_OPTIONS,
  });
}

export function useAdminVideos(params: AdminVideoListParams) {
  return useQuery({
    queryKey: adminKeys.videos(params),
    queryFn: () => adminService.listVideos(params),
  });
}

export function usePatchAdminVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, data }: { videoId: string; data: AdminPatchVideoRequest }) =>
      adminService.patchVideo(videoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'videos'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useDeleteAdminVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminService.deleteVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'videos'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useRetryAdminTranscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminService.retryTranscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'videos'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useRecalculateAdminDifficulty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminService.recalculateDifficulty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'videos'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      queryClient.invalidateQueries({ queryKey: adminKeys.contentHealth() });
    },
  });
}

export function useAdminUsers(params: AdminUserListParams) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => adminService.listUsers(params),
  });
}

export function useAdminUser(userId: string | null) {
  return useQuery({
    queryKey: userId ? adminKeys.user(userId) : [...adminKeys.all, 'user', 'none'],
    queryFn: () => adminService.getUser(userId as string),
    enabled: Boolean(userId),
  });
}

export function useAdminTraffic(timeRange: AdminTimeRange) {
  return useQuery({
    queryKey: adminKeys.traffic(timeRange),
    queryFn: () => adminService.getTraffic(timeRange),
    retry: false,
    ...ADMIN_LIVE_QUERY_OPTIONS,
  });
}

export function useAdminStudyHours(timeRange: AdminTimeRange) {
  return useQuery({
    queryKey: adminKeys.studyHours(timeRange),
    queryFn: () => adminService.getStudyHours(timeRange),
    retry: false,
    ...ADMIN_LIVE_QUERY_OPTIONS,
  });
}

export function useAdminTopLearners(timeRange: AdminTimeRange) {
  return useQuery({
    queryKey: adminKeys.topLearners(timeRange),
    queryFn: () => adminService.getTopLearners(timeRange),
    retry: false,
    ...ADMIN_LIVE_QUERY_OPTIONS,
  });
}

export function useAdminContentHealth() {
  return useQuery({
    queryKey: adminKeys.contentHealth(),
    queryFn: adminService.getContentHealth,
    retry: false,
    ...ADMIN_LIVE_QUERY_OPTIONS,
  });
}

export function useAdminEngagement(timeRange: AdminTimeRange) {
  return useQuery({
    queryKey: adminKeys.engagement(timeRange),
    queryFn: () => adminService.getEngagement(timeRange),
    retry: false,
    ...ADMIN_LIVE_QUERY_OPTIONS,
  });
}

export function useAdminRecentActivity() {
  return useQuery({
    queryKey: adminKeys.recentActivity(),
    queryFn: () => adminService.getRecentActivity(),
    retry: false,
    ...ADMIN_LIVE_QUERY_OPTIONS,
  });
}

export function usePatchAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AdminPatchUserRequest }) =>
      adminService.patchUser(userId, data),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'users'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.user(user.id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}
