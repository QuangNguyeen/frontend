import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { videoService } from '../services/videoService';
import type { ImportVideoRequest, TranscriptBulkUpdateRequest } from '@/shared/types/api';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const videoKeys = {
  all: ['videos'] as const,
  list: (params?: object) => [...videoKeys.all, 'list', params] as const,
  detail: (id: string) => [...videoKeys.all, 'detail', id] as const,
  transcripts: (id: string) => [...videoKeys.all, 'transcripts', id] as const,
  editStatus: (id: string) => [...videoKeys.all, 'edit-status', id] as const,
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
 * When transcription_status is not "ready", polls every 5s and auto-refetches
 * transcripts once the Celery STT pipeline completes.
 */
export function useVideoTranscripts(videoId: string | undefined) {
  const queryClient = useQueryClient();

  const transcriptsQuery = useQuery({
    queryKey: videoKeys.transcripts(videoId ?? ''),
    queryFn: () => videoService.getTranscripts(videoId!),
    enabled: !!videoId,
  });

  const statusQuery = useQuery({
    queryKey: [...videoKeys.detail(videoId ?? ''), 'transcription-status'],
    queryFn: () => videoService.getTranscriptionStatus(videoId!),
    enabled: !!videoId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 5000 : false;
    },
  });

  const prevStatus = useRef<string | undefined>();
  useEffect(() => {
    const status = statusQuery.data?.status;
    if (status === 'ready' && prevStatus.current && prevStatus.current !== 'ready') {
      queryClient.invalidateQueries({ queryKey: videoKeys.transcripts(videoId ?? '') });
      queryClient.invalidateQueries({ queryKey: videoKeys.detail(videoId ?? '') });
    }
    prevStatus.current = status;
  }, [statusQuery.data?.status, videoId, queryClient]);

  return {
    ...transcriptsQuery,
    transcriptionStatus: statusQuery.data?.status,
    transcriptionError: statusQuery.data?.error,
  };
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

/**
 * Fetches whether the current user has an in-progress dictation attempt for
 * the video. Used to warn before editing subtitles alters past scoring.
 */
export function useVideoEditStatus(videoId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: videoKeys.editStatus(videoId ?? ''),
    queryFn: () => videoService.getEditStatus(videoId!),
    enabled: !!videoId && enabled,
  });
}

/**
 * Mutation that bulk-updates transcript text for a video. Invalidates the
 * transcript cache so the next Dictation session fetches the edited text.
 */
export function useUpdateTranscripts(videoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TranscriptBulkUpdateRequest) =>
      videoService.updateTranscripts(videoId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: videoKeys.transcripts(videoId) });
      queryClient.invalidateQueries({ queryKey: videoKeys.detail(videoId) });
    },
  });
}