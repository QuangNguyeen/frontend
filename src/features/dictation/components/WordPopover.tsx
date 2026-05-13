import { useRef, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Volume2, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WordPreviewResponse } from '@/shared/types/api';

const POS_COLORS: Record<string, string> = {
  noun: 'border-blue-400/50 bg-blue-500/10 text-blue-500',
  verb: 'border-rose-400/50 bg-rose-500/10 text-rose-500',
  adjective: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-500',
  adverb: 'border-violet-400/50 bg-violet-500/10 text-violet-500',
  preposition: 'border-amber-400/50 bg-amber-500/10 text-amber-500',
  conjunction: 'border-cyan-400/50 bg-cyan-500/10 text-cyan-500',
  interjection: 'border-pink-400/50 bg-pink-500/10 text-pink-500',
  'proper noun': 'border-indigo-400/50 bg-indigo-500/10 text-indigo-500',
};

function posColor(pos: string): string {
  return POS_COLORS[pos.toLowerCase()] ?? 'border-border bg-muted/50 text-muted-foreground';
}

export interface WordPopoverProps {
  anchorEl: HTMLElement | null;
  word: string;
  preview: WordPreviewResponse | null;
  isLoading: boolean;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onPlayAudio: () => void;
  onDismiss: () => void;
}

export function WordPopover({
  anchorEl,
  word,
  preview,
  isLoading,
  isSaved,
  isSaving,
  onSave,
  onPlayAudio,
  onDismiss,
}: WordPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [positioned, setPositioned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({
    top: 0, left: 0, placement: 'bottom',
  });

  useEffect(() => {
    if (!anchorEl) return;

    function reposition() {
      const rect = anchorEl!.getBoundingClientRect();
      const popover = popoverRef.current;
      const popoverHeight = popover?.offsetHeight ?? 240;
      const popoverWidth = popover?.offsetWidth ?? 280;
      const gap = 8;

      // Vertical: prefer BELOW, fallback ABOVE
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement = spaceBelow >= popoverHeight + gap ? 'bottom' : 'top';

      let top: number;
      if (placement === 'bottom') {
        top = rect.bottom + window.scrollY + gap;
      } else {
        top = rect.top + window.scrollY - popoverHeight - gap;
      }

      // Horizontal: align left edge with word, clamp to viewport
      let left = rect.left + window.scrollX;
      left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

      setPos({ top, left, placement });
    }

    reposition();
    setPositioned(true);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [anchorEl]);

  useEffect(() => {
    if (!anchorEl) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !anchorEl!.contains(e.target as Node)
      ) {
        onDismiss();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [anchorEl, onDismiss]);

  if (!anchorEl) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 50, opacity: positioned ? 1 : 0, transition: 'opacity 150ms ease' }}
      className="w-[280px] max-h-[400px] overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
    >
      {isLoading ? (
        <div className="space-y-2.5 p-4">
          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          <div className="h-3 w-16 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        </div>
      ) : !preview ? (
        <div className="p-4 text-sm text-muted-foreground">
          No definition found for &ldquo;{word}&rdquo;.
        </div>
      ) : (
        <PopoverContent
          word={word}
          preview={preview}
          isSaved={isSaved}
          isSaving={isSaving}
          onSave={onSave}
          onPlayAudio={onPlayAudio}
        />
      )}
    </div>,
    document.body,
  );
}

function PopoverContent({
  word,
  preview,
  isSaved,
  isSaving,
  onSave,
  onPlayAudio,
}: {
  word: string;
  preview: WordPreviewResponse;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onPlayAudio: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayAudio = useCallback(() => {
    const url = preview.audio_url;
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => {});
    onPlayAudio();
  }, [preview.audio_url, onPlayAudio]);

  return (
    <div className="p-4 space-y-3">
      {/* Row 1: word + audio + save/bookmark */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-lg font-bold tracking-tight truncate">
            {preview.word ?? word}
          </h3>
          {preview.audio_url && (
            <button
              onClick={handlePlayAudio}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
              title="Play pronunciation"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 disabled:opacity-50"
          title={isSaved ? 'Saved' : 'Save to flashcards'}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSaved ? (
            <BookmarkCheck className="h-4 w-4 text-primary" />
          ) : (
            <BookmarkPlus className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Row 2: phonetic */}
      {preview.phonetic && (
        <p className="text-sm text-muted-foreground">{preview.phonetic}</p>
      )}

      {/* Row 3: POS with meanings */}
      {preview.part_of_speech && (() => {
        const entries = preview.part_of_speech.split(';').map((s) => s.trim()).filter(Boolean);
        const hasMeanings = entries.some((e) => e.includes(':'));

        if (hasMeanings) {
          return (
            <div className="space-y-1.5">
              {entries.map((entry) => {
                const colonIdx = entry.indexOf(':');
                const pos = colonIdx >= 0 ? entry.slice(0, colonIdx).trim() : entry.trim();
                const meaning = colonIdx >= 0 ? entry.slice(colonIdx + 1).trim() : '';
                return (
                  <div key={pos} className="flex items-baseline gap-2">
                    <span className={cn(
                      'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold shrink-0',
                      posColor(pos),
                    )}>
                      {pos}
                    </span>
                    {meaning && (
                      <span className="text-sm text-foreground">{meaning}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {entries.flatMap((e) => e.split(/[,\/]+/)).map((s) => s.trim()).filter(Boolean).map((p) => (
              <span
                key={p}
                className={cn(
                  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                  posColor(p),
                )}
              >
                {p}
              </span>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
