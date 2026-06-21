import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { extractApiError } from '@/shared/lib/httpClient';
import { useRequestPublish } from '../hooks/useMyPractice';

const MAX_MESSAGE = 2000;

interface PublishRequestDialogProps {
  videoId: string;
  videoTitle: string;
  /** Shown when a previous request was rejected. */
  reviewNote?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublishRequestDialog({
  videoId,
  videoTitle,
  reviewNote,
  open,
  onOpenChange,
}: PublishRequestDialogProps) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const mutation = useRequestPublish();

  const handleSubmit = () => {
    if (mutation.isPending) return;
    if (message.length > MAX_MESSAGE) {
      setError(`Message must be ${MAX_MESSAGE} characters or fewer.`);
      return;
    }
    setError('');
    mutation.mutate(
      { videoId, data: { message: message.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success('Publish request submitted', {
            description: 'An administrator will review your video shortly.',
          });
          setMessage('');
          onOpenChange(false);
        },
        onError: (err) => setError(extractApiError(err, 'Failed to submit publish request')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request publication</DialogTitle>
          <DialogDescription className="line-clamp-2">
            Ask an administrator to publish “{videoTitle}” to the public catalog.
          </DialogDescription>
        </DialogHeader>

        {reviewNote && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-semibold">Previously rejected</p>
            <p className="mt-0.5">{reviewNote}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="publish-message">Message (optional)</Label>
          <textarea
            id="publish-message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError('');
            }}
            rows={4}
            maxLength={MAX_MESSAGE}
            placeholder="Add context for the reviewer…"
            className="w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 dark:bg-input/30"
          />
          <div className="flex items-center justify-between">
            {error ? (
              <p className="text-xs font-medium text-destructive">{error}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {message.length}/{MAX_MESSAGE}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="size-4" />
                Submit request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
