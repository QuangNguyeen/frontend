import { useMemo, useState, useEffect } from 'react';
import { BookmarkPlus, Check, Loader2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';
import type { WordDiffItem } from '@/shared/types/api';

interface WordSavePanelProps {
  /** Plain sentence text — used as fallback context and for flashcard saves. */
  text: string;
  videoId: string;
  audioStartTime: number;
  wordDifficulty?: Record<string, number>;
  /**
   * Optional server-computed diffs. When provided, the panel renders the
   * expected sentence as an inline paragraph with colored highlights per
   * word status, and enforces progressive-reveal masking after the first
   * mistake. When omitted, falls back to a plain-text reveal.
   */
  diffs?: WordDiffItem[];
}

type TokenStatus = 'correct' | 'wrong' | 'missing' | 'masked' | 'plain';

interface Token {
  display: string;
  /** Lowercase, punctuation-stripped — used as the flashcard save key. */
  clean: string;
  status: TokenStatus;
  clickable: boolean;
  isHard: boolean;
}

const DIFFICULTY_THRESHOLD = 0.6;

function cleanForSave(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

function wordLen(word: string): number {
  return word.replace(/[^\p{L}\p{N}']/gu, '').length;
}

/**
 * Build inline tokens from server word_diffs.
 * - 'extra' items are dropped (they aren't part of the expected sentence).
 * - Walks from index 0; everything after the first non-correct item is masked.
 */
function tokensFromDiffs(
  diffs: WordDiffItem[],
  difficulty: Record<string, number>,
): Token[] {
  const flow = diffs.filter((d) => d.status !== 'extra');
  const firstErr = flow.findIndex((d) => d.status !== 'correct');

  return flow.map((d, i): Token => {
    // The canonical expected word for this slot
    const expectedWord =
      (d.status === 'wrong' || d.status === 'missing') && d.expected
        ? d.expected
        : d.word;
    const clean = cleanForSave(expectedWord);
    const isHard = (difficulty[clean] ?? 0) >= DIFFICULTY_THRESHOLD;

    // Progressive reveal: mask everything after the first error
    if (firstErr !== -1 && i > firstErr) {
      return {
        display: '*'.repeat(Math.max(3, wordLen(expectedWord))),
        clean,
        status: 'masked',
        clickable: false,
        isHard: false,
      };
    }

    if (d.status === 'correct') {
      return { display: d.word, clean, status: 'correct', clickable: true, isHard };
    }
    if (d.status === 'wrong') {
      return { display: expectedWord, clean, status: 'wrong', clickable: true, isHard };
    }
    // missing
    return { display: expectedWord, clean, status: 'missing', clickable: true, isHard };
  });
}

/** Fallback: tokenize a plain sentence without diff metadata. */
function tokensFromText(text: string, difficulty: Record<string, number>): Token[] {
  return text.split(/\s+/).filter(Boolean).map((word): Token => {
    const clean = cleanForSave(word);
    return {
      display: word,
      clean,
      status: 'plain',
      clickable: !!clean,
      isHard: (difficulty[clean] ?? 0) >= DIFFICULTY_THRESHOLD,
    };
  });
}

export function WordSavePanel({
  text,
  videoId,
  audioStartTime,
  wordDifficulty = {},
  diffs,
}: WordSavePanelProps) {
  const tokens = useMemo(
    () =>
      diffs && diffs.length > 0
        ? tokensFromDiffs(diffs, wordDifficulty)
        : tokensFromText(text, wordDifficulty),
    [diffs, text, wordDifficulty],
  );

  /** Selection and saved state keyed by the clean word. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Clear transient selection whenever the underlying sentence/diffs change.
  useEffect(() => {
    setSelected(new Set());
  }, [text, diffs]);

  const toggle = (clean: string) => {
    if (!clean || saved.has(clean)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) next.delete(clean);
      else next.add(clean);
      return next;
    });
  };

  const selectedWords = Array.from(selected).filter((w) => !saved.has(w));
  const hasSelection = selectedWords.length > 0;

  const saveSelected = async () => {
    if (!hasSelection || isSaving) return;
    setIsSaving(true);
    try {
      await Promise.allSettled(
        selectedWords.map((word) =>
          vocabularyService.saveWord({
            word,
            video_id: videoId,
            context_sentence: text,
            audio_start_time: audioStartTime,
            source: 'dictation',
          }),
        ),
      );
      setSaved((prev) => {
        const next = new Set(prev);
        selectedWords.forEach((w) => next.add(w));
        return next;
      });
      setSelected(new Set());
    } finally {
      setIsSaving(false);
    }
  };

  // Container palette — red-tinted when there's an unresolved mistake,
  // green otherwise.
  const hasVisibleError = tokens.some(
    (t) => t.status === 'wrong' || t.status === 'missing',
  );
  const containerClass = cn(
    'rounded-2xl px-5 py-5 border transition-colors',
    hasVisibleError
      ? 'bg-red-50/40 border-red-200'
      : 'bg-green-50/50 border-green-200',
  );
  const labelText = diffs
    ? hasVisibleError
      ? 'Your Attempt'
      : 'Perfect Match'
    : 'Answer';
  const labelClass = hasVisibleError ? 'text-red-700' : 'text-green-700';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className={cn('text-xs font-semibold uppercase tracking-wide', labelClass)}>
          {labelText}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
          Click any word to save to flashcards
        </p>
      </div>

      {/* Inline paragraph — reads like natural English with colored highlights */}
      <p className="text-lg leading-[2] text-foreground select-none">
        {tokens.map((tok, i) => {
          const isSaved = !!tok.clean && saved.has(tok.clean);
          const isSelected = !!tok.clean && selected.has(tok.clean);
          const isMasked = tok.status === 'masked';

          // Base status color (overridden by selected/saved)
          const statusClass =
            tok.status === 'wrong'
              ? 'bg-red-100 text-red-800 border-b-2 border-red-400'
              : tok.status === 'missing'
                ? 'bg-amber-100 text-amber-900 border-b-2 border-dashed border-amber-500'
                : isMasked
                  ? 'bg-muted/50 text-muted-foreground/50 font-mono tracking-widest rounded'
                  : tok.isHard
                    ? 'underline decoration-wavy decoration-amber-400/60 underline-offset-4'
                    : '';

          const interactiveClass = isSaved
            ? 'bg-green-200/70 text-green-800 cursor-default'
            : isSelected
              ? 'bg-yellow-200 text-yellow-900 shadow-[0_2px_0_0_theme(colors.yellow.400)]'
              : tok.clickable
                ? 'hover:bg-yellow-100/60 cursor-pointer'
                : 'cursor-not-allowed';

          return (
            <span key={i}>
              <span
                role={tok.clickable ? 'button' : undefined}
                tabIndex={tok.clickable ? 0 : -1}
                onClick={() => tok.clickable && toggle(tok.clean)}
                onKeyDown={(e) => {
                  if (!tok.clickable) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(tok.clean);
                  }
                }}
                title={isMasked ? 'Hidden — fix the error first' : undefined}
                className={cn(
                  'inline-block rounded-sm px-0.5 -mx-0.5 transition-all duration-200',
                  // Saved/selected override the status color
                  (isSaved || isSelected) ? interactiveClass : cn(statusClass, interactiveClass),
                )}
              >
                {isSaved && <Check className="inline h-3 w-3 mr-0.5 -mt-0.5 text-green-600" />}
                {tok.display}
              </span>{' '}
            </span>
          );
        })}
      </p>

      {/* Save button — slides up when any word is selected */}
      <div
        className={cn(
          'mt-4 flex justify-end transition-all duration-300 ease-out overflow-hidden',
          hasSelection ? 'max-h-12 opacity-100 translate-y-0' : 'max-h-0 opacity-0 translate-y-2',
        )}
      >
        <button
          onClick={saveSelected}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold',
            'bg-primary text-primary-foreground shadow-md',
            'hover:bg-primary/90 active:scale-[0.97] transition-all duration-150',
            'disabled:opacity-70 disabled:pointer-events-none',
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BookmarkPlus className="h-4 w-4" />
          )}
          Save {selectedWords.length} {selectedWords.length === 1 ? 'word' : 'words'}
        </button>
      </div>
    </div>
  );
}