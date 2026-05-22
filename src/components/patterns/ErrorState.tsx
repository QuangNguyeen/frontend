import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message = 'Failed to load data', onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2.5 py-6', className)}>
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-sm font-medium">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
