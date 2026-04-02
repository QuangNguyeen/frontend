import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { videoService } from '../services/videoService';
import type { ImportVideoRequest } from '@/shared/types/api';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const videoKeys = {
  all: ['videos'] as const,
  list: (params?: object) => [...videoKeys.all, 'list', params] as const,
  detail: (id: string) => [...videoKeys.all, 'detail', id] as const,
  transcripts: (id: string) => [...videoKeys.all, 'transcripts', id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches the paginated/filtered video list.
 */
export function useVideos(params?: { language?: string; level?: string; curated?: boolean }) {
  return useQuery({
    queryKey: videoKeys.list(params),
    queryFn: () => videoService.list(params),
  });
}

/**
 * Fetches a single video by ID.
 */
export function useVideo(videoId: string | undefined) {
  return useQuery({
    queryKey: videoKeys.detail(videoId ?? ''),
    queryFn: () => videoService.get(videoId!),
    enabled: !!videoId,
  });
}

/**
 * Fetches all transcript segments for a video.
 */
export function useVideoTranscripts(videoId: string | undefined) {
  return useQuery({
    queryKey: videoKeys.transcripts(videoId ?? ''),
    queryFn: () => videoService.getTranscripts(videoId!),
    enabled: !!videoId,
  });
}

/**
 * Mutation that imports a YouTube video and refreshes the video list on success.
 */
export function useImportVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportVideoRequest) => videoService.import(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.all });
    },
  });
}

/**
 * Mutation that deletes a video and refreshes the video list on success.
 */
export function useDeleteVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => videoService.delete(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.all });
    },
  });
}