import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, AlertTriangle, Pencil, Puzzle, Check, PlayCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClozeDifficulty, PracticeMode, VideoResponse } from '@/shared/types/api';

interface DictationSetupProps {
  video: VideoResponse;
  onStart: (mode: PracticeMode, difficulty?: ClozeDifficulty) => void;
}

interface ModeMeta {
  value: PracticeMode;
  title: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  bestFor: string;
}

const MODES: ModeMeta[] = [
  {
    value: 'sentence',
    title: 'Sentence dictation',
    tagline: 'Type each sentence verbatim.',
    description:
      'Listen to a single sentence and type it out word for word. Best when subtitles are clean and punctuated.',
    icon: <Pencil className="h-5 w-5" />,
    bestFor: 'Manual subtitles · Curated transcripts',
  },
  {
    value: 'cloze',
    title: 'Paragraph cloze',
    tagline: 'Fill in the blanks within a paragraph.',
    description:
      'Read several sentences with key words hidden, then type just those missing words while listening. Faster, less frustrating with auto-subs.',
    icon: <Puzzle className="h-5 w-5" />,
    bestFor: 'Auto-generated subtitles · Casual practice',
  },
];

interface DifficultyMeta {
  value: ClozeDifficulty;
  label: string;
  description: string;
  blanks: string;
  color: { border: string; borderSelected: string; bg: string; icon: string; check: string };
}

const DIFFICULTIES: DifficultyMeta[] = [
  {
    value: 'easy', label: 'Easy',
    description: 'Fewer blanks, mostly long words', blanks: '~10% of words',
    color: {
      border: 'hover:border-primary/50',
      borderSelected: 'border-primary shadow-primary/10',
      bg: 'bg-primary-soft',
      icon: 'text-primary',
      check: 'bg-primary text-white',
    },
  },
  {
    value: 'medium', label: 'Medium',
    description: 'Balanced challenge', blanks: '~25% of words',
    color: {
      border: 'hover:border-accent-yellow/50',
      borderSelected: 'border-accent-yellow shadow-accent-yellow/10',
      bg: 'bg-accent-yellow/10',
      icon: 'text-accent-yellow',
      check: 'bg-accent-yellow text-foreground',
    },
  },
  {
    value: 'hard', label: 'Hard',
    description: 'Many blanks, real test', blanks: '~40% of words',
    color: {
      border: 'hover:border-destructive/50',
      borderSelected: 'border-destructive shadow-destructive/10',
      bg: 'bg-destructive/10',
      icon: 'text-destructive',
      check: 'bg-destructive text-white',
    },
  },
];

export function DictationSetup({ video, onStart }: DictationSetupProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<PracticeMode>(
    video.is_auto_generated ? 'cloze' : 'sentence',
  );
  const [difficulty, setDifficulty] = useState<ClozeDifficulty>('medium');

  return (
    <div className="min-h-full bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 min-h-16 border-b border-border bg-card/90 backdrop-blur px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/library')}
          className="inline-flex items-center justify-center h-9 w-9 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-primary-soft transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
            Practice setup
          </p>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate mt-0.5">
            {video.title}
          </h1>
        </div>
      </header>

      <div className="mx-auto px-4 sm:px-6 py-8 max-w-[1120px] space-y-8 dash-enter">
        {/* Smart warning — Von Restorff focal point */}
        {video.is_auto_generated && (
          <section
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-accent-orange/25 bg-accent-orange/10 p-4 sm:p-5 shadow-soft"
          >
            <span className="h-10 w-10 rounded-2xl bg-accent-orange text-white flex items-center justify-center shrink-0 shadow-soft">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">
                This video uses auto-generated subtitles.
              </p>
              <p className="text-sm text-foreground/85 leading-relaxed mt-1">
                They lack punctuation and can be frustrating to type verbatim. We highly recommend{' '}
                <span className="font-semibold">Paragraph cloze</span> mode for a smoother session.
              </p>
            </div>
          </section>
        )}

        {/* Mode selector */}
        <section>
          <p className="text-xs font-bold tracking-[0.12em] uppercase text-muted-foreground mb-3">
            Choose your practice mode
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {MODES.map((m) => {
              const selected = mode === m.value;
              const recommended = video.is_auto_generated && m.value === 'cloze';
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  aria-pressed={selected}
                  className={cn(
                    'group text-left p-5 sm:p-6 rounded-2xl border bg-card cursor-pointer transition-all duration-300 ease-in-out',
                    'hover:-translate-y-0.5 hover:shadow-soft-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
                    selected
                      ? 'border-primary shadow-soft-lg ring-2 ring-primary/15'
                      : 'border-border shadow-soft hover:border-primary/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <span
                      className={cn(
                        'h-11 w-11 rounded-2xl flex items-center justify-center transition-colors',
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary-soft text-primary group-hover:bg-primary-light/30',
                      )}
                    >
                      {m.icon}
                    </span>
                    {recommended && (
                      <span className="text-xs font-semibold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full bg-accent-orange/10 text-accent-orange border border-accent-orange/25">
                        Recommended
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{m.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{m.tagline}</p>
                  <p className="text-xs text-foreground/80 leading-relaxed mt-3">
                    {m.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground tracking-wide">
                      {m.bestFor}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors',
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-transparent',
                      )}
                      aria-hidden
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Difficulty selector (cloze only) */}
        {mode === 'cloze' && (
          <section className="dash-enter" style={{ animationDelay: '80ms' }}>
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-muted-foreground mb-3">
              Difficulty level
            </p>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map((d) => {
                const selected = difficulty === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(d.value)}
                    aria-pressed={selected}
                    className={cn(
                      'text-left p-4 sm:p-5 rounded-2xl border bg-card cursor-pointer transition-all duration-200 ease-in-out',
                      'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
                      selected
                        ? `${d.color.borderSelected} shadow-soft-lg ring-2 ring-foreground/10`
                        : `border-border shadow-soft ${d.color.border}`,
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold', d.color.bg, d.color.icon)}>
                          {d.label[0]}
                        </span>
                        <h3 className="text-base font-semibold">{d.label}</h3>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors',
                          selected
                            ? d.color.check
                            : 'border border-border text-transparent',
                        )}
                        aria-hidden
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{d.description}</p>
                    <p className={cn('text-xs mt-2 tabular-nums font-medium', selected ? d.color.icon : 'text-muted-foreground')}>{d.blanks}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Start CTA */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onStart(mode, mode === 'cloze' ? difficulty : undefined)}
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-2xl text-sm font-bold tracking-wide bg-primary text-primary-foreground shadow-soft-lg transition-all duration-200 ease-in-out hover:bg-primary-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/40"
          >
            <PlayCircle className="h-5 w-5" />
            Start practising
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </div>
    </div>
  );
}
