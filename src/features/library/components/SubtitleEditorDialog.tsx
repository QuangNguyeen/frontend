import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Trash2, Undo2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useUpdateTranscripts,
  useVideoEditStatus,
  useVideoTranscripts,
} from '../hooks/useVideos';
import { extractApiError } from '@/shared/lib/httpClient';
import { cn } from '@/lib/utils';

interface Props {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface RowProps {
  id: string;
  index: number;
  original: string;
  timeLabel: string;
  isDeleted: boolean;
  onChange: (id: string, text: string, original: string) => void;
  onToggleDelete: (id: string) => void;
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

const Row = memo(function Row({ id, index, original, timeLabel, isDeleted, onChange, onToggleDelete }: RowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => autoResize(textareaRef.current));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 py-3 transition-colors',
        isDeleted ? 'bg-destructive/5' : 'hover:bg-muted/30',
      )}
    >
      {/* Timeline gutter */}
      <div className="flex flex-col items-center shrink-0 w-20 pt-1 gap-1">
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono tabular-nums text-muted-foreground">
          {timeLabel}
        </span>
      </div>

      {/* Text area */}
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          defaultValue={original}
          rows={1}
          disabled={isDeleted}
          onChange={(e) => {
            onChange(id, e.target.value, original);
            autoResize(textareaRef.current);
          }}
          className={cn(
            'w-full text-sm bg-transparent rounded-lg px-3 py-2 resize-none overflow-hidden',
            'border border-transparent transition-all',
            'focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring',
            'hover:border-border',
            isDeleted && 'line-through text-muted-foreground opacity-50 cursor-not-allowed',
          )}
        />
      </div>

      {/* Delete / Undo button */}
      <div className="flex items-start pt-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onToggleDelete(id)}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            isDeleted
              ? 'text-primary hover:bg-primary/10'
              : 'text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus:opacity-100',
          )}
          title={isDeleted ? 'Undo delete' : 'Delete subtitle'}
        >
          {isDeleted ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
});

export function SubtitleEditorDialog({ videoId, videoTitle, open, onOpenChange }: Props) {
  const { data: transcripts = [], isLoading, isError, refetch } = useVideoTranscripts(
    open ? videoId : undefined,
  );
  const { data: editStatus } = useVideoEditStatus(open ? videoId : undefined);
  const updateMutation = useUpdateTranscripts(videoId);

  const currentRef = useRef<Map<string, string>>(new Map());
  const dirtySetRef = useRef<Set<string>>(new Set());
  const [dirtyCount, setDirtyCount] = useState(0);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);

  const totalChanges = dirtyCount + deletedIds.size;

  useEffect(() => {
    if (!open) return;
    currentRef.current = new Map();
    dirtySetRef.current = new Set();
    setDirtyCount(0);
    setDeletedIds(new Set());
    setSaveError('');
    setSavedBanner(false);
  }, [open, transcripts]);

  const handleRowChange = useCallback((id: string, text: string, original: string) => {
    currentRef.current.set(id, text);
    const wasDirty = dirtySetRef.current.has(id);
    const isDirty = text !== original;
    if (isDirty && !wasDirty) {
      dirtySetRef.current.add(id);
      setDirtyCount((n) => n + 1);
    } else if (!isDirty && wasDirty) {
      dirtySetRef.current.delete(id);
      setDirtyCount((n) => n - 1);
    }
    if (savedBanner) setSavedBanner(false);
    if (saveError) setSaveError('');
  }, [savedBanner, saveError]);

  const handleToggleDelete = useCallback((id: string) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (savedBanner) setSavedBanner(false);
    if (saveError) setSaveError('');
  }, [savedBanner, saveError]);

  const rows = useMemo(
    () =>
      transcripts.map((t) => ({
        id: t.id,
        index: t.index,
        original: t.text,
        timeLabel: `${formatTime(t.start_time)} – ${formatTime(t.end_time)}`,
      })),
    [transcripts],
  );

  const handleSave = () => {
    if (totalChanges === 0) return;

    const items = [
      ...Array.from(deletedIds).map((id) => ({
        transcript_id: id,
        text: '',
        is_deleted: true as const,
      })),
      ...Array.from(dirtySetRef.current)
        .filter((id) => !deletedIds.has(id))
        .map((id) => ({
          transcript_id: id,
          text: currentRef.current.get(id) ?? '',
        })),
    ];

    if (items.length === 0) return;

    updateMutation.mutate(
      { items },
      {
        onSuccess: () => {
          dirtySetRef.current = new Set();
          currentRef.current = new Map();
          setDirtyCount(0);
          setDeletedIds(new Set());
          setSavedBanner(true);
        },
        onError: (err) => setSaveError(extractApiError(err, 'Failed to save subtitles')),
      },
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && totalChanges > 0 && !updateMutation.isPending) {
      const ok = window.confirm('Discard unsaved subtitle changes?');
      if (!ok) return;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle className="pr-8">Edit Subtitles</DialogTitle>
          <DialogDescription className="line-clamp-1">{videoTitle}</DialogDescription>
        </DialogHeader>

        {editStatus?.has_in_progress_attempt && (
          <div className="mx-4 mt-3 flex gap-2 items-start rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3.5 py-2.5 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              You have already started practicing this video. Editing the subtitles
              may alter the scores of completed sentences.
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading subtitles...</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm font-medium">Failed to load subtitles</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No subtitles found for this video.
            </div>
          ) : (
            rows.map((row) => (
              <Row
                key={row.id}
                id={row.id}
                index={row.index}
                original={row.original}
                timeLabel={row.timeLabel}
                isDeleted={deletedIds.has(row.id)}
                onChange={handleRowChange}
                onToggleDelete={handleToggleDelete}
              />
            ))
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center border-t border-border px-5 py-4">
          <div className="text-xs text-muted-foreground flex items-center gap-2 min-h-5">
            {saveError && (
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {saveError}
              </span>
            )}
            {savedBanner && !saveError && (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Subtitles saved.
              </span>
            )}
            {!saveError && !savedBanner && totalChanges > 0 && (
              <span>
                {dirtyCount > 0 && `${dirtyCount} edited`}
                {dirtyCount > 0 && deletedIds.size > 0 && ', '}
                {deletedIds.size > 0 && (
                  <span className="text-destructive">{deletedIds.size} to delete</span>
                )}
              </span>
            )}
          </div>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleSave}
              disabled={totalChanges === 0 || updateMutation.isPending}
              className={cn('gap-1.5', deletedIds.size > 0 && dirtyCount === 0 && 'bg-destructive hover:bg-destructive/90')}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {deletedIds.size > 0 && dirtyCount === 0
                ? `Delete ${deletedIds.size} subtitle${deletedIds.size !== 1 ? 's' : ''}`
                : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
