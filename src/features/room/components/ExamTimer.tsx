import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExamTimerProps {
  endsAt: string | null;
  onExpired: () => void;
}

export function ExamTimer({ endsAt, onExpired }: ExamTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;

    const endTime = new Date(endsAt).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setRemaining(diff);
      if (diff <= 0) onExpired();
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpired]);

  if (remaining === null) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 60;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-semibold tabular-nums',
        isUrgent
          ? 'bg-red-100 text-red-700 animate-pulse'
          : 'bg-muted text-muted-foreground',
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
