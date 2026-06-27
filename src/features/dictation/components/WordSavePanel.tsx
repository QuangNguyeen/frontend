import { useMemo } from 'react';
import { Check, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WordDiffItem } from '@/shared/types/api';

interface WordSavePanelProps {
  text: string;
  videoId: string;
  audioStartTime: number;
  wordDifficulty?: Record<string, number>;
  diffs?: WordDiffItem[];
  savedWords?: Set<string>;
  previewingWord?: string | null;
  onWordClick?: (word: string, contextSentence: string, audioStartTime: number, anchorEl: HTMLElement) => void;
  compact?: boolean;
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
const EMPTY_DIFFICULTY: Record<string, number> = {};

function cleanForSave(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
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
  const allMissing = flow.length > 0 && flow.every((d) => d.status === 'missing');
  const firstErr = allMissing ? -1 : flow.findIndex((d) => d.status !== 'correct');

  return flow.map((d, i): Token => {
    // The canonical expected word for this slot
    const expectedWord =
      (d.status === 'wrong' || d.status === 'missing') && d.expected
        ? d.expected
        : d.word;
    const clean = cleanForSave(expectedWord);
    const isHard = (difficulty[clean] ?? 0) >= DIFFICULTY_THRESHOLD;

    // Progressive reveal: mask everything after the first error
    // (skipped sentences have all-missing diffs — show them fully)
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
  const result: Token[] = [];
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const clean = cleanForSave(word);
    result.push({
      display: word,
      clean,
      status: 'plain',
      clickable: !!clean,
      isHard: (difficulty[clean] ?? 0) >= DIFFICULTY_THRESHOLD,
    });
  }
  return result;
}

export function WordSavePanel({
  text,
  audioStartTime,
  wordDifficulty = EMPTY_DIFFICULTY,
  diffs,
  savedWords: savedWordsProp,
  previewingWord = null,
  onWordClick,
  compact = false,
}: WordSavePanelProps) {
  const tokens = useMemo(
    () =>
      diffs && diffs.length > 0
        ? tokensFromDiffs(diffs, wordDifficulty)
        : tokensFromText(text, wordDifficulty),
    [diffs, text, wordDifficulty],
  );

  const saved = savedWordsProp ?? new Set<string>();
  const hasVisibleError = tokens.some(
    (t) => t.status === 'wrong' || t.status === 'missing',
  );
  const allMissing = tokens.length > 0 && tokens.every((t) => t.status === 'missing');
  const containerClass = cn(
    compact ? 'rounded-none border-0 bg-transparent p-0' : 'rounded-2xl px-4 py-4 border transition-colors',
    !compact && allMissing
      ? 'bg-accent-orange/10 border-accent-orange/20'
      : hasVisibleError
        ? !compact && 'bg-destructive/10 border-destructive/20'
        : !compact && 'bg-[color:var(--badge-success)]/10 border-[color:var(--badge-success)]/20',
  );
  const labelText = diffs
    ? allMissing
      ? 'Answer (Skipped)'
      : hasVisibleError
        ? 'Your Attempt'
        : 'Perfect Match'
    : 'Answer';
  const labelClass = allMissing
    ? 'text-accent-orange'
    : hasVisibleError
      ? 'text-destructive'
      : 'text-[color:var(--badge-success)]';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className={cn('flex items-start justify-between gap-3', compact ? 'sr-only' : 'mb-2')}>
        <p className={cn('text-xs font-semibold uppercase tracking-wide', labelClass)}>
          {labelText}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lightbulb className="size-3 text-accent-orange shrink-0" />
          Click any word to save to flashcards
        </p>
      </div>

      {/* Inline paragraph — reads like natural English with colored highlights */}
      <p className={cn('text-foreground select-none', compact ? 'text-sm leading-8' : 'text-lg leading-[2.1]')}>
        {tokens.map((tok, i) => {
          const isSaved = !!tok.clean && saved.has(tok.clean);
          const isSelected = !!tok.clean && previewingWord === tok.clean;
          const isMasked = tok.status === 'masked';

          // Base status color (overridden by selected/saved)
          const statusClass =
            tok.status === 'wrong'
              ? 'bg-destructive/10 text-destructive border-b-2 border-destructive/50'
              : tok.status === 'missing'
                ? 'bg-accent-orange/10 text-accent-orange border-b-2 border-dashed border-accent-orange/60'
                : isMasked
                  ? 'bg-muted/50 text-muted-foreground/50 font-mono tracking-widest rounded'
                  : tok.isHard
                    ? 'underline decoration-wavy decoration-accent-orange/60 underline-offset-2'
                    : '';

          const interactiveClass = isSaved
            ? 'bg-primary-soft text-primary-hover cursor-default'
            : isSelected
              ? 'bg-accent-yellow/20 text-foreground shadow-[0_2px_0_0_var(--accent-yellow)]'
              : tok.clickable
                ? 'hover:bg-accent-yellow/10 cursor-pointer'
                : 'cursor-not-allowed';

          return (
            <span key={`${i}:${tok.display}`}>
              <span
                {...(tok.clickable ? {
                  role: 'button' as const,
                  tabIndex: 0,
                  onClick: (e: React.MouseEvent<HTMLSpanElement>) => !isSaved && onWordClick?.(tok.clean, text, audioStartTime, e.currentTarget),
                  onKeyDown: (e: React.KeyboardEvent<HTMLSpanElement>) => {
                    if (isSaved) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onWordClick?.(tok.clean, text, audioStartTime, e.currentTarget);
                    }
                  },
                } : {})}
                title={isMasked ? 'Hidden — fix the error first' : undefined}
                className={cn(
                  // Inline (not inline-block) so highlight backgrounds and the dashed
                  // underline hug the text instead of filling the full line-height and
                  // colliding with adjacent wrapped lines. box-decoration-break keeps the
                  // highlight clean if a token ever wraps.
                  'rounded-sm px-0.5 transition-all duration-200 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]',
                  // Saved/selected override the status color
                  (isSaved || isSelected) ? interactiveClass : cn(statusClass, interactiveClass),
                )}
              >
                {isSaved && <Check className="inline size-3 mr-0.5 -mt-0.5 text-primary" />}
                {tok.display}
              </span>{' '}
            </span>
          );
        })}
      </p>

    </div>
  );
}
