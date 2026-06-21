import { useMemo, useState } from 'react';
import { Check, Clock, Loader2, RefreshCcw, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { TopicTagChips } from '@/components/ui/topic-tag-chips';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { extractApiError } from '@/shared/lib/httpClient';
import type { PublishRequestResponse, PublishRequestStatus } from '@/shared/types/api';
import {
  useAdminPublishRequests,
  useAdminTopicTags,
  useApprovePublishRequest,
  useRejectPublishRequest,
} from '../../hooks/useAdmin';
import { AdminPageShell } from '../AdminPageShell';
import { AdminPagination } from '../AdminPagination';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: '' | PublishRequestStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
];

const STATUS_BADGE: Record<PublishRequestStatus, string> = {
  pending: 'border-accent-yellow/35 bg-accent-yellow/10 text-accent-yellow',
  approved: 'border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  cancelled: 'border-border bg-muted text-muted-foreground',
};

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function ReviewDialog({
  request,
  mode,
  open,
  onOpenChange,
}: {
  request: PublishRequestResponse | null;
  mode: 'approve' | 'reject';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: allTags = [] } = useAdminTopicTags(true);
  const activeTags = useMemo(() => allTags.filter((t) => t.is_active), [allTags]);
  const approve = useApprovePublishRequest();
  const reject = useRejectPublishRequest();
  const pending = approve.isPending || reject.isPending;

  const [note, setNote] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [reqId, setReqId] = useState<string | null>(null);

  // Re-seed local state whenever a new request is opened.
  if (open && request && reqId !== request.id) {
    setReqId(request.id);
    setNote('');
    setTagIds((request.video?.topic_tags ?? []).map((t) => t.id));
    setError('');
  }
  if (!open && reqId !== null) setReqId(null);

  if (!request) return null;

  const handleSubmit = () => {
    if (pending) return;
    const onSuccess = () => {
      toast.success(mode === 'approve' ? 'Video published' : 'Request rejected');
      onOpenChange(false);
    };
    const onError = (err: unknown) => setError(extractApiError(err, 'Review action failed'));

    if (mode === 'approve') {
      approve.mutate(
        { requestId: request.id, data: { admin_note: note.trim() || undefined, topic_tag_ids: tagIds } },
        { onSuccess, onError },
      );
    } else {
      reject.mutate(
        { requestId: request.id, data: { admin_note: note.trim() || undefined } },
        { onSuccess, onError },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'approve' ? 'Approve & publish' : 'Reject request'}</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {request.video?.title ?? 'Video'} — requested by {request.requested_by_name ?? 'a user'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'approve' && (
            <div className="space-y-1.5">
              <Label htmlFor="approve-tags">Public topic tags</Label>
              <TagMultiSelect
                id="approve-tags"
                options={activeTags}
                value={tagIds}
                onChange={setTagIds}
                placeholder="Select public catalog tags"
                emptyText="No active topic tags"
              />
              <p className="text-xs text-muted-foreground">
                These become the video’s public catalog tags. Only active tags can be selected.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="admin-note">Admin note {mode === 'approve' ? '(optional)' : ''}</Label>
            <textarea
              id="admin-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setError('');
              }}
              rows={3}
              placeholder={mode === 'approve' ? 'Optional note…' : 'Explain why this was rejected…'}
              className="w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 dark:bg-input/30"
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={pending}
            variant={mode === 'reject' ? 'destructive' : 'default'}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === 'approve' ? (
              <>
                <Check className="size-4" />
                Approve & publish
              </>
            ) : (
              <>
                <X className="size-4" />
                Reject
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminPublishRequestsPage() {
  const [status, setStatus] = useState<'' | PublishRequestStatus>('pending');
  const [page, setPage] = useState(1);
  const [reviewMode, setReviewMode] = useState<'approve' | 'reject'>('approve');
  const [target, setTarget] = useState<PublishRequestResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const desktopDetail = useMediaQuery('(min-width: 1024px)');

  const params = useMemo(
    () => ({ status: status || undefined, page, page_size: PAGE_SIZE }),
    [status, page],
  );
  const { data, isLoading, isFetching, refetch } = useAdminPublishRequests(params);
  const items = data?.items ?? [];
  const selected = target && items.some((item) => item.id === target.id)
    ? target
    : items[0] ?? null;

  const openReview = (request: PublishRequestResponse, mode: 'approve' | 'reject') => {
    setTarget(request);
    setReviewMode(mode);
    setDialogOpen(true);
  };

  const selectRequest = (request: PublishRequestResponse) => {
    setTarget(request);
    if (!desktopDetail) setDetailOpen(true);
  };

  const detail = selected ? (
    <div className="space-y-4">
      {selected.video?.thumbnail_url && (
        <img
          src={selected.video.thumbnail_url}
          alt=""
          className="aspect-video w-full rounded-lg object-cover"
        />
      )}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[selected.status]}`}>
            {selected.status}
          </span>
          <span className="text-xs text-muted-foreground">{formatDateTime(selected.created_at)}</span>
        </div>
        <h2 className="mt-2 text-lg font-extrabold">{selected.video?.title ?? 'Untitled video'}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Requested by {selected.requested_by_name ?? selected.requested_by_email ?? 'Unknown'}
        </p>
      </div>
      {selected.message && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">“{selected.message}”</div>
      )}
      {(selected.video?.my_topic_tags?.length || selected.video?.topic_tags?.length) ? (
        <TopicTagChips
          publicTags={selected.video?.topic_tags}
          personalTags={selected.video?.my_topic_tags}
          showGroupLabels
        />
      ) : null}
      {selected.admin_note && (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Admin note: </span>
          {selected.admin_note}
        </p>
      )}
      {selected.status === 'pending' && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => openReview(selected, 'approve')}>
            <Check className="size-4" />
            Approve
          </Button>
          <Button variant="destructive" onClick={() => openReview(selected, 'reject')}>
            <X className="size-4" />
            Reject
          </Button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <AdminPageShell
      title="Publish Review"
      description="Review user submissions before they enter the public catalog."
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Refresh
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {STATUS_OPTIONS.map((option) => (
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
      <div className="grid min-h-[520px] gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="flex min-h-[480px] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 text-sm font-bold">
          <span>{data?.total ?? 0} request{data?.total === 1 ? '' : 's'}</span>
          {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {isLoading ? (
          <div className="flex min-h-[260px] items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            No publish requests {status ? `with status “${status}”` : ''}.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto scrollbar-stable">
            {items.map((req) => {
              const video = req.video;
              return (
                <button
                  type="button"
                  key={req.id}
                  onClick={() => selectRequest(req)}
                  className={`block w-full border-b border-border p-3 text-left transition-colors last:border-b-0 ${
                    selected?.id === req.id ? 'bg-primary-soft/60' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex gap-3">
                    {video?.thumbnail_url && (
                      <img
                        src={video.thumbnail_url}
                        alt=""
                        className="h-16 w-24 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[req.status]}`}>
                          {req.status}
                        </span>
                        <h3 className="truncate font-bold">{video?.title ?? 'Untitled video'}</h3>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" />
                          {req.requested_by_name ?? req.requested_by_email ?? 'Unknown'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDateTime(req.created_at)}
                        </span>
                        {req.reviewed_at && <span>Reviewed {formatDateTime(req.reviewed_at)}</span>}
                      </div>

                      {req.message && (
                        <p className="mt-2 rounded-lg bg-muted/50 p-2 text-sm text-foreground">
                          “{req.message}”
                        </p>
                      )}

                    </div>
                  </div>
                </button>
              );
            })}
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
            <SheetTitle>Publish request</SheetTitle>
          </SheetHeader>
          <div className="mt-2">{detail}</div>
        </SheetContent>
      </Sheet>

      <ReviewDialog request={target} mode={reviewMode} open={dialogOpen} onOpenChange={setDialogOpen} />
    </AdminPageShell>
  );
}
