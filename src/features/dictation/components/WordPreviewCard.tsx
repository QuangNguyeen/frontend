import { useCallback, useRef } from 'react';
import { Loader2, Volume2, BookmarkPlus, BookmarkCheck, X } from 'lucide-react';
import type { WordPreviewResponse } from '@/shared/types/api';

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

interface WordPreviewCardProps {
  word: string;
  preview: WordPreviewResponse | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDismiss: () => void;
}

export function WordPreviewCard({
  word,
  preview,
  isLoading,
  isSaving,
  onSave,
  onDismiss,
}: WordPreviewCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = useCallback(() => {
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
    <div className="mt-4 rounded-xl border border-border bg-card shadow-soft overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
      {isLoading ? (
        <div className="flex items-center justify-center p-6 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Looking up &ldquo;{word}&rdquo;…</span>
        </div>
      ) : (
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold truncate">{preview?.word ?? word}</h3>
                {preview?.part_of_speech && (
                  <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium shrink-0 ${posColor(preview.part_of_speech)}`}>
                    {preview.part_of_speech}
                  </span>
                )}
              </div>
              {preview?.phonetic && (
                <p className="text-sm text-muted-foreground font-mono italic">{preview.phonetic}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {preview?.audio_url && (
                <button
                  onClick={playAudio}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="Play pronunciation"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {preview?.meaning && (
            <p className="text-sm text-foreground leading-relaxed">{preview.meaning}</p>
          )}

          {preview?.context_translation && (
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              → {preview.context_translation}
            </p>
          )}

          <button
            onClick={onSave}
            disabled={isSaving || isLoading || !preview}
            className={`w-full inline-flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-semibold shadow-sm active:scale-[0.97] transition-all duration-150 disabled:opacity-70 ${
              preview?.is_saved
                ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : preview?.is_saved ? (
              <BookmarkCheck className="h-3.5 w-3.5" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            {preview?.is_saved ? '✓ Đã lưu' : 'Save to flashcards'}
          </button>
        </div>
      )}
    </div>
  );
}
