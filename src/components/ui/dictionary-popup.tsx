import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { DictionaryCard } from '@/components/patterns';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';
import type { WordPreviewResponse, SaveWordRequest } from '@/shared/types/api';

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
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    function reposition() {
      const rect = anchorEl.getBoundingClientRect();
      const popover = popoverRef.current;
      const popoverHeight = popover?.offsetHeight ?? 200;
      const popoverWidth = popover?.offsetWidth ?? 300;

      const spaceAbove = rect.top;
      const top = spaceAbove > popoverHeight + 12
        ? rect.top + window.scrollY - popoverHeight - 8
        : rect.bottom + window.scrollY + 8;

      let left = rect.left + window.scrollX + rect.width / 2 - popoverWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

      setPos({ top, left });
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
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        zIndex: 50,
        width: 'min(300px, calc(100vw - 1.5rem))',
      }}
      className="rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 animate-in fade-in-0 duration-150 slide-in-from-top-2"
    >
      {children}
    </div>,
    document.body,
  );
}

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

  const handlePlayAudio = useCallback(() => {}, []);

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
                  isSaved && 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)] cursor-default',
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
          <DictionaryCard
            word={activeWord}
            preview={preview}
            isLoading={isLoading}
            isSaved={savedWords.has(activeWord)}
            isSaving={isSaving}
            onSave={handleSave}
            onPlayAudio={handlePlayAudio}
          />
        </PositionedPopover>
      )}
    </>
  );
}
