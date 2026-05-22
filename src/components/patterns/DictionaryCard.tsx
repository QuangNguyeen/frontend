import { useRef, useCallback } from 'react';
import { Loader2, Volume2, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WordPreviewResponse } from '@/shared/types/api';

const POS_COLORS: Record<string, string> = {
  noun: 'border-blue-400/50 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  verb: 'border-rose-400/50 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  adjective: 'border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  adverb: 'border-violet-400/50 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  preposition: 'border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  conjunction: 'border-cyan-400/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  interjection: 'border-pink-400/50 bg-pink-500/10 text-pink-600 dark:text-pink-400',
  'proper noun': 'border-indigo-400/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

export function posColor(pos: string): string {
  return POS_COLORS[pos.toLowerCase()] ?? 'border-border bg-muted/50 text-muted-foreground';
}

export interface DictionaryCardProps {
  word: string;
  preview: WordPreviewResponse | null;
  isLoading: boolean;
  isSaved?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onPlayAudio?: () => void;
}

export function DictionaryCard({
  word,
  preview,
  isLoading,
  isSaved,
  isSaving,
  onSave,
  onPlayAudio,
}: DictionaryCardProps) {
  if (isLoading) {
    return (
      <div className="p-3.5 space-y-2">
        <div className="h-4 w-20 bg-muted rounded animate-[pulse_1.5s_ease-in-out_infinite]" />
        <div className="h-3 w-14 bg-muted rounded animate-[pulse_1.5s_ease-in-out_infinite] delay-75" />
        <div className="h-3 w-full bg-muted rounded animate-[pulse_1.5s_ease-in-out_infinite] delay-150" />
        <div className="h-3 w-3/4 bg-muted rounded animate-[pulse_1.5s_ease-in-out_infinite] delay-200" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="p-3.5 text-sm text-muted-foreground">
        No definition found for &ldquo;{word}&rdquo;.
      </div>
    );
  }

  return (
    <DictionaryCardContent
      word={word}
      preview={preview}
      isSaved={isSaved ?? preview.is_saved}
      isSaving={isSaving ?? false}
      onSave={onSave}
      onPlayAudio={onPlayAudio}
    />
  );
}

function DictionaryCardContent({
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
  onSave?: () => void;
  onPlayAudio?: () => void;
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
    onPlayAudio?.();
  }, [preview.audio_url, onPlayAudio]);

  return (
    <div className="p-3.5 space-y-2.5">
      {/* Header: word + audio + save */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-base font-bold tracking-tight truncate">
            {preview.word ?? word}
          </h3>
          {preview.audio_url && (
            <button
              onClick={handlePlayAudio}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
              title="Play pronunciation"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {onSave && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className={cn(
              'p-1.5 rounded-lg transition-all shrink-0 disabled:opacity-50',
              isSaved
                ? 'text-[color:var(--badge-success)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              !isSaving && !isSaved && 'active:scale-90',
            )}
            title={isSaved ? 'Saved' : 'Save to flashcards'}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSaved ? (
              <BookmarkCheck className="h-4 w-4 animate-in zoom-in-50 duration-200" />
            ) : (
              <BookmarkPlus className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Phonetic */}
      {preview.phonetic && (
        <p className="text-xs text-muted-foreground">{preview.phonetic}</p>
      )}

      {/* POS tags with optional meanings */}
      {preview.part_of_speech && <PosSection raw={preview.part_of_speech} />}

      {/* Divider + meaning */}
      {preview.meaning && (
        <>
          <div className="border-t border-border" />
          <p className="text-sm font-medium text-foreground leading-relaxed">{preview.meaning}</p>
        </>
      )}

      {/* Context translation */}
      {preview.context_translation && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {preview.context_translation}
        </p>
      )}
    </div>
  );
}

function PosSection({ raw }: { raw: string }) {
  const entries = raw.split(';').map((s) => s.trim()).filter(Boolean);
  const hasMeanings = entries.some((e) => e.includes(':'));

  if (hasMeanings) {
    return (
      <div className="space-y-1">
        {entries.map((entry) => {
          const colonIdx = entry.indexOf(':');
          const pos = colonIdx >= 0 ? entry.slice(0, colonIdx).trim() : entry.trim();
          const meaning = colonIdx >= 0 ? entry.slice(colonIdx + 1).trim() : '';
          return (
            <div key={pos} className="flex items-baseline gap-2">
              <span className={cn(
                'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shrink-0',
                posColor(pos),
              )}>
                {pos}
              </span>
              {meaning && <span className="text-xs text-foreground">{meaning}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {entries.flatMap((e) => e.split(/[,\/]+/)).map((s) => s.trim()).filter(Boolean).map((p) => (
        <span
          key={p}
          className={cn(
            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
            posColor(p),
          )}
        >
          {p}
        </span>
      ))}
    </div>
  );
}
