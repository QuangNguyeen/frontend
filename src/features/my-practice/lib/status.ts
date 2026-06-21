import type {
  ImportVideoResult,
  PublishStatus,
  TranscriptionStatus,
} from '@/shared/types/api';

interface BadgeMeta {
  label: string;
  /** Tailwind classes for the badge surface. */
  className: string;
}

export const PUBLISH_STATUS_META: Record<PublishStatus, BadgeMeta> = {
  private: {
    label: 'Private',
    className: 'border-border bg-muted text-muted-foreground',
  },
  pending_review: {
    label: 'Pending review',
    className: 'border-accent-yellow/35 bg-accent-yellow/10 text-accent-yellow',
  },
  published: {
    label: 'Published',
    className: 'border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald',
  },
  rejected: {
    label: 'Rejected',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

export const PUBLISH_STATUS_OPTIONS: { value: '' | PublishStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'private', label: 'Private' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
];

export const TRANSCRIPTION_STATUS_META: Record<TranscriptionStatus, BadgeMeta> = {
  ready: {
    label: 'Ready',
    className: 'border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald',
  },
  pending: {
    label: 'Pending',
    className: 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow',
  },
  processing: {
    label: 'Processing',
    className: 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue',
  },
  failed: {
    label: 'Failed',
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

export const TRANSCRIPTION_STATUS_OPTIONS: { value: '' | TranscriptionStatus; label: string }[] = [
  { value: '', label: 'All transcripts' },
  { value: 'ready', label: 'Ready' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
];

export function publishStatusLabel(status: PublishStatus | undefined): string {
  if (!status) return 'Private';
  return PUBLISH_STATUS_META[status]?.label ?? status;
}

/** A private or rejected video may request publication; published / pending may not. */
export function canRequestPublish(status: PublishStatus | undefined): boolean {
  return status === 'private' || status === 'rejected';
}

export interface ImportSummary {
  /** sonner toast variant to use. */
  tone: 'success' | 'info' | 'warning';
  title: string;
  /** Extra lines describing reuse / similar importers / partial transcript. */
  details: string[];
}

/**
 * Turns an import response (+ HTTP status) into a user-facing summary, covering
 * 201 (new), 200 (existing / already in practice) and 206 (partial transcript).
 */
export function summarizeImportResult(result: ImportVideoResult): ImportSummary {
  const details: string[] = [];

  if (result.already_exists) {
    details.push('This video already existed — its transcript was reused (no duplicate created).');
  }

  if (result.similar_importers_count > 0) {
    const names = result.similar_importers.map((u) => u.display_name).filter(Boolean);
    const base = `${result.similar_importers_count} other ${
      result.similar_importers_count === 1 ? 'learner has' : 'learners have'
    } imported this video`;
    details.push(names.length > 0 ? `${base}: ${names.join(', ')}.` : `${base}.`);
  }

  if (result.http_status === 206) {
    return {
      tone: 'warning',
      title: result.message || 'Imported with partial transcript',
      details: [
        ...details,
        'Metadata was imported but transcript processing was only partially successful.',
      ],
    };
  }

  if (result.http_status === 200) {
    return {
      tone: 'info',
      title:
        result.message ||
        (result.already_in_my_practice
          ? 'This video is already in your My Practice'
          : 'Video added from existing catalog entry'),
      details,
    };
  }

  // 201 (and any other 2xx) — newly imported.
  return {
    tone: 'success',
    title: result.message || 'Video imported to My Practice',
    details,
  };
}
