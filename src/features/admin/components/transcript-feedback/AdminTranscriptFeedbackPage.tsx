import { useMemo, useState } from 'react';
import { Clock, FileEdit, Loader2, RefreshCcw, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AppSelect } from '@/components/ui/app-select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SubtitleEditorDialog } from '@/features/library/components/SubtitleEditorDialog';
import { extractApiError } from '@/shared/lib/httpClient';
import type {
  AdminTranscriptFeedbackResponse,
  TranscriptFeedbackStatus,
} from '@/shared/types/api';
import { useAdminTranscriptFeedback, usePatchTranscriptFeedback } from '../../hooks/useAdmin';
import { AdminPageShell } from '../AdminPageShell';
import { AdminPagination } from '../AdminPagination';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

const PAGE_SIZE = 20;

const FILTER_OPTIONS: { value: '' | TranscriptFeedbackStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

const EDIT_STATUS_OPTIONS: { value: TranscriptFeedbackStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<TranscriptFeedbackStatus, string> = {
  pending: 'border-accent-yellow/35 bg-accent-yellow/10 text-accent-yellow',
  reviewed: 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue',
  resolved: 'border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function ProcessDialog({
  feedback,
  open,
  onOpenChange,
}: {
  feedback: AdminTranscriptFeedbackResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const patch = usePatchTranscriptFeedback();
  const [status, setStatus] = useState<TranscriptFeedbackStatus>('reviewed');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [fbId, setFbId] = useState<string | null>(null);

  if (open && feedback && fbId !== feedback.id) {
    setFbId(feedback.id);
    setStatus(feedback.status);
    setNote(feedback.admin_note ?? '');
    setError('');
  }
  if (!open && fbId !== null) setFbId(null);

  if (!feedback) return null;

  const handleSubmit = () => {
    if (patch.isPending) return;
    patch.mutate(
      { feedbackId: feedback.id, data: { status, admin_note: note.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success('Feedback updated');
          onOpenChange(false);
        },
        onError: (err) => setError(extractApiError(err, 'Failed to update feedback')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Process transcript feedback</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {feedback.video_title ?? 'Video'} — {feedback.user_name ?? 'a user'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fb-status">Status</Label>
            <AppSelect
              value={status}
              onValueChange={(v) => setStatus(v as TranscriptFeedbackStatus)}
              options={EDIT_STATUS_OPTIONS}
              triggerClassName="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fb-note">Admin note</Label>
            <textarea
              id="fb-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setError('');
              }}
              rows={3}
              placeholder="e.g. Correction applied"
              className="w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 dark:bg-input/30"
            />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={patch.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={patch.isPending}>
            {patch.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminTranscriptFeedbackPage() {
  const [status, setStatus] = useState<'' | TranscriptFeedbackStatus>('pending');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminTranscriptFeedbackResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorVideo, setEditorVideo] = useState<{ id: string; title: string } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const desktopDetail = useMediaQuery('(min-width: 1024px)');

  const params = useMemo(
    () => ({ status: status || undefined, page, page_size: PAGE_SIZE }),
    [status, page],
  );
  const { data, isLoading, isFetching, refetch } = useAdminTranscriptFeedback(params);
  const items = data?.items ?? [];
  const selected = target && items.some((item) => item.id === target.id)
    ? target
    : items[0] ?? null;

  const openProcess = (feedback: AdminTranscriptFeedbackResponse) => {
    setTarget(feedback);
    setDialogOpen(true);
  };

  const selectFeedback = (feedback: AdminTranscriptFeedbackResponse) => {
    setTarget(feedback);
    if (!desktopDetail) setDetailOpen(true);
  };

  const detail = selected ? (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[selected.status]}`}>
            {selected.status}
          </span>
          {selected.transcript_id && (
            <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
              Segment
            </span>
          )}
        </div>
        <h2 className="mt-2 text-lg font-extrabold">{selected.video_title ?? 'Untitled video'}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {selected.user_name ?? selected.user_email ?? 'Unknown'} · {formatDateTime(selected.created_at)}
        </p>
      </div>
      {selected.transcript_text && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <p className="mb-1 text-[10px] font-bold uppercase">Original</p>
          {selected.transcript_text}
        </div>
      )}
      <div>
        <p className="text-[10px] font-bold uppercase text-muted-foreground">Reported issue</p>
        <p className="mt-1 text-sm">{selected.message}</p>
      </div>
      {selected.suggested_text && (
        <div className="rounded-lg border border-accent-emerald/25 bg-accent-emerald/5 p-3 text-sm">
          <p className="mb-1 text-[10px] font-bold uppercase text-accent-emerald">Suggested correction</p>
          {selected.suggested_text}
        </div>
      )}
      {selected.admin_note && (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Admin note: </span>
          {selected.admin_note}
        </p>
      )}
      <div className="grid gap-2">
        {selected.video_id && (
          <Button
            variant="outline"
            onClick={() => setEditorVideo({ id: selected.video_id, title: selected.video_title ?? 'Video' })}
          >
            <FileEdit className="size-4" />
            Open transcript editor
          </Button>
        )}
        <Button onClick={() => openProcess(selected)}>Update status</Button>
      </div>
    </div>
  ) : null;

  return (
    <AdminPageShell
      title="Transcript Feedback"
      description="Review reported transcript issues and track correction status."
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Refresh
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              onClick={() => {
                setStatus(option.value);
                setPage(1);
                setTarget(null);
              }}
              className={`h-8 rounded-md px-3 text-xs font-bold transition-colors ${
                status === option.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid min-h-[520px] gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="flex min-h-[480px] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 text-sm font-bold">
          <span>{data?.total ?? 0} item{data?.total === 1 ? '' : 's'}</span>
          {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {isLoading ? (
          <div className="flex min-h-[260px] items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            No transcript feedback {status ? `with status “${status}”` : ''}.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto scrollbar-stable">
            {items.map((fb) => (
              <button
                type="button"
                key={fb.id}
                onClick={() => selectFeedback(fb)}
                className={`block w-full border-b border-border p-3 text-left transition-colors last:border-b-0 ${
                  selected?.id === fb.id ? 'bg-primary-soft/60' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[fb.status]}`}>
                    {fb.status}
                  </span>
                  <h3 className="truncate font-bold">{fb.video_title ?? 'Untitled video'}</h3>
                  {fb.transcript_id && (
                    <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      Segment
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3" />
                    {fb.user_name ?? fb.user_email ?? 'Unknown'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatDateTime(fb.created_at)}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-foreground">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Issue: </span>
                  {fb.message}
                </p>
              </button>
            ))}
          </div>
        )}

        <AdminPagination
          page={page}
          totalPages={data?.total_pages ?? 1}
          total={data?.total ?? 0}
          pageSize={PAGE_SIZE}
          isFetching={isFetching}
          onPageChange={setPage}
        />
      </Card>
      <Card className="hidden p-4 lg:block lg:self-start">
        {detail}
      </Card>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-5">
          <SheetHeader>
            <SheetTitle>Transcript feedback</SheetTitle>
          </SheetHeader>
          <div className="mt-2">{detail}</div>
        </SheetContent>
      </Sheet>

      <ProcessDialog feedback={target} open={dialogOpen} onOpenChange={setDialogOpen} />

      {editorVideo && (
        <SubtitleEditorDialog
          videoId={editorVideo.id}
          videoTitle={editorVideo.title}
          open={Boolean(editorVideo)}
          onOpenChange={(open) => !open && setEditorVideo(null)}
        />
      )}
    </AdminPageShell>
  );
}
