import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Search, Trash2, Undo2 } from 'lucide-react';
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
import type { TranscriptUpdateItem } from '@/shared/types/api';

interface Props {
  videoId: string;
  videoTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Formats seconds as `mm:ss`, `h:mm:ss`, with a `.mmm` suffix when sub-second precision exists. */
function formatTimeInput(seconds: number): string {
  const s = Math.max(0, seconds);
  const whole = Math.floor(s);
  let ms = Math.round((s - whole) * 1000);
  let totalWhole = whole;
  if (ms >= 1000) {
    totalWhole += 1;
    ms -= 1000;
  }
  const h = Math.floor(totalWhole / 3600);
  const m = Math.floor((totalWhole % 3600) / 60);
  const sec = totalWhole % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  const base = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return ms > 0 ? `${base}.${ms.toString().padStart(3, '0')}` : base;
}

/**
 * Parses flexible timestamp input into seconds. Accepts plain seconds (`83.5`),
 * `mm:ss(.mmm)`, or `h:mm:ss(.mmm)`. Returns null when the value is unparseable.
 */
function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length > 3) return null;
  let seconds = 0;
  for (const part of parts) {
    if (part === '') return null;
    const n = Number(part);
    if (!Number.isFinite(n) || n < 0) return null;
    seconds = seconds * 60 + n;
  }
  return seconds;
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

interface RowProps {
  id: string;
  index: number;
  original: string;
  startTime: number;
  endTime: number;
  displayStart: number;
  displayEnd: number;
  isDeleted: boolean;
  isEdited: boolean;
  isTimeEdited: boolean;
  isTimeInvalid: boolean;
  onChange: (id: string, text: string, original: string) => void;
  onTimeChange: (id: string, startStr: string, endStr: string, origStart: number, origEnd: number) => void;
  onToggleDelete: (id: string) => void;
}

