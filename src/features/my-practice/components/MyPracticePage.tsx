import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Clock,
  Globe,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  MessageSquareWarning,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppInput } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import {
  CountBadge,
  PageContainer,
  PageHeader,
  PageScrollArea,
  PageStickyArea,
  RefreshButton,
} from '@/components/layout/PageShell';
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
import { TopicTagChips } from '@/components/ui/topic-tag-chips';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ErrorState } from '@/components/patterns/ErrorState';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/shared/lib/httpClient';
import { toast } from 'sonner';
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_LABEL_MAP,
  getLevelOptionsWithAll,
  isLevelValidForLanguage,
} from '@/shared/lib/languageLevels';
import type {
  MyPracticeListParams,
  PublishStatus,
  TranscriptionStatus,
  VideoResponse,
} from '@/shared/types/api';
import { useActiveTopicTags } from '@/features/library/hooks/useTopicTags';
import { useMyPractice, useRemoveFromMyPractice } from '../hooks/useMyPractice';
import {
  PUBLISH_STATUS_META,
  PUBLISH_STATUS_OPTIONS,
  TRANSCRIPTION_STATUS_META,
  TRANSCRIPTION_STATUS_OPTIONS,
  canRequestPublish,
} from '../lib/status';
import { ImportVideoDialog } from './ImportVideoDialog';
import { PublishRequestDialog } from './PublishRequestDialog';
import { TranscriptFeedbackDialog } from './TranscriptFeedbackDialog';

const PAGE_SIZE = 12;

const LANGUAGE_FILTER_OPTIONS = [{ value: '', label: 'All languages' }, ...LANGUAGE_OPTIONS];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusBadge({ status }: { status: PublishStatus | undefined }) {
  const meta = PUBLISH_STATUS_META[status ?? 'private'];
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-bold shadow-sm',
        // Near-opaque surface so the label stays readable over the thumbnail.
        meta.className,
        'bg-card/95 backdrop-blur-sm',
      )}
    >
      {meta.label}
    </span>
  );
}

function TranscriptionBadge({ status }: { status: TranscriptionStatus }) {
  const meta = TRANSCRIPTION_STATUS_META[status] ?? TRANSCRIPTION_STATUS_META.pending;
  return (
    <span className={cn('inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold', meta.className)}>
      {meta.label}
    </span>
  );
}

