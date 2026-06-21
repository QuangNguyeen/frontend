import { describe, it, expect, vi, beforeEach } from 'vitest';
import { videoService } from './videoService';
import { httpClient } from '@/shared/lib/httpClient';

vi.mock('@/shared/lib/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

const mockGet = vi.mocked(httpClient.get);
const mockPost = vi.mocked(httpClient.post);
const mockDelete = vi.mocked(httpClient.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('videoService.recommendations', () => {
  it('requests the authenticated recommendation endpoint with the limit', async () => {
    mockGet.mockResolvedValue({
      data: { strategy: 'personalized', items: [] },
    });

    const result = await videoService.recommendations(8);

    expect(mockGet).toHaveBeenCalledWith('/api/v1/videos/recommendations', {
      params: { limit: 8 },
    });
    expect(result).toEqual({ strategy: 'personalized', items: [] });
  });
});

describe('videoService.import', () => {
  it('sends topic_tag_ids and maps a 201 wrapper', async () => {
    mockPost.mockResolvedValue({
      status: 201,
      data: {
        video: { id: 'v1' },
        already_exists: false,
        already_in_my_practice: false,
        message: 'ok',
        similar_importers_count: 0,
        similar_importers: [],
      },
    });

    const result = await videoService.import({
      youtube_url: 'https://youtu.be/x',
      topic_tag_ids: ['t1', 't2'],
    });

    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/api/v1/videos/import');
    expect(body).toMatchObject({ topic_tag_ids: ['t1', 't2'] });
    // 206 must not be treated as an error by axios.
    expect((config as { validateStatus: (s: number) => boolean }).validateStatus(206)).toBe(true);
    expect((config as { validateStatus: (s: number) => boolean }).validateStatus(400)).toBe(false);
    expect(result.http_status).toBe(201);
    expect(result.video.id).toBe('v1');
  });

  it('captures HTTP 206 for partial transcript imports', async () => {
    mockPost.mockResolvedValue({
      status: 206,
      data: { video: { id: 'v2' }, message: 'partial', already_exists: false },
    });
    const result = await videoService.import({ youtube_url: 'u' });
    expect(result.http_status).toBe(206);
    expect(result.message).toBe('partial');
  });

  it('reports existing videos and similar importers (200)', async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: {
        video: { id: 'v3' },
        already_exists: true,
        already_in_my_practice: false,
        message: 'exists',
        similar_importers_count: 1,
        similar_importers: [{ id: 'u1', display_name: 'Alice' }],
      },
    });
    const result = await videoService.import({ youtube_url: 'u' });
    expect(result.http_status).toBe(200);
    expect(result.already_exists).toBe(true);
    expect(result.similar_importers_count).toBe(1);
    expect(result.similar_importers[0].display_name).toBe('Alice');
  });
});

describe('videoService.listMyPractice', () => {
  it('forwards filters and pagination, dropping empty values', async () => {
    mockGet.mockResolvedValue({
      data: { items: [{ id: 'v1' }], total: 1, page: 2, total_pages: 5 },
    });

    const res = await videoService.listMyPractice({
      publish_status: 'private',
      language: 'en',
      level: '',
      topic_tag: 'business',
      page: 2,
      page_size: 12,
    });

    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe('/api/v1/videos/my-practice');
    expect((config as { params: Record<string, unknown> }).params).toEqual({
      publish_status: 'private',
      language: 'en',
      topic_tag: 'business',
      page: 2,
      page_size: 12,
    });
    expect(res.total).toBe(1);
    expect(res.page).toBe(2);
    expect(res.total_pages).toBe(5);
  });

  it('tolerates a bare array response', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }] });
    const res = await videoService.listMyPractice();
    expect(res.items).toHaveLength(2);
    expect(res.total).toBe(2);
  });
});

describe('videoService.removeFromMyPractice', () => {
  it('calls the My Practice DELETE endpoint (not shared deletion)', async () => {
    mockDelete.mockResolvedValue({ status: 204 });
    await videoService.removeFromMyPractice('v1');
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/videos/my-practice/v1');
    expect(mockDelete).not.toHaveBeenCalledWith('/api/v1/videos/v1');
  });
});

describe('videoService.requestPublish', () => {
  it('posts the optional message', async () => {
    mockPost.mockResolvedValue({ status: 200, data: {} });
    await videoService.requestPublish('v1', { message: 'please publish' });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/videos/v1/publish-request', {
      message: 'please publish',
    });
  });
});

describe('videoService.submitTranscriptFeedback', () => {
  it('includes transcript_id for segment-level feedback', async () => {
    mockPost.mockResolvedValue({ status: 200, data: {} });
    await videoService.submitTranscriptFeedback('v1', {
      transcript_id: 'seg-9',
      message: 'wrong word',
      suggested_text: 'right word',
    });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/videos/v1/transcript-feedback', {
      transcript_id: 'seg-9',
      message: 'wrong word',
      suggested_text: 'right word',
    });
  });
});

describe('videoService.list (public catalog)', () => {
  it('passes the topic_tag filter and unwraps items', async () => {
    mockGet.mockResolvedValue({ data: { items: [{ id: 'v1' }] } });
    const res = await videoService.list({ topic_tag: 'news', language: 'en' });
    const [url, config] = mockGet.mock.calls[0];
    expect(url).toBe('/api/v1/videos');
    expect((config as { params: Record<string, unknown> }).params).toEqual({
      topic_tag: 'news',
      language: 'en',
    });
    expect(res).toHaveLength(1);
  });

  it('passes multiple topic_tag values and repeats the key (no brackets)', async () => {
    mockGet.mockResolvedValue({ data: [] });
    await videoService.list({ topic_tag: ['news', 'business'] });
    const [, config] = mockGet.mock.calls[0] as [string, {
      params: Record<string, unknown>;
      paramsSerializer: { indexes: null };
    }];
    expect(config.params.topic_tag).toEqual(['news', 'business']);
    // `{ indexes: null }` makes axios serialize as topic_tag=news&topic_tag=business.
    expect(config.paramsSerializer).toEqual({ indexes: null });
  });

  it('drops an empty topic_tag array', async () => {
    mockGet.mockResolvedValue({ data: [] });
    await videoService.list({ topic_tag: [], language: 'en' });
    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params).toEqual({ language: 'en' });
  });
});

describe('videoService.listMyPractice (multi topic filter)', () => {
  it('forwards an array of topic-tag slugs', async () => {
    mockGet.mockResolvedValue({ data: { items: [], total: 0, page: 1, total_pages: 1 } });
    await videoService.listMyPractice({ topic_tag: ['a', 'b'], page: 1, page_size: 12 });
    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.topic_tag).toEqual(['a', 'b']);
  });
});
