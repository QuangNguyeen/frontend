import { useMemo, useState } from 'react';
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
} from 'lucide-react';
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
  useAdminVideos,
  useDeleteAdminVideo,
  usePatchAdminVideo,
  useRecalculateAdminDifficulty,
  useRetryAdminTranscription,
} from '../../hooks/useAdmin';
import { AdminPageShell } from '../AdminPageShell';
import { AdminPagination } from '../AdminPagination';

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
        {video.transcription_status}
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
}: {
  video: AdminVideoResponse;
  onPatch: (data: { is_active?: boolean; is_curated?: boolean }) => void;
  onRetry: () => void;
  onRecalculate: () => void;
  onDelete: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canRetry =
    video.transcription_status === 'failed' ||
    video.transcription_status === 'pending';

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        {canRetry ? (
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={onRetry}>
            <WandSparkles className="size-3.5" />
            Retry
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            onClick={() => onPatch({ is_active: !video.is_active })}
          >
            {video.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
            {video.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
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

export function AdminVideosPage() {
  const [filters, setFilters] = useState<AdminVideoFilters>({
    search: '',
    status: '',
    language: '',
    level: '',
    curated: '',
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;

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
    [filters, page],
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
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleLanguageChange = (language: string) => {
    setFilters((current) => ({
      ...current,
      language,
      level: isLevelValidForLanguage(language, current.level) ? current.level : '',
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      language: '',
      level: '',
      curated: '',
    });
    setPage(1);
  };

  const { data, isLoading, isFetching, refetch } = useAdminVideos(params);
  const patchVideo = usePatchAdminVideo();
  const deleteVideo = useDeleteAdminVideo();
  const retryTranscription = useRetryAdminTranscription();
  const recalculateDifficulty = useRecalculateAdminDifficulty();

  return (
    <AdminPageShell
      title="Videos"
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh
        </Button>
      }
      toolbar={
        <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_145px_145px_145px_130px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
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
          <AppSelect
            value={filters.level}
            onValueChange={(val) => updateFilter('level', val)}
            options={levelFilterOptions}
            disabled={!filters.language}
            size="sm"
          />
          <AppSelect
            value={filters.curated}
            onValueChange={(val) => updateFilter('curated', val)}
            options={CURATED_OPTIONS}
            size="sm"
          />
          <Button variant="outline" size="sm" className="h-9 whitespace-nowrap" onClick={clearFilters} disabled={!hasActiveFilters}>
            Clear filters
          </Button>
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
          <div className="flex min-h-[260px] items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
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
                    <tr key={video.id} className="align-middle">
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
                          onPatch={(data) =>
                            patchVideo.mutate({ videoId: video.id, data })
                          }
                          onRetry={() => retryTranscription.mutate(video.id)}
                          onRecalculate={() => recalculateDifficulty.mutate(video.id)}
                          onDelete={() => deleteVideo.mutate(video.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data?.items.length === 0 && (
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
                <span>{buildEmptyStateText(filters)}</span>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
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
    </AdminPageShell>
  );
}
