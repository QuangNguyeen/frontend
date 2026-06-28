import { useMemo, useState } from 'react';
import { useLibraryFiltersStore } from '../hooks/useLibraryFiltersStore';
import { useVideos, useDeleteVideo } from '../hooks/useVideos';
import { useActiveTopicTags } from '../hooks/useTopicTags';
import { SubtitleEditorDialog } from './SubtitleEditorDialog';
import { ModeSelectDialog } from '@/features/dictation/components/ModeSelectDialog';
import { ImportVideoDialog } from '@/features/my-practice/components/ImportVideoDialog';
import { TopicTagChips } from '@/components/ui/topic-tag-chips';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import {
  Search, Plus, Clock, BarChart2, Globe, Play, BookmarkCheck,
  Loader2, AlertCircle, Trash2, Pencil, SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppInput } from '@/components/ui/app-input';
import { FilterChip } from '@/components/ui/filter-chip';
import { CountBadge, PageContainer, PageStickyArea, PageScrollArea, PageHeader, RefreshButton } from '@/components/layout/PageShell';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { AppSelect } from '@/components/ui/app-select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import type { VideoResponse } from '@/shared/types/api';
import {
  LANGUAGE_OPTIONS as SHARED_LANGUAGE_OPTIONS,
  LANGUAGE_LABEL_MAP,
  getLevelOptions as getSharedLevelOptions,
  isLevelValidForLanguage,
} from '@/shared/lib/languageLevels';

const LIBRARY_LANGUAGE_OPTIONS = [
  { value: 'All', label: 'All languages' },
  ...SHARED_LANGUAGE_OPTIONS,
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const clean = level.replace('~', '');
  const colors: Record<string, string> = {
    A1: 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]',
    A2: 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]',
    B1: 'bg-[color:var(--badge-info)]/15 text-[color:var(--badge-info)]',
    B2: 'bg-[color:var(--badge-info)]/15 text-[color:var(--badge-info)]',
    C1: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    C2: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    Beginner: 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]',
    Intermediate: 'bg-[color:var(--badge-info)]/15 text-[color:var(--badge-info)]',
    Advanced: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  };
  return (
    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-lg', colors[clean] ?? 'bg-muted text-muted-foreground')}>
      {clean}
    </span>
  );
}


function VideoCard({ video, onDelete, isAdmin, onTagFilter }: { video: VideoResponse; onDelete: (id: string) => void; isAdmin: boolean; onTagFilter: (slug: string) => void }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-soft-lg">
      <div className="relative aspect-video shrink-0 bg-muted overflow-hidden">
        <img
          src={video.thumbnail_url}
          alt={video.title}
          loading="lazy"
          width={320}
          height={180}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://placehold.co/320x180/1a1a2e/white?text=${encodeURIComponent(video.channel)}`;
          }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/95 rounded-xl p-3 shadow-lg">
            <Play className="h-5 w-5 text-primary fill-current" />
          </div>
        </div>
        <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-lg font-mono">
          {formatDuration(video.duration)}
        </div>
        {video.is_curated && (
          <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
            <BookmarkCheck className="h-3 w-3" />
            Curated
          </div>
        )}
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 hover:bg-destructive text-white rounded-full p-1.5"
                aria-label="Delete shared video"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this shared video?</AlertDialogTitle>
                <AlertDialogDescription>
                  This is an admin-level action. It removes the shared video
                  &ldquo;{video.title}&rdquo; and its transcript from the catalog for
                  everyone. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(video.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-base leading-snug mb-1 line-clamp-2">{video.title}</h3>
        <p className="text-sm text-muted-foreground mb-3 truncate">{video.channel}</p>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <LevelBadge level={video.level} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {LANGUAGE_LABEL_MAP[video.language] ?? video.language}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(video.duration)}
          </span>
        </div>
        {video.play_count > 0 && (
          <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span>🎧</span> {video.play_count}x played
            </span>
            {video.best_score != null && (
              <span className="flex items-center gap-1 text-accent-orange font-semibold">
                <span>🏆</span> Best: {Math.round(video.best_score)}%
              </span>
            )}
          </div>
        )}
        {video.play_count === 0 && <div className="mb-1" />}
        {video.topic_tags && video.topic_tags.length > 0 && (
          <div className="mb-3">
            <TopicTagChips
              publicTags={video.topic_tags}
              onTagClick={(tag) => onTagFilter(tag.slug)}
            />
          </div>
        )}
        <div className="mt-auto flex gap-2">
          <Button className="flex-1" size="sm" onClick={() => setModeDialogOpen(true)}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Practice
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditorOpen(true)}
              title="Edit subtitles (admin)"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </div>
      <SubtitleEditorDialog
        videoId={video.id}
        videoTitle={video.title}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
      <ModeSelectDialog
        video={video}
        open={modeDialogOpen}
        onOpenChange={setModeDialogOpen}
      />
    </div>
  );
}