function MyPracticeCard({
  video,
  onPractice,
  onRemove,
  onRequestPublish,
  onReport,
  onTagFilter,
}: {
  video: VideoResponse;
  onPractice: (video: VideoResponse) => void;
  onRemove: (video: VideoResponse) => void;
  onRequestPublish: (video: VideoResponse) => void;
  onReport: (video: VideoResponse) => void;
  onTagFilter: (slug: string) => void;
}) {
  const importedOn = formatDate(video.my_practice_created_at);
  const eligibleToPublish = canRequestPublish(video.publish_status);
  const isRejected = video.publish_status === 'rejected';

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-soft-lg">
      <div className="relative aspect-video shrink-0 overflow-hidden bg-muted">
        <img
          src={video.thumbnail_url}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/320x180/1a1a2e/white?text=${encodeURIComponent(video.channel)}`;
          }}
        />
        <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 font-mono text-xs text-white">
          {formatDuration(video.duration)}
        </div>
        <div className="absolute left-3 top-3">
          <StatusBadge status={video.publish_status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 line-clamp-2 text-base font-bold leading-snug">{video.title}</h3>
        <p className="mb-2 truncate text-sm text-muted-foreground">{video.channel}</p>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Globe className="size-3" />
            {LANGUAGE_LABEL_MAP[video.language] ?? video.language}
          </span>
          {video.level && <span className="font-semibold text-foreground">{video.level}</span>}
          <TranscriptionBadge status={video.transcription_status} />
        </div>

        {(video.topic_tags?.length || video.my_topic_tags?.length) ? (
          <div className="mb-2">
            <TopicTagChips
              publicTags={video.topic_tags}
              personalTags={video.my_topic_tags}
              showGroupLabels
              onTagClick={(tag) => onTagFilter(tag.slug)}
            />
          </div>
        ) : null}

        {isRejected && video.review_note && (
          <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <span className="font-semibold">Review note: </span>
            {video.review_note}
          </div>
        )}

        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          {importedOn ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              Added {importedOn}
            </span>
          ) : (
            <span />
          )}
          {video.best_score != null && (
            <span className="font-semibold text-accent-orange">🏆 {Math.round(video.best_score)}%</span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-3">
          <Button
            size="sm"
            className="flex-1"
            disabled={video.transcription_status !== 'ready'}
            onClick={() => onPractice(video)}
          >
            <Play className="size-3.5" />
            Practice
          </Button>

          {eligibleToPublish && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRequestPublish(video)}
              title="Request publication"
            >
              <Send className="size-3.5" />
              Publish
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-9 p-0" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => onReport(video)}>
                <MessageSquareWarning className="size-4" />
                Report transcript issue
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onRemove(video)}>
                <Trash2 className="size-4" />
                Remove from My Practice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export function MyPracticePage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [publishStatus, setPublishStatus] = useState<'' | PublishStatus>('');
  const [language, setLanguage] = useState('');
  const [level, setLevel] = useState('');
  const [transcriptionStatus, setTranscriptionStatus] = useState<'' | TranscriptionStatus>('');
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const [importOpen, setImportOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<VideoResponse | null>(null);
  const [publishTarget, setPublishTarget] = useState<VideoResponse | null>(null);
  const [reportTarget, setReportTarget] = useState<VideoResponse | null>(null);

  const { data: tags = [] } = useActiveTopicTags();
  const removeMutation = useRemoveFromMyPractice();

  // TagMultiSelect reports the option `id`; we use slugs as ids since the API
  // filters by topic-tag slug.
  const topicOptions = useMemo(
    () => tags.map((t) => ({ id: t.slug, name: t.name })),
    [tags],
  );

  const levelOptions = useMemo(() => getLevelOptionsWithAll(language), [language]);

  const resetPage = () => setPage(1);

  const setTopics = (next: string[]) => {
    setTopicTags(next);
    resetPage();
  };

  const addTopic = (slug: string) => {
    setTopicTags((cur) => (cur.includes(slug) ? cur : [...cur, slug]));
    resetPage();
  };

  const params: MyPracticeListParams = useMemo(
    () => ({
      publish_status: publishStatus || undefined,
      language: language || undefined,
      level: level || undefined,
      transcription_status: transcriptionStatus || undefined,
      topic_tag: topicTags.length ? topicTags : undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [publishStatus, language, level, transcriptionStatus, topicTags, page],
  );

  const { data, isLoading, isError, isFetching, refetch } = useMyPractice(params);

  const items = useMemo(() => data?.items ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (v) => v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q),
    );
  }, [items, search]);

  const totalPages = data?.total_pages ?? 1;

  const handlePractice = (video: VideoResponse) => {
    const mode = video.is_auto_generated ? 'cloze' : 'sentence';
    navigate(`/dictation/${video.id}?mode=${mode}`);
  };

  const handleConfirmRemove = () => {
    if (!removeTarget) return;
    const target = removeTarget;
    removeMutation.mutate(target.id, {
      onSuccess: () => {
        toast.success('Removed from My Practice', {
          description: 'The shared video, transcript and any feedback were kept.',
        });
        setRemoveTarget(null);
      },
      onError: (err) => {
        toast.error(extractApiError(err, 'Failed to remove video'));
        setRemoveTarget(null);
      },
    });
  };

  return (
    <PageContainer>
      <PageStickyArea>
        <PageHeader
          title="My Practice"
          meta={
            <CountBadge icon={<BarChart2 className="h-4 w-4" />}>
              {data?.total ?? 0} videos
            </CountBadge>
          }
          actions={
            <div className="flex items-center gap-2">
              <RefreshButton onClick={() => refetch()} disabled={isFetching} />
              <Button size="sm" onClick={() => setImportOpen(true)}>
                <Plus className="size-4" />
                Import video
              </Button>
            </div>
          }
          toolbar={
            <div className="flex flex-col gap-2">
              <AppInput
                icon={<Search className="h-4 w-4" />}
                placeholder="Search my practice…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                wrapperClassName="w-full sm:max-w-xs"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <AppSelect
                  value={publishStatus}
                  onValueChange={(v) => {
                    setPublishStatus(v as '' | PublishStatus);
                    resetPage();
                  }}
                  options={PUBLISH_STATUS_OPTIONS}
                  triggerClassName="w-full sm:w-auto sm:min-w-40"
                />
                <AppSelect
                  value={language}
                  onValueChange={(v) => {
                    setLanguage(v);
                    setLevel((cur) => (isLevelValidForLanguage(v, cur) ? cur : ''));
                    resetPage();
                  }}
                  options={LANGUAGE_FILTER_OPTIONS}
                  triggerClassName="w-full sm:w-auto sm:min-w-36"
                />
                <AppSelect
                  value={level}
                  onValueChange={(v) => {
                    setLevel(v);
                    resetPage();
                  }}
                  options={levelOptions}
                  disabled={!language}
                  triggerClassName="w-full sm:w-auto sm:min-w-28"
                />
                <AppSelect
                  value={transcriptionStatus}
                  onValueChange={(v) => {
                    setTranscriptionStatus(v as '' | TranscriptionStatus);
                    resetPage();
                  }}
                  options={TRANSCRIPTION_STATUS_OPTIONS}
                  triggerClassName="w-full sm:w-auto sm:min-w-36"
                />
                <TagMultiSelect
                  options={topicOptions}
                  value={topicTags}
                  onChange={setTopics}
                  placeholder="All topics"
                  emptyText="No topic tags"
                  allowSelectAll
                  className="col-span-2 w-full sm:col-span-1 sm:w-auto sm:min-w-36 sm:max-w-72"
                />
              </div>
            </div>
          }
        />
      </PageStickyArea>

      <PageScrollArea>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading your practice videos…</span>
          </div>
        ) : isError ? (
          <ErrorState message="Failed to load My Practice" onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-4 w-4 text-muted-foreground" />}
            title="No videos in My Practice"
            description={
              items.length === 0
                ? 'Import a YouTube video to start practising.'
                : 'Try adjusting your search or filters.'
            }
            action={
              items.length === 0
                ? { label: 'Import video', onClick: () => setImportOpen(true), icon: <Plus className="size-4" /> }
                : undefined
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((video) => (
                <MyPracticeCard
                  key={video.id}
                  video={video}
                  onPractice={handlePractice}
                  onRemove={setRemoveTarget}
                  onRequestPublish={setPublishTarget}
                  onReport={setReportTarget}
                  onTagFilter={addTopic}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs font-bold text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </PageScrollArea>

      <ImportVideoDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => refetch()} />

      {publishTarget && (
        <PublishRequestDialog
          videoId={publishTarget.id}
          videoTitle={publishTarget.title}
          reviewNote={publishTarget.publish_status === 'rejected' ? publishTarget.review_note : null}
          open={Boolean(publishTarget)}
          onOpenChange={(open) => !open && setPublishTarget(null)}
        />
      )}

      {reportTarget && (
        <TranscriptFeedbackDialog
          videoId={reportTarget.id}
          open={Boolean(reportTarget)}
          onOpenChange={(open) => !open && setReportTarget(null)}
        />
      )}

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from My Practice?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes only your My Practice entry for “{removeTarget?.title}”. The shared video,
              its transcript, the public catalog entry, and any transcript feedback are kept. Any
              pending publish request you made will be resolved automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRemove();
              }}
            >
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
