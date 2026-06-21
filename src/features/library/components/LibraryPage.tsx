import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryFiltersStore } from '../hooks/useLibraryFiltersStore';
import { useVideos, useDeleteVideo } from '../hooks/useVideos';
import { useActiveTopicTags } from '../hooks/useTopicTags';
import { SubtitleEditorDialog } from './SubtitleEditorDialog';
import { ImportVideoDialog } from '@/features/my-practice/components/ImportVideoDialog';
import { TopicTagChips } from '@/components/ui/topic-tag-chips';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import {
  Search, Plus, Clock, BarChart2, Globe, Play, BookmarkCheck,
  Loader2, AlertCircle, Trash2, Pencil, Puzzle, Check,
  PlayCircle, AlertTriangle,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { AppSelect } from '@/components/ui/app-select';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import type { VideoResponse, ClozeDifficulty } from '@/shared/types/api';
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

type ModeOption = { value: string; title: string; tagline: string; icon: React.ReactNode };
const MODES: ModeOption[] = [
  {
    value: 'sentence',
    title: 'Sentence dictation',
    tagline: 'Type each sentence verbatim.',
    icon: <Pencil className="h-4 w-4" />,
  },
  {
    value: 'cloze',
    title: 'Paragraph cloze',
    tagline: 'Fill in the blanks within a paragraph.',
    icon: <Puzzle className="h-4 w-4" />,
  },
];

const DIFFICULTIES: { value: ClozeDifficulty; label: string; blanks: string; color: { border: string; borderSelected: string; bg: string; icon: string; check: string } }[] = [
  {
    value: 'easy', label: 'Easy', blanks: '~10%',
    color: { border: 'hover:border-primary/50', borderSelected: 'border-primary', bg: 'bg-primary-soft', icon: 'text-primary', check: 'bg-primary text-white' },
  },
  {
    value: 'medium', label: 'Medium', blanks: '~25%',
    color: { border: 'hover:border-accent-yellow/50', borderSelected: 'border-accent-yellow', bg: 'bg-accent-yellow/10', icon: 'text-accent-yellow', check: 'bg-accent-yellow text-foreground' },
  },
  {
    value: 'hard', label: 'Hard', blanks: '~40%',
    color: { border: 'hover:border-destructive/50', borderSelected: 'border-destructive', bg: 'bg-destructive/10', icon: 'text-destructive', check: 'bg-destructive text-white' },
  },
];

function ModeSelectDialog({
  video,
  open,
  onOpenChange,
}: {
  video: VideoResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<string>(video.is_auto_generated ? 'cloze' : 'sentence');
  const [difficulty, setDifficulty] = useState<ClozeDifficulty>('medium');

  const handleStart = () => {
    const params = new URLSearchParams({ mode });
    if (mode === 'cloze') params.set('difficulty', difficulty);
    navigate(`/dictation/${video.id}?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose practice mode</DialogTitle>
          <DialogDescription className="line-clamp-1">{video.title}</DialogDescription>
        </DialogHeader>

        {video.is_auto_generated && (
          <div className="flex items-start gap-2.5 rounded-xl border border-accent-orange/25 bg-accent-orange/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-accent-orange shrink-0 mt-0.5" />
            <p className="text-foreground">
              Auto-generated subtitles — <span className="font-semibold">Paragraph cloze</span> recommended.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {MODES.map((m) => {
            const selected = mode === m.value;
            const recommended = video.is_auto_generated && m.value === 'cloze';
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={cn(
                  'flex items-center gap-3 text-left p-3 rounded-lg border transition-all',
                  selected
                    ? 'border-foreground bg-foreground/5'
                    : 'border-border hover:border-foreground/30',
                )}
              >
                <span className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                  selected ? 'bg-foreground text-background' : 'bg-muted text-foreground',
                )}>
                  {m.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{m.title}</span>
                    {recommended && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-lg bg-accent-orange/10 text-accent-orange border border-accent-orange/20">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.tagline}</p>
                </div>
                <span className={cn(
                  'h-5 w-5 rounded-full flex items-center justify-center shrink-0',
                  selected ? 'bg-foreground text-background' : 'border border-border',
                )}>
                  {selected && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>

        {mode === 'cloze' && (
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => {
              const selected = difficulty === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={cn(
                    'flex-1 text-center p-2.5 rounded-lg border transition-all',
                    selected ? `${d.color.borderSelected} ${d.color.bg}` : `border-border ${d.color.border}`,
                  )}
                >
                  <span className={cn('text-sm font-semibold', selected ? d.color.icon : 'text-foreground')}>{d.label}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{d.blanks}</p>
                </button>
              );
            })}
          </div>
        )}

        <Button onClick={handleStart} className="w-full gap-2 mt-1">
          <PlayCircle className="h-4 w-4" />
          Start practising
        </Button>
      </DialogContent>
    </Dialog>
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

  const levelOptions = getSharedLevelOptions(selectedLang);
  const effectiveSelectedLevel =
    selectedLevel !== 'All' && isLevelValidForLanguage(selectedLang, selectedLevel)
      ? selectedLevel
      : 'All';

  const [importOpen, setImportOpen] = useState(false);

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
              <Button size="sm" onClick={() => setImportOpen(true)}>
                <Plus className="h-4 w-4" />
                Import video
              </Button>
            </div>
          )}
          toolbar={(
            <div className="flex flex-col gap-3">
              {/* Search + filters */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:flex-wrap">
                <AppInput
                  icon={<Search className="h-4 w-4" />}
                  type="text"
                  placeholder="Search videos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  wrapperClassName="col-span-2 w-full sm:flex-1 sm:min-w-48 sm:max-w-xs"
                />

                <AppSelect
                  value={selectedLang}
                  onValueChange={(val) => {
                    setSelectedLang(val);
                    setSelectedLevel(
                      selectedLevel !== 'All' && isLevelValidForLanguage(val, selectedLevel)
                        ? selectedLevel
                        : 'All',
                    );
                  }}
                  options={LIBRARY_LANGUAGE_OPTIONS}
                  triggerClassName="w-full sm:w-auto sm:min-w-36"
                />

                <TagMultiSelect
                  options={topicOptions}
                  value={selectedTopics}
                  onChange={setSelectedTopics}
                  placeholder="All topics"
                  emptyText="No topic tags"
                  allowSelectAll
                  className="w-full sm:w-auto sm:min-w-36 sm:max-w-72"
                />

                <div className="col-span-2 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  {[{ value: 'All', label: 'All' }, ...levelOptions].map((level) => (
                    <FilterChip
                      key={level.value}
                      selected={effectiveSelectedLevel === level.value}
                      onClick={() => setSelectedLevel(level.value)}
                      className="shrink-0"
                    >
                      {level.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
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
    </PageContainer>
  );
}
