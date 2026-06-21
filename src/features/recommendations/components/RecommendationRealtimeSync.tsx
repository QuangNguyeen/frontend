import { useEffect } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { videoKeys } from '@/features/library/hooks/useVideos';
import { getRecommendationReconnectDelay } from '../lib/reconnect';

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const INVALIDATE_DEBOUNCE_MS = 500;

class FatalStreamError extends Error {}

export function RecommendationRealtimeSync() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const token = accessToken ?? localStorage.getItem('access_token');
    if (!token) return;

    const controller = new AbortController();
    let reconnectAttempt = 0;
    let invalidateTimer: number | undefined;

    const invalidateRecommendations = () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.recommendations() });
    };

    const scheduleInvalidation = () => {
      window.clearTimeout(invalidateTimer);
      invalidateTimer = window.setTimeout(
        invalidateRecommendations,
        INVALIDATE_DEBOUNCE_MS,
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        invalidateRecommendations();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    void fetchEventSource(`${API_URL}/api/v1/events/recommendations`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      openWhenHidden: false,
      async onopen(response) {
        if (response.status === 401 || response.status === 403) {
          void logout();
          throw new FatalStreamError('Recommendation stream authorization failed');
        }
        if (!response.ok) {
          throw new Error(`Recommendation stream failed with ${response.status}`);
        }
        reconnectAttempt = 0;
        invalidateRecommendations();
      },
      onmessage(message) {
        if (message.event === 'recommendations.changed') {
          scheduleInvalidation();
        }
      },
      onclose() {
        throw new Error('Recommendation stream closed');
      },
      onerror(error) {
        if (error instanceof FatalStreamError || controller.signal.aborted) {
          throw error;
        }
        return getRecommendationReconnectDelay(reconnectAttempt++);
      },
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && !(error instanceof FatalStreamError)) {
        console.warn('Recommendation realtime sync unavailable', error);
      }
    });

    return () => {
      controller.abort();
      window.clearTimeout(invalidateTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [accessToken, logout, queryClient]);

  return null;
}
