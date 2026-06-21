import { describe, it, expect } from 'vitest';
import {
  canRequestPublish,
  publishStatusLabel,
  summarizeImportResult,
  PUBLISH_STATUS_META,
} from './status';
import type { ImportVideoResult, VideoResponse } from '@/shared/types/api';

function makeResult(overrides: Partial<ImportVideoResult> = {}): ImportVideoResult {
  return {
    video: { id: 'v1' } as VideoResponse,
    already_exists: false,
    already_in_my_practice: false,
    message: '',
    similar_importers_count: 0,
    similar_importers: [],
    http_status: 201,
    ...overrides,
  };
}

describe('summarizeImportResult', () => {
  it('reports a newly imported video as success on 201', () => {
    const summary = summarizeImportResult(makeResult({ http_status: 201, message: 'Imported!' }));
    expect(summary.tone).toBe('success');
    expect(summary.title).toBe('Imported!');
    expect(summary.details).toHaveLength(0);
  });

  it('flags existing videos and explains transcript reuse on 200', () => {
    const summary = summarizeImportResult(
      makeResult({ http_status: 200, already_exists: true, message: 'Reused existing video' }),
    );
    expect(summary.tone).toBe('info');
    expect(summary.title).toBe('Reused existing video');
    expect(summary.details.join(' ')).toMatch(/transcript was reused/i);
  });

  it('lists similar importer names and count', () => {
    const summary = summarizeImportResult(
      makeResult({
        http_status: 200,
        already_exists: true,
        similar_importers_count: 2,
        similar_importers: [
          { id: 'u1', display_name: 'Alice' },
          { id: 'u2', display_name: 'Bob' },
        ],
      }),
    );
    const text = summary.details.join(' ');
    expect(text).toMatch(/2 other learners have imported/i);
    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
  });

  it('warns on partial transcript (HTTP 206)', () => {
    const summary = summarizeImportResult(makeResult({ http_status: 206 }));
    expect(summary.tone).toBe('warning');
    expect(summary.details.join(' ')).toMatch(/partially successful/i);
  });

  it('surfaces "already in My Practice" on 200 without a backend message', () => {
    const summary = summarizeImportResult(
      makeResult({ http_status: 200, already_in_my_practice: true, message: '' }),
    );
    expect(summary.tone).toBe('info');
    expect(summary.title).toMatch(/already in your my practice/i);
  });
});

describe('canRequestPublish', () => {
  it('allows private and rejected videos', () => {
    expect(canRequestPublish('private')).toBe(true);
    expect(canRequestPublish('rejected')).toBe(true);
  });

  it('blocks published and pending-review videos', () => {
    expect(canRequestPublish('published')).toBe(false);
    expect(canRequestPublish('pending_review')).toBe(false);
  });
});

describe('publishStatusLabel', () => {
  it('returns readable labels', () => {
    expect(publishStatusLabel('pending_review')).toBe('Pending review');
    expect(publishStatusLabel('published')).toBe('Published');
    expect(publishStatusLabel(undefined)).toBe('Private');
  });

  it('has metadata for every status', () => {
    expect(Object.keys(PUBLISH_STATUS_META)).toEqual(
      expect.arrayContaining(['private', 'pending_review', 'published', 'rejected']),
    );
  });
});
