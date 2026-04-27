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
      border: 'hover:border-emerald-500/50',
      borderSelected: 'border-emerald-500 shadow-emerald-500/10',
      bg: 'bg-emerald-500/10',
      icon: 'text-emerald-500',
      check: 'bg-emerald-500 text-white',
    },
  },
  {
    value: 'medium', label: 'Medium',
    description: 'Balanced challenge', blanks: '~25% of words',
    color: {
      border: 'hover:border-amber-500/50',
      borderSelected: 'border-amber-500 shadow-amber-500/10',
      bg: 'bg-amber-500/10',
      icon: 'text-amber-500',
      check: 'bg-amber-500 text-white',
    },
  },
  {
    value: 'hard', label: 'Hard',
    description: 'Many blanks, real test', blanks: '~40% of words',
    color: {
      border: 'hover:border-rose-500/50',
      borderSelected: 'border-rose-500 shadow-rose-500/10',
      bg: 'bg-rose-500/10',
      icon: 'text-rose-500',
      check: 'bg-rose-500 text-white',
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
      <header className="border-b border-border bg-card px-8 sm:px-14 py-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/library')}
          className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground">
            Practice setup
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate mt-0.5">
            {video.title}
          </h1>
        </div>
      </header>

      <div className="px-8 sm:px-14 py-12 max-w-[1080px] space-y-12 dash-enter">
        {/* Smart warning — Von Restorff focal point */}
        {video.is_auto_generated && (
          <section
            role="alert"
            className="flex items-start gap-4 rounded-2xl border border-[color:var(--accent-amber)]/40 bg-[color:var(--accent-amber)]/12 p-6 sm:p-7 shadow-soft"
          >
            <span className="h-11 w-11 rounded-xl bg-[color:var(--accent-amber)] text-[color:var(--accent-amber-foreground)] flex items-center justify-center shrink-0 shadow-soft">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-snug">
                This video uses auto-generated subtitles.
              </p>
              <p className="text-base text-foreground/85 leading-relaxed mt-1.5">
                They lack punctuation and can be frustrating to type verbatim. We highly recommend{' '}
                <span className="font-semibold">Paragraph cloze</span> mode for a smoother session.
              </p>
            </div>
          </section>
        )}

        {/* Mode selector */}
        <section>
          <p className="text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground mb-5">
            Choose your practice mode
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                    'group text-left p-7 sm:p-8 rounded-2xl border bg-card transition-all duration-150 ease-out',
                    'hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
                    selected
                      ? 'border-foreground shadow-soft-lg'
                      : 'border-border shadow-soft hover:border-foreground/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <span
                      className={cn(
                        'h-12 w-12 rounded-xl flex items-center justify-center transition-colors',
                        selected
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-foreground group-hover:bg-muted/80',
                      )}
                    >
                      {m.icon}
                    </span>
                    {recommended && (
                      <span className="text-xs font-semibold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full bg-[color:var(--accent-amber)]/15 text-[color:var(--accent-amber)] border border-[color:var(--accent-amber)]/30">
                        Recommended
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">{m.title}</h3>
                  <p className="text-base text-muted-foreground mt-1.5">{m.tagline}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed mt-4">
                    {m.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground tracking-wide">
                      {m.bestFor}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors',
                        selected
                          ? 'bg-foreground text-background'
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
            <p className="text-xs font-medium tracking-[0.08em] uppercase text-muted-foreground mb-5">
              Difficulty level
            </p>
            <div className="grid grid-cols-3 gap-4">
              {DIFFICULTIES.map((d) => {
                const selected = difficulty === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(d.value)}
                    aria-pressed={selected}
                    className={cn(
                      'text-left p-5 sm:p-6 rounded-2xl border bg-card transition-all duration-150 ease-out',
                      'hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
                      selected
                        ? `${d.color.borderSelected} shadow-soft-lg`
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
            className="inline-flex items-center justify-center gap-3 h-14 px-8 rounded-xl text-base font-semibold bg-[color:var(--accent-emerald)] text-[color:var(--accent-emerald-foreground)] shadow-soft-lg transition-all duration-150 ease-out hover:brightness-110 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent-emerald)]"
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
