import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from './adminService';
import { httpClient } from '@/shared/lib/httpClient';

vi.mock('@/shared/lib/httpClient', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

const mockGet = vi.mocked(httpClient.get);
const mockPost = vi.mocked(httpClient.post);
const mockPatch = vi.mocked(httpClient.patch);
const mockDelete = vi.mocked(httpClient.delete);
const mockPut = vi.mocked(httpClient.put);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin topic tag CRUD', () => {
  it('lists tags including inactive ones', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 't1' }] });
    await adminService.listTopicTags(true);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/topic-tags', {
      params: { include_inactive: true },
    });
  });

  it('creates a tag', async () => {
    mockPost.mockResolvedValue({ data: { id: 't1' } });
    await adminService.createTopicTag({ slug: 'business', name: 'Business', is_active: true, sort_order: 0 });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/admin/topic-tags', {
      slug: 'business',
      name: 'Business',
      is_active: true,
      sort_order: 0,
    });
  });

  it('updates a tag', async () => {
    mockPatch.mockResolvedValue({ data: { id: 't1' } });
    await adminService.updateTopicTag('t1', { name: 'New name' });
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/admin/topic-tags/t1', { name: 'New name' });
  });

  it('deactivates (soft-deletes) a tag via DELETE', async () => {
    mockDelete.mockResolvedValue({ status: 204 });
    await adminService.deactivateTopicTag('t1');
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/admin/topic-tags/t1');
  });
});

describe('admin publish review queue', () => {
  it('lists publish requests with status + pagination', async () => {
    mockGet.mockResolvedValue({ data: { items: [], total: 0, page: 1, total_pages: 1 } });
    await adminService.listPublishRequests({ status: 'pending', page: 1, page_size: 20 });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/videos/publish-requests', {
      params: { status: 'pending', page: 1, page_size: 20 },
    });
  });

  it('approves with admin note and topic tag ids', async () => {
    mockPost.mockResolvedValue({ data: { id: 'r1' } });
    await adminService.approvePublishRequest('r1', { admin_note: 'looks good', topic_tag_ids: ['t1'] });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/admin/videos/publish-requests/r1/approve', {
      admin_note: 'looks good',
      topic_tag_ids: ['t1'],
    });
  });

  it('rejects with an admin note', async () => {
    mockPost.mockResolvedValue({ data: { id: 'r1' } });
    await adminService.rejectPublishRequest('r1', { admin_note: 'low quality' });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/admin/videos/publish-requests/r1/reject', {
      admin_note: 'low quality',
    });
  });
});

describe('admin public video tags', () => {
  it('replaces the public tag set via PUT', async () => {
    mockPut.mockResolvedValue({ data: { id: 'v1' } });
    await adminService.setVideoTopicTags('v1', { topic_tag_ids: ['t1', 't2'] });
    expect(mockPut).toHaveBeenCalledWith('/api/v1/admin/videos/v1/topic-tags', {
      topic_tag_ids: ['t1', 't2'],
    });
  });
});

describe('admin transcript feedback queue', () => {
  it('lists feedback with status + pagination', async () => {
    mockGet.mockResolvedValue({ data: { items: [], total: 0, page: 1, total_pages: 1 } });
    await adminService.listTranscriptFeedback({ status: 'pending', page: 1, page_size: 20 });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/admin/transcript-feedback', {
      params: { status: 'pending', page: 1, page_size: 20 },
    });
  });

  it('patches feedback status and admin note', async () => {
    mockPatch.mockResolvedValue({ data: { id: 'f1' } });
    await adminService.patchTranscriptFeedback('f1', { status: 'resolved', admin_note: 'fixed' });
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/admin/transcript-feedback/f1', {
      status: 'resolved',
      admin_note: 'fixed',
    });
  });
});
