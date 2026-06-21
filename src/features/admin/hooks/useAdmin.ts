import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminPatchUserRequest,
  AdminPatchVideoRequest,
  AdminTimeRange,
  TopicTagCreateRequest,
  TopicTagUpdateRequest,
  PublishRequestListParams,
  PublishReviewActionRequest,
  TranscriptFeedbackListParams,
  TranscriptFeedbackPatchRequest,
  VideoTopicTagsUpdateRequest,
} from '@/shared/types/api';
import {
  adminService,
  type AdminUserListParams,
  type AdminVideoListParams,
} from '../services/adminService';
import { topicTagKeys } from '@/features/library/hooks/useTopicTags';
import { videoKeys } from '@/features/library/hooks/useVideos';

const ADMIN_STATS_QUERY_OPTIONS = {
  staleTime: 15_000,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

const ADMIN_ANALYTICS_QUERY_OPTIONS = {
  staleTime: 60_000,
  refetchOnWindowFocus: true,
} as const;

const ADMIN_LIST_QUERY_OPTIONS = {
  staleTime: 20_000,
  refetchOnWindowFocus: false,
  placeholderData: <T>(previous: T | undefined) => previous,
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
  topicTags: () => [...adminKeys.all, 'topic-tags'] as const,
  publishRequests: (params: PublishRequestListParams) =>
    [...adminKeys.all, 'publish-requests', params] as const,
  transcriptFeedback: (params: TranscriptFeedbackListParams) =>
    [...adminKeys.all, 'transcript-feedback', params] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: adminService.getStats,
    ...ADMIN_STATS_QUERY_OPTIONS,
  });
}

export function useAdminVideos(params: AdminVideoListParams) {
  return useQuery({
    queryKey: adminKeys.videos(params),
    queryFn: () => adminService.listVideos(params),
    ...ADMIN_LIST_QUERY_OPTIONS,
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
    ...ADMIN_LIST_QUERY_OPTIONS,
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
    ...ADMIN_ANALYTICS_QUERY_OPTIONS,
  });
}

export function useAdminStudyHours(timeRange: AdminTimeRange) {
  return useQuery({
    queryKey: adminKeys.studyHours(timeRange),
    queryFn: () => adminService.getStudyHours(timeRange),
    retry: false,
    ...ADMIN_ANALYTICS_QUERY_OPTIONS,
  });
}

export function useAdminTopLearners(timeRange: AdminTimeRange) {
  return useQuery({
    queryKey: adminKeys.topLearners(timeRange),
    queryFn: () => adminService.getTopLearners(timeRange),
    retry: false,
    ...ADMIN_ANALYTICS_QUERY_OPTIONS,
  });
}

export function useAdminContentHealth() {
  return useQuery({
    queryKey: adminKeys.contentHealth(),
    queryFn: adminService.getContentHealth,
    retry: false,
    ...ADMIN_ANALYTICS_QUERY_OPTIONS,
  });
}

export function useAdminEngagement(timeRange: AdminTimeRange) {
  return useQuery({
    queryKey: adminKeys.engagement(timeRange),
    queryFn: () => adminService.getEngagement(timeRange),
    retry: false,
    ...ADMIN_ANALYTICS_QUERY_OPTIONS,
  });
}

export function useAdminRecentActivity() {
  return useQuery({
    queryKey: adminKeys.recentActivity(),
    queryFn: () => adminService.getRecentActivity(),
    retry: false,
    ...ADMIN_ANALYTICS_QUERY_OPTIONS,
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

// ─── Topic tag management ────────────────────────────────────────────────────

export function useAdminTopicTags(includeInactive = true) {
  return useQuery({
    queryKey: [...adminKeys.topicTags(), includeInactive],
    queryFn: () => adminService.listTopicTags(includeInactive),
    ...ADMIN_LIST_QUERY_OPTIONS,
  });
}

function invalidateTopicTags(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: adminKeys.topicTags() });
  queryClient.invalidateQueries({ queryKey: topicTagKeys.all });
}

export function useCreateTopicTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TopicTagCreateRequest) => adminService.createTopicTag(data),
    onSuccess: () => invalidateTopicTags(queryClient),
  });
}

export function useUpdateTopicTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: string; data: TopicTagUpdateRequest }) =>
      adminService.updateTopicTag(tagId, data),
    onSuccess: () => invalidateTopicTags(queryClient),
  });
}

export function useDeactivateTopicTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => adminService.deactivateTopicTag(tagId),
    onSuccess: () => invalidateTopicTags(queryClient),
  });
}

// ─── Publish review queue ────────────────────────────────────────────────────

export function useAdminPublishRequests(params: PublishRequestListParams, live = false) {
  return useQuery({
    queryKey: adminKeys.publishRequests(params),
    queryFn: () => adminService.listPublishRequests(params),
    ...ADMIN_LIST_QUERY_OPTIONS,
    refetchInterval: live ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

function invalidatePublishRequests(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'publish-requests'] });
  queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'videos'] });
  queryClient.invalidateQueries({ queryKey: videoKeys.all });
}

export function useApprovePublishRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data?: PublishReviewActionRequest }) =>
      adminService.approvePublishRequest(requestId, data),
    onSuccess: () => invalidatePublishRequests(queryClient),
  });
}

export function useRejectPublishRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data?: PublishReviewActionRequest }) =>
      adminService.rejectPublishRequest(requestId, data),
    onSuccess: () => invalidatePublishRequests(queryClient),
  });
}

export function useSetVideoTopicTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, data }: { videoId: string; data: VideoTopicTagsUpdateRequest }) =>
      adminService.setVideoTopicTags(videoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'videos'] });
      queryClient.invalidateQueries({ queryKey: videoKeys.all });
    },
  });
}

// ─── Transcript feedback queue ───────────────────────────────────────────────

export function useAdminTranscriptFeedback(params: TranscriptFeedbackListParams, live = false) {
  return useQuery({
    queryKey: adminKeys.transcriptFeedback(params),
    queryFn: () => adminService.listTranscriptFeedback(params),
    ...ADMIN_LIST_QUERY_OPTIONS,
    refetchInterval: live ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function usePatchTranscriptFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ feedbackId, data }: { feedbackId: string; data: TranscriptFeedbackPatchRequest }) =>
      adminService.patchTranscriptFeedback(feedbackId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'transcript-feedback'] });
    },
  });
}
