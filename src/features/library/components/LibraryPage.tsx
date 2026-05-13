import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryFiltersStore } from '../hooks/useLibraryFiltersStore';
import { useVideos, useImportVideo, useDeleteVideo } from '../hooks/useVideos';
import { SubtitleEditorDialog } from './SubtitleEditorDialog';
import {
  Search, Plus, Clock, BarChart2, Globe, Play, BookmarkCheck,
  Loader2, AlertCircle, RefreshCw, Trash2, Pencil, Puzzle, Check,
  PlayCircle, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { extractApiError } from '@/shared/lib/httpClient';
import { cn } from '@/lib/utils';
import type { VideoResponse, PracticeMode, ClozeDifficulty } from '@/shared/types/api';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const LANGUAGE_OPTIONS = [
  { value: 'All', label: 'Languages'},
  { value: 'en',  label: 'English'},
  { value: 'ja',  label: 'Japanese'},
] as const;
const LANGUAGE_MAP = Object.fromEntries(LANGUAGE_OPTIONS.map((o) => [o.value, o])) as Record<string, (typeof LANGUAGE_OPTIONS)[number]>;

function getLevelOptions(lang: string): string[] {
  if (lang === 'ja') return JLPT_LEVELS;
  return CEFR_LEVELS;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const clean = level.replace('~', '');
  const colors: Record<string, string> = {
    A1: 'bg-green-100 text-green-700',
    A2: 'bg-green-100 text-green-700',
    B1: 'bg-blue-100 text-blue-700',
    B2: 'bg-blue-100 text-blue-700',
    C1: 'bg-purple-100 text-purple-700',
    C2: 'bg-purple-100 text-purple-700',
    Beginner: 'bg-green-100 text-green-700',
    Intermediate: 'bg-blue-100 text-blue-700',
    Advanced: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', colors[clean] ?? 'bg-muted text-muted-foreground')}>
      {clean}
    </span>
  );
}

const MODES: { value: PracticeMode; title: string; tagline: string; icon: React.ReactNode }[] = [
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
    color: { border: 'hover:border-emerald-500/50', borderSelected: 'border-emerald-500', bg: 'bg-emerald-500/10', icon: 'text-emerald-500', check: 'bg-emerald-500 text-white' },
  },
  {
    value: 'medium', label: 'Medium', blanks: '~25%',
    color: { border: 'hover:border-amber-500/50', borderSelected: 'border-amber-500', bg: 'bg-amber-500/10', icon: 'text-amber-500', check: 'bg-amber-500 text-white' },
  },
  {
    value: 'hard', label: 'Hard', blanks: '~40%',
    color: { border: 'hover:border-rose-500/50', borderSelected: 'border-rose-500', bg: 'bg-rose-500/10', icon: 'text-rose-500', check: 'bg-rose-500 text-white' },
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
  const [mode, setMode] = useState<PracticeMode>(video.is_auto_generated ? 'cloze' : 'sentence');
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
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-amber-800 dark:text-amber-300">
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
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
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

function VideoCard({ video, onDelete }: { video: VideoResponse; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  const [editorOpen, setEditorOpen] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/20 flex flex-col">
      <div className="relative aspect-video bg-muted overflow-hidden">
        <img
          src={video.thumbnail_url}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://placehold.co/320x180/1a1a2e/white?text=${encodeURIComponent(video.channel)}`;
          }}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-full p-3 shadow-lg">
            <Play className="h-5 w-5 text-primary fill-current" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded font-mono">
          {formatDuration(video.duration)}
        </div>
        {video.is_curated && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <BookmarkCheck className="h-3 w-3" />
            Curated
          </div>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 hover:bg-destructive text-white rounded-full p-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this video?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently remove
                &ldquo;{video.title}&rdquo; from your library. Your past
                dictation history for this video will be kept safe.
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
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{video.title}</h3>
        <p className="text-xs text-muted-foreground mb-3">{video.channel}</p>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <LevelBadge level={video.level} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {LANGUAGE_MAP[video.language]?.label ?? video.language}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(video.duration)}
          </span>
        </div>
        {video.play_count > 0 && (
          <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span>🎧</span> {video.play_count}x played
            </span>
            {video.best_score != null && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <span>🏆</span> Best: {Math.round(video.best_score)}%
              </span>
            )}
          </div>
        )}
        {video.play_count === 0 && <div className="mb-4" />}
        <div className="mt-auto flex gap-2">
          <Button className="flex-1" size="sm" onClick={() => setModeDialogOpen(true)}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Start Dictation
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditorOpen(true)}
            title="Edit subtitles"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
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
  const setSearch        = useLibraryFiltersStore((s) => s.setSearch);
  const setSelectedLang  = useLibraryFiltersStore((s) => s.setSelectedLang);
  const setSelectedLevel = useLibraryFiltersStore((s) => s.setSelectedLevel);

  const levelOptions = getLevelOptions(selectedLang);

  // Ephemeral form state (local — cleared on unmount)
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [importError, setImportError] = useState('');

  const { data: videos = [], isLoading, isError, refetch } = useVideos({
    language: selectedLang !== 'All' ? selectedLang : undefined,
    level: selectedLevel !== 'All' ? selectedLevel : undefined,
  });

  const importMutation = useImportVideo();
  const deleteMutation = useDeleteVideo();

  const handleImport = (url: string) => {
    importMutation.mutate(
      { youtube_url: url },
      {
        onSuccess: () => { setYoutubeUrl(''); setImportError(''); },
        onError: (err) => setImportError(extractApiError(err, 'Failed to import video')),
      },
    );
  };

  const filtered = videos.filter((v) => {
    const q = search.toLowerCase();
    return v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-full">
      {/* Sticky header */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold">Video Library</h1>
              <p className="text-sm text-muted-foreground">
                Choose a video to practice listening and transcription
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4" />
                {videos.length} videos
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Import URL */}
          <div className="flex flex-col gap-2 mb-4 p-3 bg-muted/50 rounded-lg border border-dashed border-border">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="Paste a YouTube URL to add a new video..."
                  value={youtubeUrl}
                  onChange={(e) => { setYoutubeUrl(e.target.value); setImportError(''); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && youtubeUrl.trim()) handleImport(youtubeUrl.trim());
                  }}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
              <Button
                size="sm"
                disabled={!youtubeUrl.trim() || importMutation.isPending}
                onClick={() => handleImport(youtubeUrl.trim())}
                className="gap-1.5 h-[38px] px-4"
              >
                {importMutation.isPending ? (
                  <><Loader2 className="h-5 w-3.5 animate-spin" />Importing...</>
                ) : (
                  'Add Video'
                )}
              </Button>
            </div>
            {importError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />{importError}
              </p>
            )}
            {importMutation.isSuccess && (
              <p className="text-xs text-green-600">Video imported successfully!</p>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search videos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {['All', ...levelOptions].map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                    selectedLevel === level
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>

            <Select
              value={selectedLang}
              onValueChange={(val) => { setSelectedLang(val); setSelectedLevel('All'); }}
            >
              <SelectTrigger className="border-0 bg-white/50 dark:bg-white/5 backdrop-blur shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl px-4 h-9 text-sm font-medium text-foreground gap-2 focus:ring-1 focus:ring-primary/30 cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="rounded-2xl shadow-2xl border-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 duration-200 ease-out"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="rounded-xl px-3 py-2.5 text-sm cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-white/10 focus:bg-slate-100 dark:focus:bg-white/10"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading videos...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="font-medium text-sm mb-2">Failed to load videos</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">No videos found</p>
            <p className="text-muted-foreground text-sm mt-1">
              {videos.length === 0
                ? 'Add your first video by pasting a YouTube URL above'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((video) => (
              <VideoCard key={video.id} video={video} onDelete={(id) => deleteMutation.mutate(id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}