import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LibraryPage } from './LibraryPage';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import type { UserResponse } from '@/shared/types/api';

const sampleVideo = {
  id: 'v1',
  youtube_id: 'yt1',
  title: 'Sample video',
  channel: 'Channel',
  duration: 120,
  language: 'en',
  level: 'B1',
  is_curated: false,
  is_active: true,
  is_auto_generated: false,
  transcription_status: 'ready',
  transcription_error: null,
  thumbnail_url: 'https://example.com/t.jpg',
  play_count: 0,
  best_score: null,
  publish_status: 'published',
  topic_tags: [],
  my_topic_tags: [],
};

vi.mock('../hooks/useVideos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useVideos')>();
  return {
    ...actual,
    useVideos: () => ({ data: [sampleVideo], isLoading: false, isError: false, refetch: vi.fn() }),
    useDeleteVideo: () => ({ mutate: vi.fn() }),
    useImportVideo: () => ({ mutate: vi.fn(), isPending: false }),
  };
});
vi.mock('../hooks/useTopicTags', () => ({
  useActiveTopicTags: () => ({ data: [], isLoading: false }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setUser(user: Partial<UserResponse> | null) {
  useAuthStore.setState({
    user: user ? ({ id: 'u1', email: 'e', display_name: 'U', preferred_language: 'en', streak_days: 0, is_admin: false, ...user } as UserResponse) : null,
    isAuthenticated: Boolean(user),
  });
}

beforeEach(() => {
  setUser(null);
});

describe('LibraryPage role-based controls', () => {
  it('hides admin subtitle-edit and shared-delete controls from regular users', () => {
    setUser({ is_admin: false });
    renderPage();
    expect(screen.getByRole('button', { name: /practice/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete shared video/i })).not.toBeInTheDocument();
  });

  it('shows admin controls to administrators', () => {
    setUser({ is_admin: true });
    renderPage();
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete shared video/i })).toBeInTheDocument();
  });
});