const Row = memo(function Row({
  id,
  index,
  original,
  startTime,
  endTime,
  displayStart,
  displayEnd,
  isDeleted,
  isEdited,
  isTimeEdited,
  isTimeInvalid,
  onChange,
  onTimeChange,
  onToggleDelete,
}: RowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const timeBoxRef = useRef<HTMLDivElement>(null);
  const [editingTime, setEditingTime] = useState(false);
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => autoResize(textareaRef.current));
    }
  }, [isEditing]);

  const beginEditTime = () => {
    if (isDeleted) return;
    setStartStr(formatTimeInput(displayStart));
    setEndStr(formatTimeInput(displayEnd));
    setEditingTime(true);
  };

  const handleTimeBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!timeBoxRef.current?.contains(e.relatedTarget as Node | null)) {
      setEditingTime(false);
    }
  };

  return (
    <div
      className={cn(
        'group flex gap-2 sm:gap-3 p-2.5 sm:p-3 bg-card border rounded-lg transition-all',
        isDeleted
          ? 'bg-destructive/5 border-destructive/20'
          : isEdited || isTimeEdited
            ? 'border-primary/30 shadow-sm'
            : 'border-border hover:border-primary/20 hover:shadow-sm',
      )}
    >
      {/* Left accent for edited rows */}
      {(isEdited || isTimeEdited) && !isDeleted && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-full" />
      )}

      {/* Timeline gutter */}
      <div className="w-16 sm:w-24 shrink-0 flex flex-col items-center gap-1 border-r border-border pr-2 sm:pr-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{index + 1}</span>
        {editingTime && !isDeleted ? (
          <div ref={timeBoxRef} onBlur={handleTimeBlur} className="flex flex-col gap-1 w-full">
            <input
              value={startStr}
              autoFocus
              inputMode="decimal"
              aria-label="Start time"
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setStartStr(e.target.value);
                onTimeChange(id, e.target.value, endStr, startTime, endTime);
              }}
              className="w-full text-[10px] font-mono font-bold text-center bg-muted rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/40"
            />
            <input
              value={endStr}
              inputMode="decimal"
              aria-label="End time"
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setEndStr(e.target.value);
                onTimeChange(id, startStr, e.target.value, startTime, endTime);
              }}
              className="w-full text-[10px] font-mono font-bold text-center bg-muted rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={beginEditTime}
            disabled={isDeleted}
            title={isDeleted ? undefined : 'Edit timing'}
            className={cn(
              'w-full rounded font-mono text-[10px] px-1 sm:px-1.5 py-0.5 sm:py-1 leading-tight text-center font-bold transition-colors',
              isTimeInvalid
                ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/40'
                : isTimeEdited
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              isDeleted && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className="block">{formatTimeInput(displayStart)}</span>
            <span className="block opacity-70">{formatTimeInput(displayEnd)}</span>
          </button>
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 relative">
        {isEditing || isDeleted ? (
          <textarea
            ref={textareaRef}
            defaultValue={original}
            rows={2}
            disabled={isDeleted}
            spellCheck={false}
            autoFocus={!isDeleted}
            onBlur={() => setIsEditing(false)}
            onChange={(e) => {
              onChange(id, e.target.value, original);
              autoResize(textareaRef.current);
            }}
            className={cn(
              'w-full text-sm bg-transparent resize-none outline-none leading-snug py-0.5',
              'placeholder:text-muted-foreground',
              isDeleted && 'line-through text-muted-foreground opacity-50 cursor-not-allowed',
            )}
          />
        ) : (
          <p
            onClick={() => setIsEditing(true)}
            className="text-sm leading-snug py-0.5 cursor-text hover:bg-muted/40 rounded px-1 -mx-1 transition-colors min-h-[2.5em]"
          >
            {original}
          </p>
        )}
      </div>

      {/* Delete / Undo button */}
      <div className="flex flex-col justify-start shrink-0">
        <button
          type="button"
          onClick={() => onToggleDelete(id)}
          className={cn(
            'p-1.5 rounded-md transition-all duration-200',
            isDeleted
              ? 'text-primary hover:bg-primary/10'
              : 'text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100',
          )}
          title={isDeleted ? 'Undo delete' : 'Delete subtitle'}
        >
          {isDeleted ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
});

const EMPTY_TRANSCRIPTS: never[] = [];

export function SubtitleEditorDialog({ videoId, videoTitle, open, onOpenChange }: Props) {
  const { data: transcripts = EMPTY_TRANSCRIPTS, isLoading, isError, refetch } = useVideoTranscripts(
    open ? videoId : undefined,
  );
  const { data: editStatus } = useVideoEditStatus(open ? videoId : undefined);
  const updateMutation = useUpdateTranscripts(videoId);

  const currentRef = useRef<Map<string, string>>(new Map());
  const dirtySetRef = useRef<Set<string>>(new Set());
  const timeDirtySetRef = useRef<Set<string>>(new Set());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [timeDirtyIds, setTimeDirtyIds] = useState<Set<string>>(new Set());
  const [pendingTimes, setPendingTimes] = useState<Map<string, { start: number; end: number }>>(
    new Map(),
  );
  const [invalidTimeIds, setInvalidTimeIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const changedIds = useMemo(() => {
    const ids = new Set<string>();
    dirtyIds.forEach((id) => ids.add(id));
    timeDirtyIds.forEach((id) => ids.add(id));
    deletedIds.forEach((id) => ids.add(id));
    return ids;
  }, [dirtyIds, timeDirtyIds, deletedIds]);
  const totalChanges = changedIds.size;

  useEffect(() => {
    if (!open) return;
    currentRef.current = new Map();
    dirtySetRef.current = new Set();
    timeDirtySetRef.current = new Set();
    queueMicrotask(() => {
      setDirtyIds(new Set());
      setDeletedIds(new Set());
      setTimeDirtyIds(new Set());
      setInvalidTimeIds(new Set());
      setPendingTimes(new Map());
      setSaveError('');
      setSavedBanner(false);
      setSearchQuery('');
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    currentRef.current = new Map();
    dirtySetRef.current = new Set();
    timeDirtySetRef.current = new Set();
    queueMicrotask(() => {
      setDirtyIds(new Set());
      setDeletedIds(new Set());
      setTimeDirtyIds(new Set());
      setInvalidTimeIds(new Set());
      setPendingTimes(new Map());
    });
  }, [transcripts, open]);

  const handleSave = useCallback(() => {
    if (totalChanges === 0) return;
    if (invalidTimeIds.size > 0) {
      setSaveError('Some timestamps are invalid. End time must be greater than start time.');
      return;
    }

    const ids = new Set<string>([
      ...deletedIds,
      ...dirtySetRef.current,
      ...timeDirtySetRef.current,
    ]);

    const items: TranscriptUpdateItem[] = [];
    ids.forEach((id) => {
      if (deletedIds.has(id)) {
        items.push({ transcript_id: id, text: '', is_deleted: true });
        return;
      }
      // Empty text tells the backend to keep the existing text (time-only edits).
      const item: TranscriptUpdateItem = {
        transcript_id: id,
        text: dirtySetRef.current.has(id) ? currentRef.current.get(id) ?? '' : '',
      };
      if (timeDirtySetRef.current.has(id)) {
        const times = pendingTimes.get(id);
        if (times) {
          item.start_time = times.start;
          item.end_time = times.end;
        }
      }
      items.push(item);
    });

    if (items.length === 0) return;

    updateMutation.mutate(
      { items },
      {
        onSuccess: () => {
          setSavedBanner(true);
          setSaveError('');
        },
        onError: (err) => setSaveError(extractApiError(err, 'Failed to save subtitles')),
      },
    );
  }, [deletedIds, totalChanges, invalidTimeIds, pendingTimes, updateMutation]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (totalChanges > 0 && !updateMutation.isPending) {
          handleSave();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, open, totalChanges, updateMutation.isPending]);

  const handleRowChange = useCallback((id: string, text: string, original: string) => {
    currentRef.current.set(id, text);
    const wasDirty = dirtySetRef.current.has(id);
    const isDirty = text !== original;
    if (isDirty && !wasDirty) {
      dirtySetRef.current.add(id);
      setDirtyIds(new Set(dirtySetRef.current));
    } else if (!isDirty && wasDirty) {
      dirtySetRef.current.delete(id);
      setDirtyIds(new Set(dirtySetRef.current));
    }
    if (savedBanner) setSavedBanner(false);
    if (saveError) setSaveError('');
  }, [savedBanner, saveError]);

  const handleTimeChange = useCallback(
    (id: string, startInput: string, endInput: string, origStart: number, origEnd: number) => {
      const start = parseTimeInput(startInput);
      const end = parseTimeInput(endInput);
      const valid = start !== null && end !== null && start >= 0 && end > start;

      setInvalidTimeIds((prev) => {
        const next = new Set(prev);
        if (valid) next.delete(id);
        else next.add(id);
        return next;
      });

      const isDirty = valid && (start !== origStart || end !== origEnd);
      if (valid && isDirty) {
        timeDirtySetRef.current.add(id);
      } else if (valid) {
        timeDirtySetRef.current.delete(id);
      } else {
        // Unparseable / inverted: keep it flagged as a pending change so Save stays
        // blocked and Undo All remains available.
        timeDirtySetRef.current.add(id);
      }
      setTimeDirtyIds(new Set(timeDirtySetRef.current));
      setPendingTimes((prev) => {
        const next = new Map(prev);
        if (valid && isDirty) next.set(id, { start: start!, end: end! });
        else next.delete(id);
        return next;
      });

      if (savedBanner) setSavedBanner(false);
      if (saveError) setSaveError('');
    },
    [savedBanner, saveError],
  );

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

  const handleUndoAll = useCallback(() => {
    setDeletedIds(new Set());
    dirtySetRef.current = new Set();
    currentRef.current = new Map();
    timeDirtySetRef.current = new Set();
    setDirtyIds(new Set());
    setTimeDirtyIds(new Set());
    setInvalidTimeIds(new Set());
    setPendingTimes(new Map());
    setSaveError('');
    setSavedBanner(false);
  }, []);

  const rows = useMemo(
    () =>
      transcripts.map((t) => {
        const pending = pendingTimes.get(t.id);
        return {
          id: t.id,
          index: t.index,
          original: t.text,
          startTime: t.start_time,
          endTime: t.end_time,
          displayStart: pending ? pending.start : t.start_time,
          displayEnd: pending ? pending.end : t.end_time,
        };
      }),
    [transcripts, pendingTimes],
  );

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) => r.original.toLowerCase().includes(q) || `#${r.index + 1}`.includes(q),
    );
  }, [rows, searchQuery]);

  const handleOpenChange = (next: boolean) => {
    if (!next && totalChanges > 0 && !updateMutation.isPending) {
      const ok = window.confirm('Discard unsaved subtitle changes?');
      if (!ok) return;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 gap-0 flex flex-col rounded-xl overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-bold leading-none pr-8">Edit Subtitles</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1.5 font-medium line-clamp-1">{videoTitle}</DialogDescription>
        </DialogHeader>

        {/* Search filter bar */}
        {rows.length > 0 && (
          <div className="px-4 md:px-5 pt-3 pb-2 border-b border-border/60 bg-card shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subtitles or type #number…"
                className="w-full h-8 pl-8 pr-3 text-sm bg-muted/50 border border-border rounded-lg outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
              />
              {searchQuery && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {filteredRows.length}/{rows.length}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-muted/30">
          {editStatus?.has_in_progress_attempt && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 mb-4 shadow-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                You have already started practicing this video. Editing the subtitles
                may alter the scores of completed sentences.
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading subtitles...</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm font-medium">Failed to load subtitles</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No subtitles match your search.' : 'No subtitles found for this video.'}
              </div>
            ) : (
              filteredRows.map((row) => (
                <Row
                  key={row.id}
                  id={row.id}
                  index={row.index}
                  original={row.original}
                  startTime={row.startTime}
                  endTime={row.endTime}
                  displayStart={row.displayStart}
                  displayEnd={row.displayEnd}
                  isDeleted={deletedIds.has(row.id)}
                  isEdited={dirtyIds.has(row.id)}
                  isTimeEdited={timeDirtyIds.has(row.id) && !invalidTimeIds.has(row.id)}
                  isTimeInvalid={invalidTimeIds.has(row.id)}
                  onChange={handleRowChange}
                  onTimeChange={handleTimeChange}
                  onToggleDelete={handleToggleDelete}
                />
              ))
            )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 flex-col gap-2 rounded-none sm:flex-row sm:justify-between sm:items-center border-t border-border px-5 py-3 bg-card shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
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
          </div>
          <div className="flex items-center gap-2.5 sm:justify-end">
            {totalChanges > 0 && !saveError && !savedBanner && (
              <button
                onClick={handleUndoAll}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
              >
                <Undo2 className="h-3 w-3" />
                Undo All
              </button>
            )}
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="px-5 rounded-lg font-semibold"
            >
              Close
            </Button>
            <Button
              onClick={handleSave}
              disabled={totalChanges === 0 || updateMutation.isPending || invalidTimeIds.size > 0}
              className={cn(
                'px-5 rounded-lg font-semibold shadow-md gap-2',
                deletedIds.size > 0 &&
                  dirtyIds.size === 0 &&
                  timeDirtyIds.size === 0 &&
                  'bg-destructive hover:bg-destructive/90',
              )}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {deletedIds.size > 0 && dirtyIds.size === 0 && timeDirtyIds.size === 0
                ? `Delete ${deletedIds.size}`
                : 'Save'}
              {totalChanges > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                  {totalChanges}
                </span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
