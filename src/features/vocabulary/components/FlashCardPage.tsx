import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, RotateCcw, PartyPopper, ArrowLeft, Volume2, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDueCards, useReviewWord } from '../hooks/useVocabulary';
import type { FlashCardResponse } from '@/shared/types/api';

// ─── Grading palette ─────────────────────────────────────────────────────────

const GRADES = [
  { quality: 1, label: 'Again',color: 'bg-red-500 hover:bg-red-600', ring: 'focus-visible:ring-red-400' },
  { quality: 2, label: 'Difficult', color: 'bg-orange-500 hover:bg-orange-600', ring: 'focus-visible:ring-orange-400' },
  { quality: 3, label: 'Good', color: 'bg-green-500 hover:bg-green-600', ring: 'focus-visible:ring-green-400' },
  { quality: 4, label: 'Easy', color: 'bg-blue-500 hover:bg-blue-600', ring: 'focus-visible:ring-blue-400' },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Replace the target word in a sentence with _____ blanks. */
function censorWord(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'gi');
  const blank = '_'.repeat(Math.max(word.length, 4));
  return sentence.replace(re, blank);
}

// ─── Flash card component ────────────────────────────────────────────────────

function FlashCard({
  card,
  isFlipped,
  onFlip,
  onGrade,
  isGrading,
}: {
  card: FlashCardResponse;
  isFlipped: boolean;
  onFlip: () => void;
  onGrade: (quality: number) => void;
  isGrading: boolean;
}) {
  const { phonetic, audio_url, context_translation } = card;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const playAudio = useCallback(() => {
    if (!audio_url) return;
    stopAudio();
    const audio = new Audio(audio_url);
    audioRef.current = audio;
    audio.play().catch((err) => {
      console.warn('[FlashCard] Audio playback blocked:', err);
    });
  }, [audio_url, stopAudio]);

  useEffect(() => {
    if (!audio_url) return;
    stopAudio();
    const audio = new Audio(audio_url);
    audioRef.current = audio;
    audio.play().catch((err) => {
      console.warn('[FlashCard] Autoplay blocked:', err);
    });

    return () => {
      stopAudio();
    };
  }, [card.id, audio_url, stopAudio]);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="rounded-2xl border border-border bg-card shadow-xl px-6 py-8 flex flex-col items-center gap-5 min-h-[300px]">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          What does this word mean?
        </span>

        <h2 className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight text-center">
          {card.word}
        </h2>

        {phonetic && (
          <p className="text-base text-muted-foreground font-mono italic">{phonetic}</p>
        )}

        {audio_url && (
          <button
            onClick={playAudio}
            className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Play pronunciation"
          >
            <Volume2 className="size-5" />
          </button>
        )}

        {card.context_sentence && (
          <p className="text-sm text-muted-foreground leading-relaxed text-center max-w-md italic">
            &ldquo;{isFlipped ? card.context_sentence : censorWord(card.context_sentence, card.word)}&rdquo;
          </p>
        )}

        {isFlipped && (
          <div className="w-full flex flex-col items-center gap-3 pt-3 border-t border-border animate-in fade-in slide-in-from-bottom-2 duration-200">
            {card.meaning ? (
              <p className="text-lg text-center text-primary font-semibold leading-snug max-w-md">
                {card.meaning}
              </p>
            ) : (
              <p className="text-sm text-center text-muted-foreground italic">
                No meaning saved yet
              </p>
            )}

            {context_translation && (
              <p className="text-sm text-muted-foreground text-center max-w-md">
                → {context_translation}
              </p>
            )}
          </div>
        )}

        <div className="flex-1" />

        {!isFlipped ? (
          <>
            <Button
              size="lg"
              onClick={onFlip}
              className="w-full max-w-xs rounded-xl gap-2 h-10 text-sm shadow-md"
            >
              <Eye className="size-4" />
              Show Answer
            </Button>
            <span className="text-[11px] text-muted-foreground">
              or press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-xs font-mono">Space</kbd>
            </span>
          </>
        ) : (
          <div className="w-full flex flex-col gap-2">
            <span className="text-[11px] text-muted-foreground text-center">
              How well did you know this?
            </span>
            <div className="grid grid-cols-4 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.quality}
                  onClick={() => onGrade(g.quality)}
                  disabled={isGrading}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 h-8 rounded-xl text-white font-semibold transition-all',
                    'active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    'disabled:opacity-60 disabled:pointer-events-none',
                    g.color,
                    g.ring,
                  )}
                >
                  <span className="text-sm">{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export function FlashCardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useDueCards();
  const reviewMutation = useReviewWord();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGrading, setIsGrading] = useState(false);

  const cards = data?.cards ?? [];
  const currentCard = cards[currentIndex] as FlashCardResponse | undefined;
  const isFinished = !isLoading && cards.length > 0 && currentIndex >= cards.length;
  const isEmpty = !isLoading && !isError && cards.length === 0;

  const handleFlip = useCallback(() => {
    setIsFlipped((f) => !f);
  }, []);

  const handleGrade = useCallback(
    async (quality: number) => {
      if (!currentCard || isGrading) return;
      setIsGrading(true);
      try {
        await reviewMutation.mutateAsync({
          wordId: currentCard.id,
          data: { quality },
        });
      } catch (err) {
        console.error('[FlashCard] Review failed:', err);
      } finally {
        setIsGrading(false);
        setIsFlipped(false);
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentCard, isGrading, reviewMutation],
  );

  const handleFlipRef = useRef(handleFlip);
  const handleGradeRef = useRef(handleGrade);
  useEffect(() => { handleFlipRef.current = handleFlip; }, [handleFlip]);
  useEffect(() => { handleGradeRef.current = handleGrade; }, [handleGrade]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlipRef.current();
        return;
      }

      if (isFlipped && !isGrading) {
        const key = e.key;
        if (key >= '1' && key <= '4') {
          e.preventDefault();
          handleGradeRef.current(Number(key));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFlipped, isGrading]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Loading flashcards&hellip;</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4">
        <p className="text-sm text-destructive">Failed to load flashcards</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  // ── Empty / finished state ────────────────────────────────────────────────

  if (isEmpty || isFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4 px-6 text-center">
        <div className="size-14 rounded-full bg-green-100 flex items-center justify-center">
          <PartyPopper className="size-7 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold">
          {isFinished ? 'Great job!' : 'All caught up!'}
        </h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          {isFinished
            ? `You reviewed ${cards.length} card${cards.length !== 1 ? 's' : ''} today. Keep up the great work!`
            : 'You have no words due for review today. Keep practicing dictation to build your vocabulary!'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Button onClick={() => navigate('/vocabulary')} className="gap-1.5">
            <ArrowLeft className="size-4" />
            Back to Vocabulary
          </Button>
          {isFinished && (
            <Button
              variant="outline"
              onClick={() => {
                setCurrentIndex(0);
                setIsFlipped(false);
                refetch();
              }}
            >
              <RotateCcw className="size-4 mr-1.5" />
              Review more
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Active review ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-full flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-4" />
            Back
          </button>
          <h1 className="text-sm font-semibold">Flashcard Review</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-medium tabular-nums">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(currentIndex / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {currentCard && (
          <FlashCard
            card={currentCard}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            onGrade={handleGrade}
            isGrading={isGrading}
          />
        )}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 py-3 text-center">
        <p className="text-[11px] text-muted-foreground">
          {isFlipped
            ? 'Press 1 (Again) · 2 (Hard) · 3 (Good) · 4 (Easy)'
            : 'Press Space to flip'}
        </p>
      </div>
    </div>
  );
}