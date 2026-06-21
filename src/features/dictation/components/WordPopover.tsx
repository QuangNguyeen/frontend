import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DictionaryCard } from '@/components/patterns';
import type { WordPreviewResponse } from '@/shared/types/api';

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
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorEl) return;

    function reposition() {
      const rect = anchorEl!.getBoundingClientRect();
      const popover = popoverRef.current;
      const popoverHeight = popover?.offsetHeight ?? 240;
      const popoverWidth = popover?.offsetWidth ?? 300;
      const gap = 8;

      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= popoverHeight + gap
        ? rect.bottom + window.scrollY + gap
        : rect.top + window.scrollY - popoverHeight - gap;

      let left = rect.left + window.scrollX;
      left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

      setPos({ top, left });
    }

    reposition();
    queueMicrotask(() => setPositioned(true));
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
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        zIndex: 50,
        opacity: positioned ? 1 : 0,
        transition: 'opacity 150ms ease',
        width: 'min(300px, calc(100vw - 1.5rem))',
        maxHeight: 'min(380px, calc(100dvh - 1.5rem))',
      }}
      className="overflow-y-auto rounded-xl border border-border bg-card text-card-foreground shadow-lg ring-1 ring-foreground/5 animate-in fade-in-0 slide-in-from-top-1 duration-150"
    >
      <DictionaryCard
        word={word}
        preview={preview}
        isLoading={isLoading}
        isSaved={isSaved}
        isSaving={isSaving}
        onSave={onSave}
        onPlayAudio={onPlayAudio}
      />
    </div>,
    document.body,
  );
}