export function LibraryPage() {
  // Persisted filter state (Zustand — survives navigation)
  const search           = useLibraryFiltersStore((s) => s.search);
  const selectedLang     = useLibraryFiltersStore((s) => s.selectedLang);
  const selectedLevel    = useLibraryFiltersStore((s) => s.selectedLevel);
  const selectedTopics   = useLibraryFiltersStore((s) => s.selectedTopics);
  const setSearch        = useLibraryFiltersStore((s) => s.setSearch);
  const setSelectedLang  = useLibraryFiltersStore((s) => s.setSelectedLang);
  const setSelectedLevel = useLibraryFiltersStore((s) => s.setSelectedLevel);
  const setSelectedTopics = useLibraryFiltersStore((s) => s.setSelectedTopics);
  const addSelectedTopic = useLibraryFiltersStore((s) => s.addSelectedTopic);

  const isAdmin = useAuthStore((s) => s.user?.is_admin ?? false);

  const effectiveSelectedLevel =
    selectedLevel !== 'All' && isLevelValidForLanguage(selectedLang, selectedLevel)
      ? selectedLevel
      : 'All';

  const [importOpen, setImportOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Draft filter state — edited inside the popup and only committed to the store
  // (which drives the query) when the user clicks "Done".
  const [draftLang, setDraftLang] = useState(selectedLang);
  const [draftLevel, setDraftLevel] = useState(selectedLevel);
  const [draftTopics, setDraftTopics] = useState(selectedTopics);

  const draftLevelOptions = getSharedLevelOptions(draftLang);
  const draftEffectiveLevel =
    draftLevel !== 'All' && isLevelValidForLanguage(draftLang, draftLevel)
      ? draftLevel
      : 'All';

  // Count of applied (non-default) filters — drives the badge on the Filter button.
  const activeFilterCount =
    (selectedLang !== 'All' ? 1 : 0) +
    (selectedTopics.length > 0 ? 1 : 0) +
    (effectiveSelectedLevel !== 'All' ? 1 : 0);

  // Count of draft filters — drives the Reset button's disabled state.
  const draftFilterCount =
    (draftLang !== 'All' ? 1 : 0) +
    (draftTopics.length > 0 ? 1 : 0) +
    (draftEffectiveLevel !== 'All' ? 1 : 0);

  // Seed the draft from the applied filters each time the popup opens; closing
  // without "Done" simply discards the draft (nothing is committed).
  const handleFilterOpenChange = (open: boolean) => {
    if (open) {
      setDraftLang(selectedLang);
      setDraftLevel(selectedLevel);
      setDraftTopics(selectedTopics);
    }
    setFilterOpen(open);
  };

  // Reset the draft back to defaults (applied on "Done"). Search is untouched.
  const resetDraft = () => {
    setDraftLang('All');
    setDraftLevel('All');
    setDraftTopics([]);
  };

  // Commit the draft to the persisted store, then close.
  const applyFilters = () => {
    setSelectedLang(draftLang);
    setSelectedLevel(draftLevel);
    setSelectedTopics(draftTopics);
    setFilterOpen(false);
  };

  const { data: tags = [] } = useActiveTopicTags();
  // TagMultiSelect reports the option `id`; we use slugs as ids since the catalog
  // filters by topic-tag slug.
  const topicOptions = useMemo(
    () => tags.map((t) => ({ id: t.slug, name: t.name })),
    [tags],
  );

  const { data: videos = [], isLoading, isError, refetch } = useVideos({
    language: selectedLang !== 'All' ? selectedLang : undefined,
    level: effectiveSelectedLevel !== 'All' ? effectiveSelectedLevel : undefined,
    topic_tag: selectedTopics.length ? selectedTopics : undefined,
  });

  const deleteMutation = useDeleteVideo();

  const filtered = videos.filter((v) => {
    const q = search.toLowerCase();
    return v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q);
  });

  return (
    <PageContainer>
      <PageStickyArea>
        <PageHeader
          title="Video Library"
          meta={(
            <CountBadge icon={<BarChart2 className="h-4 w-4" />}>
              {videos.length} videos
            </CountBadge>
          )}
          actions={(
            <div className="flex items-center gap-2">
              <RefreshButton onClick={() => refetch()} />
              <Button size="sm" onClick={() => setImportOpen(true)} className="min-w-30 gap-1 whitespace-nowrap px-2">
                <Plus className="h-4 w-4" />
                Import video
              </Button>
            </div>
          )}
          toolbar={(
            <div className="flex items-center gap-2">
              <AppInput
                icon={<Search className="h-4 w-4" />}
                type="text"
                placeholder="Search videos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                wrapperClassName="min-w-0 flex-1 sm:max-w-xs"
              />
              <Button
                variant="outline"
                onClick={() => setFilterOpen(true)}
                className={cn(
                  'h-11 min-w-20 shrink-0 justify-center gap-2 whitespace-nowrap px-5',
                  activeFilterCount > 0 && 'border-primary/50 bg-primary-soft text-foreground',
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          )}
        />
      </PageStickyArea>

      <PageScrollArea>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading videos...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-6 w-6 text-destructive mb-2" />
            <p className="font-medium text-sm mb-2">Failed to load videos</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mb-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">No videos found</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {videos.length === 0
                ? 'Add your first video by pasting a YouTube URL above'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                isAdmin={isAdmin}
                onDelete={(id) => deleteMutation.mutate(id)}
                onTagFilter={addSelectedTopic}
              />
            ))}
          </div>
        )}
      </PageScrollArea>

      <ImportVideoDialog open={importOpen} onOpenChange={setImportOpen} />

      <Dialog open={filterOpen} onOpenChange={handleFilterOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>
              Refine the video list by language, topic, and level. Changes apply when you click Done.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Language</label>
              <AppSelect
                value={draftLang}
                onValueChange={(val) => {
                  setDraftLang(val);
                  setDraftLevel(
                    draftLevel !== 'All' && isLevelValidForLanguage(val, draftLevel)
                      ? draftLevel
                      : 'All',
                  );
                }}
                options={LIBRARY_LANGUAGE_OPTIONS}
                triggerClassName="w-full"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Topic</label>
              <TagMultiSelect
                options={topicOptions}
                value={draftTopics}
                onChange={setDraftTopics}
                placeholder="All topics"
                emptyText="No topic tags"
                allowSelectAll
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold">Level</label>
              <div className="flex flex-wrap gap-1.5">
                {[{ value: 'All', label: 'All' }, ...draftLevelOptions].map((level) => (
                  <FilterChip
                    key={level.value}
                    selected={draftEffectiveLevel === level.value}
                    onClick={() => setDraftLevel(level.value)}
                  >
                    {level.label}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={resetDraft}
              disabled={draftFilterCount === 0}
            >
              Reset filters
            </Button>
            <Button onClick={applyFilters}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
