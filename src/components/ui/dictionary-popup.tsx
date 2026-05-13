import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Volume2, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';
import type { WordPreviewResponse, SaveWordRequest } from '@/shared/types/api';

const POS_COLORS: Record<string, string> = {
  noun: 'border-blue-400/50 bg-blue-500/10 text-blue-500',
  verb: 'border-rose-400/50 bg-rose-500/10 text-rose-500',
  adjective: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-500',
  adverb: 'border-violet-400/50 bg-violet-500/10 text-violet-500',
  preposition: 'border-amber-400/50 bg-amber-500/10 text-amber-500',
  conjunction: 'border-cyan-400/50 bg-cyan-500/10 text-cyan-500',
  interjection: 'border-pink-400/50 bg-pink-500/10 text-pink-500',
};

function posColor(pos: string): string {
  return POS_COLORS[pos.toLowerCase()] ?? 'border-border bg-muted/50 text-muted-foreground';
}

function stripPunctuation(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function tokenize(text: string): { word: string; clean: string; trailing: string }[] {
  const tokens: { word: string; clean: string; trailing: string }[] = [];
  const regex = /(\S+)(\s*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({ word: match[1], clean: stripPunctuation(match[1]), trailing: match[2] });
  }
  return tokens;
}

// ─── Popover card ───────────────────────────────────────────────────────────

interface PopoverCardProps {
  word: string;
  preview: WordPreviewResponse | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
  onPlayAudio: () => void;
}

function PopoverCard({ word, preview, isLoading, isSaving, onSave, onPlayAudio }: PopoverCardProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-5 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Looking up &ldquo;{word}&rdquo;…</span>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="p-5 text-sm text-muted-foreground">
        No definition found for &ldquo;{word}&rdquo;.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {/* Row 1: word + audio + save icons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-lg font-bold tracking-tight truncate">{preview.word ?? word}</h3>
          {preview.audio_url && (
            <button
              onClick={onPlayAudio}
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
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          title={preview.is_saved ? 'Saved' : 'Save to flashcards'}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : preview.is_saved ? (
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

      {/* Row 3: POS tags */}
      {preview.part_of_speech && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {preview.part_of_speech.split(/[,\/\s]+/).filter(Boolean).map((pos) => (
            <span
              key={pos}
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                posColor(pos.trim()),
              )}
            >
              {pos.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Row 4: meaning */}
      {preview.meaning && (
        <div>
          <p className="text-sm font-semibold text-foreground leading-relaxed">{preview.meaning}</p>
        </div>
      )}

      {/* Row 5: context translation */}
      {preview.context_translation && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {preview.context_translation}
        </p>
      )}
    </div>
  );
}

// ─── Positioned popover (portal) ────────────────────────────────────────────

function PositionedPopover({
  anchorEl,
  children,
  onClose,
}: {
  anchorEl: HTMLElement;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({ top: 0, left: 0, placement: 'top' });

  useEffect(() => {
    function reposition() {
      const rect = anchorEl.getBoundingClientRect();
      const popover = popoverRef.current;
      const popoverHeight = popover?.offsetHeight ?? 200;
      const popoverWidth = popover?.offsetWidth ?? 280;

      const spaceAbove = rect.top;
      const placement = spaceAbove > popoverHeight + 12 ? 'top' : 'bottom';

      let top: number;
      if (placement === 'top') {
        top = rect.top + window.scrollY - popoverHeight - 8;
      } else {
        top = rect.bottom + window.scrollY + 8;
      }

      let left = rect.left + window.scrollX + rect.width / 2 - popoverWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

      setPos({ top, left, placement });
    }

    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [anchorEl]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && !anchorEl.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [anchorEl, onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 50 }}
      className={cn(
        'w-72 rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 duration-150',
        pos.placement === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2',
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export interface DictionaryPopupProps {
  text: string;
  videoId?: string;
  contextSentence?: string;
  audioStartTime?: number;
  className?: string;
  wordClassName?: string;
  savedWords?: Set<string>;
  onWordSaved?: (word: string) => void;
}

export function DictionaryPopup({
  text,
  videoId,
  contextSentence,
  audioStartTime,
  className,
  wordClassName,
  savedWords: savedWordsProp,
  onWordSaved,
}: DictionaryPopupProps) {
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<WordPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(savedWordsProp ?? new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (savedWordsProp) setSavedWords(savedWordsProp);
  }, [savedWordsProp]);

  const tokens = tokenize(text);
  const context = contextSentence ?? text;

  const handleWordClick = useCallback(async (clean: string, el: HTMLElement) => {
    if (!clean || savedWords.has(clean)) return;

    if (activeWord === clean) {
      setActiveWord(null);
      setAnchorEl(null);
      return;
    }

    setAnchorEl(el);
    setActiveWord(clean);
    setPreview(null);
    setIsLoading(true);

    const id = ++requestIdRef.current;
    try {
      const result = await vocabularyService.previewWord(clean, context);
      if (requestIdRef.current !== id) return;
      setPreview(result);
    } catch {
      if (requestIdRef.current !== id) return;
      setPreview(null);
    } finally {
      if (requestIdRef.current === id) setIsLoading(false);
    }
  }, [activeWord, savedWords, context]);

  const handleClose = useCallback(() => {
    setActiveWord(null);
    setAnchorEl(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeWord || isSaving || !preview) return;
    setIsSaving(true);
    try {
      const req: SaveWordRequest = {
        word: activeWord.toLowerCase(),
        context_sentence: context,
        meaning: preview.meaning ?? undefined,
        phonetic: preview.phonetic ?? undefined,
        audio_url: preview.audio_url ?? undefined,
        context_translation: preview.context_translation ?? undefined,
        part_of_speech: preview.part_of_speech ?? undefined,
        source: 'dictionary_popup',
        ...(videoId ? { video_id: videoId } : {}),
        ...(audioStartTime != null ? { audio_start_time: audioStartTime } : {}),
      };
      await vocabularyService.saveWord(req);
      setSavedWords((prev) => new Set(prev).add(activeWord));
      setPreview((p) => p ? { ...p, is_saved: true } : p);
      onWordSaved?.(activeWord);
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  }, [activeWord, isSaving, preview, context, videoId, audioStartTime, onWordSaved]);

  const handlePlayAudio = useCallback(() => {
    const url = preview?.audio_url;
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => {});
  }, [preview?.audio_url]);

  return (
    <>
      <p className={cn('text-base leading-[2] select-none', className)}>
        {tokens.map((tok, i) => {
          const isClickable = !!tok.clean;
          const isSaved = isClickable && savedWords.has(tok.clean);
          const isActive = isClickable && activeWord === tok.clean;

          return (
            <span key={i}>
              <span
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : -1}
                onClick={(e) => {
                  if (isClickable) handleWordClick(tok.clean, e.currentTarget);
                }}
                onKeyDown={(e) => {
                  if (!isClickable) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleWordClick(tok.clean, e.currentTarget);
                  }
                }}
                className={cn(
                  'inline rounded-sm px-0.5 -mx-0.5 transition-all duration-150',
                  wordClassName,
                  isClickable && !isSaved && 'hover:bg-primary/10 cursor-pointer',
                  isSaved && 'bg-green-100 text-green-700 cursor-default',
                  isActive && 'bg-primary/15 text-primary ring-1 ring-primary/30',
                )}
              >
                {tok.word}
              </span>
              {tok.trailing}
            </span>
          );
        })}
      </p>

      {activeWord && anchorEl && (
        <PositionedPopover anchorEl={anchorEl} onClose={handleClose}>
          <PopoverCard
            word={activeWord}
            preview={preview}
            isLoading={isLoading}
            isSaving={isSaving}
            onSave={handleSave}
            onPlayAudio={handlePlayAudio}
          />
        </PositionedPopover>
      )}
    </>
  );
}