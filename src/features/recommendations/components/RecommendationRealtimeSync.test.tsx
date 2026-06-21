import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { RecommendationRealtimeSync } from './RecommendationRealtimeSync';
import { videoKeys } from '@/features/library/hooks/useVideos';

const authMocks = vi.hoisted(() => ({
  logout: vi.fn(),
}));

vi.mock('@/features/auth/hooks/useAuthStore', () => ({
  useAuthStore: (
    selector: (state: { accessToken: string; logout: () => Promise<void> }) => unknown,
  ) => selector({
    accessToken: 'secret-access-token',
    logout: authMocks.logout,
  }),
}));

vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn(),
}));

describe('RecommendationRealtimeSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    authMocks.logout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a bearer header, debounces invalidation, and aborts on unmount', async () => {
    let options: Parameters<typeof fetchEventSource>[1] | undefined;
    vi.mocked(fetchEventSource).mockImplementation(async (_url, requestOptions) => {
      options = requestOptions;
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <RecommendationRealtimeSync />
      </QueryClientProvider>,
    );

    await act(async () => {});

    expect(fetchEventSource).toHaveBeenCalledOnce();
    const [url] = vi.mocked(fetchEventSource).mock.calls[0];
    expect(String(url)).toContain('/api/v1/events/recommendations');
    expect(String(url)).not.toContain('secret-access-token');
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer secret-access-token',
    });

    invalidate.mockClear();
    act(() => {
      options?.onmessage?.({
        data: '{}',
        event: 'recommendations.changed',
        id: 'event-1',
      });
      options?.onmessage?.({
        data: '{}',
        event: 'recommendations.changed',
        id: 'event-2',
      });
      vi.advanceTimersByTime(499);
    });
    expect(invalidate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: videoKeys.recommendations(),
    });

    unmount();
    expect(options?.signal?.aborted).toBe(true);
  });
});
