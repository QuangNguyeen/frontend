import { fireEvent, render, screen } from '@testing-library/react';
import { RecommendedVideosSection } from './RecommendedVideosSection';

const recommendationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useRecommendations: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => recommendationMocks.navigate,
  };
});

vi.mock('@/features/library/hooks/useVideos', () => ({
  useVideoRecommendations: recommendationMocks.useRecommendations,
}));

const recommendation = {
  video: {
    id: 'video-1',
    youtube_id: 'youtube-1',
    title: 'Business English at Work',
    channel: 'BBC Learning English',
    duration: 300,
    language: 'en',
    level: 'B1',
    is_curated: true,
    is_active: true,
    is_auto_generated: false,
    transcription_status: 'ready',
    transcription_error: null,
    thumbnail_url: 'https://example.com/thumb.jpg',
    play_count: 12,
    best_score: null,
    topic_tags: [
      {
        id: 'tag-1',
        slug: 'business',
        name: 'Business',
        description: null,
        is_active: true,
        sort_order: 1,
      },
    ],
  },
  reason_code: 'same_channel',
  reason_text: 'More from BBC Learning English',
};

describe('RecommendedVideosSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders recommendation metadata and opens dictation', () => {
    recommendationMocks.useRecommendations.mockReturnValue({
      data: { strategy: 'personalized', items: [recommendation] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<RecommendedVideosSection />);

    expect(screen.getByText('Recommended for you')).toBeInTheDocument();
    expect(screen.getByText('Business English at Work')).toBeInTheDocument();
    expect(screen.getByText('BBC Learning English')).toBeInTheDocument();
    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(screen.getByText('More from BBC Learning English')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link'));
    expect(recommendationMocks.navigate).toHaveBeenCalledWith('/dictation/video-1');
  });

  it('links an empty result to the catalog', () => {
    recommendationMocks.useRecommendations.mockReturnValue({
      data: { strategy: 'cold_start', items: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<RecommendedVideosSection />);
    fireEvent.click(screen.getByRole('button', { name: /browse catalog/i }));
    expect(recommendationMocks.navigate).toHaveBeenCalledWith('/library');
  });

  it('offers retry after an API error', () => {
    const refetch = vi.fn();
    recommendationMocks.useRecommendations.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
    });

    render(<RecommendedVideosSection />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
