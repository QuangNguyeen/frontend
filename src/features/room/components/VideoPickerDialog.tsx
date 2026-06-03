import { useState } from 'react';
import {
  Search, Plus, Globe, Loader2, AlertCircle,
  Check, BookmarkCheck,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useVideos, useImportVideo } from '@/features/library/hooks/useVideos';
import { extractApiError } from '@/shared/lib/httpClient';
import { cn } from '@/lib/utils';
import type { VideoResponse } from '@/shared/types/api';

const LANG_LABELS: Record<string, string> = { en: 'English', ja: 'Japanese' };

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface VideoPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (video: VideoResponse) => void;
  selectedVideoId?: string | null;
}

export function VideoPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedVideoId,
}: VideoPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [importError, setImportError] = useState('');

  const { data: videos = [], isLoading, isError } = useVideos();
  const importMutation = useImportVideo();

  const filtered = videos.filter((v) => {
    if (v.transcription_status !== 'ready') return false;
    const q = search.toLowerCase();
    return v.title.toLowerCase().includes(q) || v.channel.toLowerCase().includes(q);
  });

  const handleImport = () => {
    const url = youtubeUrl.trim();
    if (!url) return;
    importMutation.mutate(
      { youtube_url: url },
      {
        onSuccess: (video) => {
          setYoutubeUrl('');
          setImportError('');
          onSelect(video);
          onOpenChange(false);
        },
        onError: (err) => setImportError(extractApiError(err, 'Failed to import video')),
      },
    );
  };

  const handleSelect = (video: VideoResponse) => {
    onSelect(video);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select a Video</DialogTitle>
          <DialogDescription>Choose from your library or import a new YouTube video</DialogDescription>
        </DialogHeader>

        {/* Import section */}
        <div className="flex flex-col gap-1.5 p-3 bg-muted/50 rounded-lg border border-dashed border-border shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="url"
                placeholder="Paste a YouTube URL…"
                value={youtubeUrl}
                onChange={(e) => { setYoutubeUrl(e.target.value); setImportError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <Button
              size="sm"
              disabled={!youtubeUrl.trim() || importMutation.isPending}
              onClick={handleImport}
              className="gap-1.5 h-[38px] px-4"
            >
              {importMutation.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…</>
                : 'Import'}
            </Button>
          </div>
          {importError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />{importError}
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search your library…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        {/* Video list */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-6 w-6 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">Failed to load videos</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Search className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {videos.length === 0 ? 'No videos yet — import one above' : 'No matching videos'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((video) => {
                const isSelected = video.id === selectedVideoId;
                return (
                  <button
                    key={video.id}
                    onClick={() => handleSelect(video)}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg text-left transition-all w-full',
                      isSelected
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/60 border border-transparent',
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-20 h-[45px] rounded-md overflow-hidden bg-muted shrink-0">
                      <img
                        src={video.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `https://placehold.co/160x90/1a1a2e/white?text=${encodeURIComponent(video.channel.slice(0, 8))}`;
                        }}
                      />
                      <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-white text-[10px] px-1 rounded font-mono leading-tight">
                        {formatDuration(video.duration)}
                      </span>
                      {video.is_curated && (
                        <span className="absolute top-0.5 left-0.5">
                          <BookmarkCheck className="h-3 w-3 text-primary drop-shadow" />
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug line-clamp-1">{video.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="truncate">{video.channel}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Globe className="h-3 w-3" />
                          {LANG_LABELS[video.language] ?? video.language}
                        </span>
                        {video.level && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                            {video.level}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selected indicator */}
                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="h-5 w-5 rounded-full border-2 border-border" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
