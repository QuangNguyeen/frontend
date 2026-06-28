import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Puzzle, Blocks, Check, PlayCircle, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ClozeDifficulty, VideoResponse } from '@/shared/types/api';

/** UI-level mode. 'build' runs on a 'sentence' session (see DictationPage). */
type UiMode = 'sentence' | 'cloze' | 'build';

type ModeOption = { value: UiMode; title: string; tagline: string; icon: React.ReactNode };

const MODES: ModeOption[] = [
  {
    value: 'sentence',
    title: 'Sentence dictation',
    tagline: 'Type each sentence verbatim.',
    icon: <Pencil className="h-4 w-4" />,
  },
  {
    value: 'cloze',
    title: 'Paragraph cloze',
    tagline: 'Fill in the blanks within a paragraph.',
    icon: <Puzzle className="h-4 w-4" />,
  },
  {
    value: 'build',
    title: 'Sentence building',
    tagline: 'Tap words to rebuild each sentence.',
    icon: <Blocks className="h-4 w-4" />,
  },
];

const DIFFICULTIES: {
  value: ClozeDifficulty;
  label: string;
  blanks: string;
  color: { border: string; borderSelected: string; bg: string; icon: string };
}[] = [
  {
    value: 'easy', label: 'Easy', blanks: '~10%',
    color: { border: 'hover:border-primary/50', borderSelected: 'border-primary', bg: 'bg-primary-soft', icon: 'text-primary' },
  },
  {
    value: 'medium', label: 'Medium', blanks: '~25%',
    color: { border: 'hover:border-accent-yellow/50', borderSelected: 'border-accent-yellow', bg: 'bg-accent-yellow/10', icon: 'text-accent-yellow' },
  },
  {
    value: 'hard', label: 'Hard', blanks: '~40%',
    color: { border: 'hover:border-destructive/50', borderSelected: 'border-destructive', bg: 'bg-destructive/10', icon: 'text-destructive' },
  },
];

export function ModeSelectDialog({
  video,
  open,
  onOpenChange,
}: {
  video: VideoResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<UiMode>(video.is_auto_generated ? 'cloze' : 'sentence');
  const [difficulty, setDifficulty] = useState<ClozeDifficulty>('medium');

  const handleStart = () => {
    const params = new URLSearchParams({ mode });
    if (mode === 'cloze') params.set('difficulty', difficulty);
    navigate(`/dictation/${video.id}?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose practice mode</DialogTitle>
          <DialogDescription className="line-clamp-1">{video.title}</DialogDescription>
        </DialogHeader>

        {video.is_auto_generated && (
          <div className="flex items-start gap-2.5 rounded-xl border border-accent-orange/25 bg-accent-orange/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 text-accent-orange shrink-0 mt-0.5" />
            <p className="text-foreground">
              Auto-generated subtitles — <span className="font-semibold">Paragraph cloze</span> recommended.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {MODES.map((m) => {
            const selected = mode === m.value;
            const recommended = video.is_auto_generated && m.value === 'cloze';
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={cn(
                  'flex items-center gap-3 text-left p-3 rounded-lg border transition-all',
                  selected
                    ? 'border-foreground bg-foreground/5'
                    : 'border-border hover:border-foreground/30',
                )}
              >
                <span className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                  selected ? 'bg-foreground text-background' : 'bg-muted text-foreground',
                )}>
                  {m.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{m.title}</span>
                    {recommended && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-lg bg-accent-orange/10 text-accent-orange border border-accent-orange/20">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.tagline}</p>
                </div>
                <span className={cn(
                  'h-5 w-5 rounded-full flex items-center justify-center shrink-0',
                  selected ? 'bg-foreground text-background' : 'border border-border',
                )}>
                  {selected && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>

        {mode === 'cloze' && (
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => {
              const selected = difficulty === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={cn(
                    'flex-1 text-center p-2.5 rounded-lg border transition-all',
                    selected ? `${d.color.borderSelected} ${d.color.bg}` : `border-border ${d.color.border}`,
                  )}
                >
                  <span className={cn('text-sm font-semibold', selected ? d.color.icon : 'text-foreground')}>{d.label}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{d.blanks}</p>
                </button>
              );
            })}
          </div>
        )}

        <Button onClick={handleStart} className="w-full gap-2 mt-1">
          <PlayCircle className="h-4 w-4" />
          Start practising
        </Button>
      </DialogContent>
    </Dialog>
  );
}