import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { videoService } from '@/features/library/services/videoService';
import { videoKeys } from '@/features/library/hooks/useVideos';
import type {
  MyPracticeListParams,
  PublishRequestCreateRequest,
  TranscriptFeedbackCreateRequest,
} from '@/shared/types/api';

export const myPracticeKeys = {
  all: ['my-practice'] as const,
  list: (params?: MyPracticeListParams) => [...myPracticeKeys.all, 'list', params] as const,
};

/** Paginated, filtered My Practice list. */
export function useMyPractice(params?: MyPracticeListParams) {
  return useQuery({
    queryKey: myPracticeKeys.list(params),
    queryFn: () => videoService.listMyPractice(params),
    placeholderData: (prev) => prev,
  });
}

/** Removes only the current user's My Practice entry (shared data is kept). */
export function useRemoveFromMyPractice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => videoService.removeFromMyPractice(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myPracticeKeys.all });
      queryClient.invalidateQueries({ queryKey: videoKeys.all });
    },
  });
}

/** Submits an admin publish request for a private/rejected video. */
export function useRequestPublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ videoId, data }: { videoId: string; data: PublishRequestCreateRequest }) =>
      videoService.requestPublish(videoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myPracticeKeys.all });
    },
  });
}

/** Submits transcript-correction feedback (video- or segment-level). */
export function useSubmitTranscriptFeedback() {
  return useMutation({
    mutationFn: ({ videoId, data }: { videoId: string; data: TranscriptFeedbackCreateRequest }) =>
      videoService.submitTranscriptFeedback(videoId, data),
  });
}
