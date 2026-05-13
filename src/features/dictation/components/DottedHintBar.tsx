import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DottedHintBarProps {
  sentence: string;
  revealedIndices: Set<number>;
  onRevealWord: (index: number) => void;
  onRevealAll: () => void;
  allRevealed: boolean;
}

function charCount(word: string): number {
  return word.replace(/[^\p{L}\p{N}']/gu, '').length || 1;
}

export function DottedHintBar({
  sentence,
  revealedIndices,
  onRevealWord,
  onRevealAll,
  allRevealed,
}: DottedHintBarProps) {
  const words = sentence.split(/\s+/).filter(Boolean);

  return (
    <div className="shrink-0 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          Click to reveal
        </span>
        <button
          onClick={onRevealAll}
          disabled={allRevealed}
          className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-lg transition-colors',
            allRevealed
              ? 'text-muted-foreground/50 cursor-default'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {allRevealed ? (
            <span className="flex items-center gap-1">
              <EyeOff className="h-3 w-3" />
              All revealed
            </span>
          ) : (
            'Show all'
          )}
        </button>
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-1.5">
        {words.map((word, i) => {
          const revealed = allRevealed || revealedIndices.has(i);
          const dots = '•'.repeat(charCount(word));

          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (!revealed) onRevealWord(i);
              }}
              disabled={revealed}
              className={cn(
                'inline-flex items-center px-2.5 py-1.5 rounded-lg border text-xs transition-all duration-150 select-none',
                revealed
                  ? 'font-sans tracking-normal text-foreground bg-primary/10 border-primary/30 cursor-default'
                  : 'font-mono tracking-[2px] text-muted-foreground bg-muted/50 border-border cursor-pointer hover:bg-muted hover:border-foreground/20 active:scale-95',
              )}
            >
              {revealed ? word : dots}
            </button>
          );
        })}
      </div>
    </div>
  );
}
