import { useState } from 'react';
import { BookmarkPlus, Check, Loader2, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';

interface WordSavePanelProps {
  text: string;
  videoId: string;
  audioStartTime: number;
  wordDifficulty: Record<string, number>;
}

interface WordToken {
  word: string;
  cleanWord: string;
  difficulty: number;
  isSelected: boolean;
}

const DIFFICULTY_THRESHOLD = 0.6;

function tokenize(text: string, difficulty: Record<string, number>): WordToken[] {
  return text.split(/\s+/).filter(Boolean).map((word) => {
    const clean = word.toLowerCase().replace(/[^a-z']/g, '');
    return {
      word,
      cleanWord: clean,
      difficulty: difficulty[clean] ?? 0,
      isSelected: false,
    };
  });
}

export function WordSavePanel({ text, videoId, audioStartTime, wordDifficulty }: WordSavePanelProps) {
  const [tokens, setTokens] = useState<WordToken[]>(() => tokenize(text, wordDifficulty));
  const [isSaving, setIsSaving] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  const selectedTokens = tokens.filter((t) => t.isSelected && t.cleanWord);
  const hasSelection = selectedTokens.length > 0;

  const toggle = (index: number) => {
    setTokens((prev) =>
      prev.map((t, i) => (i === index ? { ...t, isSelected: !t.isSelected } : t)),
    );
  };

  const saveSelected = async () => {
    if (!hasSelection || isSaving) return;
    setIsSaving(true);
    try {
      await Promise.allSettled(
        selectedTokens.map((t) =>
          vocabularyService.saveWord({
            word: t.cleanWord,
            video_id: videoId,
            context_sentence: text,
            audio_start_time: audioStartTime,
            source: 'dictation',
          }),
        ),
      );
      const newlySaved = new Set(savedWords);
      selectedTokens.forEach((t) => newlySaved.add(t.cleanWord));
      setSavedWords(newlySaved);
      setTokens((prev) => prev.map((t) => ({ ...t, isSelected: false })));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-green-50/50 border border-green-200 rounded-2xl px-5 py-5">
      {/* Header: label + tip */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
          Answer
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
          Click any word to save to flashcards
        </p>
      </div>

      {/* Paragraph-style text with toggleable words */}
      <p className="text-lg leading-[2] text-foreground select-none">
        {tokens.map((token, i) => {
          if (!token.cleanWord) {
            return <span key={i}>{token.word} </span>;
          }

          const isSaved = savedWords.has(token.cleanWord);
          const isHard = token.difficulty >= DIFFICULTY_THRESHOLD;

          return (
            <span key={i}>
              <span
                role="button"
                tabIndex={0}
                onClick={() => !isSaved && toggle(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isSaved) toggle(i);
                  }
                }}
                className={cn(
                  'inline-block rounded-sm px-0.5 -mx-0.5 transition-all duration-200 cursor-pointer',
                  isSaved
                    ? 'bg-green-200/70 text-green-800 cursor-default'
                    : token.isSelected
                      ? 'bg-yellow-200 text-yellow-900 shadow-[0_2px_0_0_theme(colors.yellow.400)]'
                      : isHard
                        ? 'underline decoration-wavy decoration-amber-400/60 underline-offset-4 hover:bg-yellow-100/70'
                        : 'hover:bg-yellow-100/50',
                )}
              >
                {isSaved && <Check className="inline h-3 w-3 mr-0.5 -mt-0.5 text-green-600" />}
                {token.word}
              </span>
              {' '}
            </span>
          );
        })}
      </p>

      {/* Floating save button — slides up when words are selected */}
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
          Save {selectedTokens.length} {selectedTokens.length === 1 ? 'word' : 'words'}
        </button>
      </div>
    </div>
  );
}