import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Loader2,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Trash2,
  Video,
  WandSparkles,
  Power,
  PowerOff,
  Gauge,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { TopicTagChips } from '@/components/ui/topic-tag-chips';
import { extractApiError } from '@/shared/lib/httpClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppSelect } from '@/components/ui/app-select';
import type { AdminVideoResponse } from '@/shared/types/api';
import {
  LANGUAGE_OPTIONS,
  getLanguageLabel,
  getLevelOptions,
  getLevelOptionsWithAll,
  getLevelLabel,
  isLevelValidForLanguage,
} from '@/shared/lib/languageLevels';
import {
  useAdminTopicTags,
  useAdminVideos,
  useDeleteAdminVideo,
  usePatchAdminVideo,
  useRecalculateAdminDifficulty,
  useRetryAdminTranscription,
  useSetVideoTopicTags,
} from '../../hooks/useAdmin';
import { AdminPageShell } from '../AdminPageShell';
import { AdminPagination } from '../AdminPagination';
import { AdminEmptyState, AdminLoadingSkeleton } from '../AdminStates';

const LANGUAGE_FILTER_OPTIONS = [
  { value: '', label: 'All languages' },
  ...LANGUAGE_OPTIONS,
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'ready', label: 'Ready' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

const CURATED_OPTIONS = [
  { value: '', label: 'All curated' },
  { value: 'true', label: 'Curated' },
  { value: 'false', label: 'Not curated' },
];

const CURATED_LABELS: Record<string, string> = {
  true: 'Curated',
  false: 'Not curated',
};

type AdminVideoFilters = {
  search: string;
  status: string;
  language: string;
  level: string;
  curated: string;
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function parseBool(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function buildEmptyStateText(filters: AdminVideoFilters) {
  const labels = [
    filters.search ? `"${filters.search}"` : '',
    filters.language ? getLanguageLabel(filters.language) : '',
    filters.level ? getLevelLabel(filters.language, filters.level) : '',
    filters.status ? STATUS_LABELS[filters.status] ?? filters.status : '',
    filters.curated ? CURATED_LABELS[filters.curated] ?? filters.curated : '',
  ].filter(Boolean);

  return labels.length
    ? `No videos match ${labels.join(' · ')}.`
    : 'No videos match the selected filters.';
}

function StatusBadge({ video }: { video: AdminVideoResponse }) {
  const statusClass =
    video.transcription_status === 'failed'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : video.transcription_status === 'ready'
        ? 'border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald'
        : 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-bold ${statusClass}`}>
        {STATUS_LABELS[video.transcription_status] ?? video.transcription_status}
      </span>
      <span
        className={
          video.is_active
            ? 'text-xs font-semibold text-accent-emerald'
            : 'text-xs font-semibold text-muted-foreground'
        }
      >
        {video.is_active ? 'Active' : 'Inactive'}
      </span>
      {video.is_curated && (
        <span className="rounded-full border border-accent-yellow/35 bg-accent-yellow/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-yellow">
          Curated
        </span>
      )}
    </div>
  );
}

function DifficultyBadge({ video }: { video: AdminVideoResponse }) {
  const level = video.difficulty_level ?? video.level;
  if (!level) {
    return <span className="text-xs font-semibold text-muted-foreground">Unrated</span>;
  }

  const score = video.difficulty_score != null ? Math.round(video.difficulty_score) : null;
  const factors = video.difficulty_factors ?? {};
  const avgWords = typeof factors.avgWordsPerSegment === 'number' ? factors.avgWordsPerSegment : null;
  const wpm = typeof factors.wordsPerMinute === 'number' ? factors.wordsPerMinute : null;
  const title = [
    score != null ? `Score ${score}/100` : null,
    avgWords != null ? `Avg words: ${avgWords}` : null,
    wpm != null ? `WPM: ${wpm}` : null,
    video.difficulty_label ? `Level: ${video.difficulty_label}` : null,
  ].filter(Boolean).join('\n');

  return (
    <span
      title={title || undefined}
      className="inline-flex w-fit rounded-full border border-primary/25 bg-primary-soft px-2 py-0.5 text-xs font-extrabold text-primary"
    >
      {level}
      {score != null && <span className="ml-1 font-semibold text-muted-foreground">{score}</span>}
    </span>
  );
}

function VideoActions({
  video,
  onPatch,
  onRetry,
  onRecalculate,
  onDelete,
  onEditTags,
  pending,
}: {
  video: AdminVideoResponse;
  onPatch: (data: { is_active?: boolean; is_curated?: boolean }) => void;
  onRetry: () => void;
  onRecalculate: () => void;
  onDelete: () => void;
  onEditTags: () => void;
  pending: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canRetry =
    video.transcription_status === 'failed' ||
    video.transcription_status === 'pending';

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        {canRetry ? (
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={onRetry} disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />}
            Retry
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            onClick={() => onPatch({ is_active: !video.is_active })}
            disabled={pending}
          >
            {video.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
            {video.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="More actions" disabled={pending}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {canRetry && (
              <DropdownMenuItem onClick={() => onPatch({ is_active: !video.is_active })}>
                {video.is_active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                {video.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onPatch({ is_curated: !video.is_curated })}>
              {video.is_curated ? 'Remove curated' : 'Mark curated'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEditTags}>
              <Hash className="size-4" />
              Edit public tags
            </DropdownMenuItem>
            {!canRetry && video.transcription_status === 'ready' && (
              <DropdownMenuItem onClick={onRetry}>
                <WandSparkles className="size-4" />
                Re-transcribe
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onRecalculate}>
              <Gauge className="size-4" />
              Recalculate difficulty
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              Delete video
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete video?</AlertDialogTitle>
            <AlertDialogDescription>
              This force deletes the video and related practice attempts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete();
                setDeleteOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InlineLevelSelect({
  video,
  onLevelChange,
}: {
  video: AdminVideoResponse;
  onLevelChange: (level: string | null) => void;
}) {
  const options = useMemo(() => {
    const langLevels = getLevelOptions(video.language).map((o) => ({
      value: o.value,
      label: o.label,
    }));
    if (
      video.level &&
      !isLevelValidForLanguage(video.language, video.level)
    ) {
      langLevels.push({
        value: video.level,
        label: getLevelLabel(video.language, video.level),
      });
    }
    return [{ value: '__none__', label: '—' }, ...langLevels];
  }, [video.language, video.level]);

  return (
    <AppSelect
      value={video.level ?? '__none__'}
      onValueChange={(val) => onLevelChange(val === '__none__' ? null : val)}
      options={options}
      size="sm"
      triggerClassName="h-8 px-2 text-xs w-auto min-w-[72px]"
    />
  );
}

function VideoTopicTagsDialog({
  video,
  open,
  onOpenChange,
}: {
  video: AdminVideoResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: allTags = [] } = useAdminTopicTags(true);
  const activeTags = useMemo(() => allTags.filter((t) => t.is_active), [allTags]);
  const setTags = useSetVideoTopicTags();
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);

  if (open && video && videoId !== video.id) {
    setVideoId(video.id);
    setTagIds((video.topic_tags ?? []).map((t) => t.id));
    setError('');
  }
  if (!open && videoId !== null) setVideoId(null);

  if (!video) return null;

  const handleSubmit = () => {
    if (setTags.isPending) return;
    setTags.mutate(
      { videoId: video.id, data: { topic_tag_ids: tagIds } },
      {
        onSuccess: () => {
          toast.success('Public topic tags updated');
          onOpenChange(false);
        },
        onError: (err) => setError(extractApiError(err, 'Failed to update tags')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Public topic tags</DialogTitle>
          <DialogDescription className="line-clamp-2">{video.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {video.topic_tags && video.topic_tags.length > 0 && (
            <div className="space-y-1.5">
              <Label>Current</Label>
              <TopicTagChips publicTags={video.topic_tags} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="video-tags">Replace with</Label>
            <TagMultiSelect
              id="video-tags"
              options={activeTags}
              value={tagIds}
              onChange={setTagIds}
              placeholder="Select active topic tags"
              emptyText="No active topic tags"
            />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={setTags.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={setTags.isPending}>
            {setTags.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save tags'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminVideosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('q') ?? '';
  const filters: AdminVideoFilters = {
    search: urlSearch,
    status: searchParams.get('status') ?? '',
    language: searchParams.get('language') ?? '',
    level: searchParams.get('level') ?? '',
    curated: searchParams.get('curated') ?? '',
  };
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const pageSize = 20;

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (searchInput === urlSearch) return;
    const timer = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (searchInput.trim()) next.set('q', searchInput.trim());
        else next.delete('q');
        next.delete('page');
        return next;
      }, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, setSearchParams, urlSearch]);

  const params = useMemo(
    () => ({
      search: filters.search,
      status: filters.status,
      language: filters.language,
      level: filters.level,
      curated: parseBool(filters.curated),
      page,
      page_size: pageSize,
    }),
    [filters.curated, filters.language, filters.level, filters.search, filters.status, page],
  );

  const levelFilterOptions = useMemo(
    () => getLevelOptionsWithAll(filters.language),
    [filters.language],
  );

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.status ||
    filters.language ||
    filters.level ||
    filters.curated,
  );

  const updateFilter = (key: keyof AdminVideoFilters, value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const paramKey = key === 'search' ? 'q' : key;
      if (value) next.set(paramKey, value);
      else next.delete(paramKey);
      next.delete('page');
      return next;
    });
  };

  const handleLanguageChange = (language: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (language) next.set('language', language);
      else next.delete('language');
      if (!isLevelValidForLanguage(language, filters.level)) next.delete('level');
      next.delete('page');
      return next;
    });
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const setPage = (nextPage: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage > 1) next.set('page', String(nextPage));
      else next.delete('page');
      return next;
    });
  };

  const { data, isLoading, isFetching, refetch } = useAdminVideos(params);
  const patchVideo = usePatchAdminVideo();
  const deleteVideo = useDeleteAdminVideo();
  const retryTranscription = useRetryAdminTranscription();
  const recalculateDifficulty = useRecalculateAdminDifficulty();

  const [tagsTarget, setTagsTarget] = useState<AdminVideoResponse | null>(null);

  return (
    <AdminPageShell
      title="Videos"
      description="Manage catalog visibility, transcription health, levels, and public tags."
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh
        </Button>
      }
      toolbar={
        <div className="grid gap-2 xl:grid-cols-[minmax(240px,1fr)_145px_145px_minmax(220px,auto)]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-9 pl-9"
              placeholder="Search title, channel, YouTube ID"
            />
          </label>
          <AppSelect
            value={filters.status}
            onValueChange={(val) => updateFilter('status', val)}
            options={STATUS_OPTIONS}
            size="sm"
          />
          <AppSelect
            value={filters.language}
            onValueChange={handleLanguageChange}
            options={LANGUAGE_FILTER_OPTIONS}
            size="sm"
          />
          <div className="flex gap-2">
            <AppSelect
              value={filters.level}
              onValueChange={(val) => updateFilter('level', val)}
              options={levelFilterOptions}
              disabled={!filters.language}
              size="sm"
              triggerClassName="min-w-28"
            />
            <AppSelect
              value={filters.curated}
              onValueChange={(val) => updateFilter('curated', val)}
              options={CURATED_OPTIONS}
              size="sm"
              triggerClassName="min-w-32"
            />
            <Button variant="outline" size="sm" className="h-9 whitespace-nowrap" onClick={clearFilters} disabled={!hasActiveFilters}>
              Clear
            </Button>
          </div>
        </div>
      }
    >

      <Card className="flex min-h-[560px] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Video className="size-4 text-primary" />
            {data?.total ?? 0} video{data?.total === 1 ? '' : 's'}
          </div>
          {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {isLoading ? (
          <AdminLoadingSkeleton rows={8} />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-auto scrollbar-stable">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-xs uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Video</th>
                    <th className="px-3 py-2.5 font-bold">Status</th>
                    <th className="px-3 py-2.5 font-bold">Level</th>
                    <th className="hidden px-3 py-2.5 font-bold lg:table-cell">Duration</th>
                    <th className="hidden px-3 py-2.5 font-bold xl:table-cell">Plays</th>
                    <th className="admin-actions-col px-4 py-2.5 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.items ?? []).map((video) => (
                    <tr key={video.id} className="h-12 align-middle">
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt=""
                              className="h-10 w-16 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Video className="size-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="max-w-[300px] truncate font-bold">{video.title}</p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="truncate">{video.channel || 'Unknown channel'}</span>
                              {video.language && (
                                <>
                                  <span>·</span>
                                  <span className="font-bold" title={video.language}>
                                    {getLanguageLabel(video.language)}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {video.created_by_name || video.created_by_email || 'No owner'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge video={video} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1.5">
                          <DifficultyBadge video={video} />
                          <InlineLevelSelect
                            video={video}
                            onLevelChange={(level) =>
                              patchVideo.mutate({
                                videoId: video.id,
                                data: { level },
                              })
                            }
                          />
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 font-semibold tabular-nums lg:table-cell">
                        {formatDuration(video.duration)}
                      </td>
                      <td className="hidden px-3 py-2.5 font-semibold tabular-nums xl:table-cell">
                        {video.play_count}
                      </td>
                      <td className="admin-actions-col px-4 py-2.5">
                        <VideoActions
                          video={video}
                          pending={
                            (patchVideo.isPending && patchVideo.variables?.videoId === video.id) ||
                            (retryTranscription.isPending && retryTranscription.variables === video.id) ||
                            (recalculateDifficulty.isPending && recalculateDifficulty.variables === video.id) ||
                            (deleteVideo.isPending && deleteVideo.variables === video.id)
                          }
                          onPatch={(patch) =>
                            patchVideo.mutate(
                              { videoId: video.id, data: patch },
                              {
                                onSuccess: () => toast.success('Video updated'),
                                onError: (error) => toast.error(extractApiError(error, 'Could not update video')),
                              },
                            )
                          }
                          onRetry={() => retryTranscription.mutate(video.id, {
                            onSuccess: () => toast.success('Transcription queued'),
                            onError: (error) => toast.error(extractApiError(error, 'Could not queue transcription')),
                          })}
                          onRecalculate={() => recalculateDifficulty.mutate(video.id, {
                            onSuccess: () => toast.success('Difficulty recalculated'),
                            onError: (error) => toast.error(extractApiError(error, 'Could not recalculate difficulty')),
                          })}
                          onDelete={() => deleteVideo.mutate(video.id, {
                            onSuccess: () => toast.success('Video deleted'),
                            onError: (error) => toast.error(extractApiError(error, 'Could not delete video')),
                          })}
                          onEditTags={() => setTagsTarget(video)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data?.items.length === 0 && (
              <AdminEmptyState
                compact
                title="No matching videos"
                description={buildEmptyStateText(filters)}
                icon={Video}
                action={hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined}
              />
            )}
            <AdminPagination
              page={page}
              totalPages={data?.total_pages ?? 1}
              total={data?.total ?? 0}
              pageSize={pageSize}
              isFetching={isFetching}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <VideoTopicTagsDialog
        video={tagsTarget}
        open={Boolean(tagsTarget)}
        onOpenChange={(open) => !open && setTagsTarget(null)}
      />
    </AdminPageShell>
  );
}
