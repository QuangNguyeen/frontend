import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MessageSquareWarning } from 'lucide-react';
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
import { useSubmitTranscriptFeedback } from '../hooks/useMyPractice';

const MIN_MESSAGE = 1;
const MAX_MESSAGE = 5000;
const MAX_SUGGESTED = 5000;

interface TranscriptFeedbackDialogProps {
  videoId: string;
  /** Set for segment-level feedback; omit for whole-video feedback. */
  transcriptId?: string;
  /** Original segment text shown for context (segment-level only). */
  segmentText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TranscriptFeedbackDialog({
  videoId,
  transcriptId,
  segmentText,
  open,
  onOpenChange,
}: TranscriptFeedbackDialogProps) {
  const [message, setMessage] = useState('');
  const [suggested, setSuggested] = useState('');
  const [error, setError] = useState('');
  const mutation = useSubmitTranscriptFeedback();

  const reset = () => {
    setMessage('');
    setSuggested('');
    setError('');
  };

  const handleSubmit = () => {
    if (mutation.isPending) return;
    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE) {
      setError('Please describe the transcript issue.');
      return;
    }
    if (trimmed.length > MAX_MESSAGE) {
      setError(`Explanation must be ${MAX_MESSAGE} characters or fewer.`);
      return;
    }
    if (suggested.length > MAX_SUGGESTED) {
      setError(`Suggested text must be ${MAX_SUGGESTED} characters or fewer.`);
      return;
    }
    setError('');
    mutation.mutate(
      {
        videoId,
        data: {
          transcript_id: transcriptId,
          message: trimmed,
          suggested_text: suggested.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Thanks! Your transcript feedback was submitted.');
          reset();
          onOpenChange(false);
        },
        onError: (err) => setError(extractApiError(err, 'Failed to submit feedback')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : (reset(), onOpenChange(false)))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="size-5 text-accent-orange" />
            Report transcript issue
          </DialogTitle>
          <DialogDescription>
            {transcriptId
              ? 'Report a problem with this transcript segment.'
              : 'Report a problem with this video’s transcript.'}
          </DialogDescription>
        </DialogHeader>

        {segmentText && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="text-[10px] font-bold uppercase tracking-wide">Segment</p>
            <p className="mt-1 text-foreground">{segmentText}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="feedback-message">What’s wrong? (required)</Label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError('');
            }}
            rows={3}
            maxLength={MAX_MESSAGE}
            placeholder="Describe the transcript error…"
            className="w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 dark:bg-input/30"
          />
          <span className="block text-right text-xs text-muted-foreground tabular-nums">
            {message.length}/{MAX_MESSAGE}
          </span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="feedback-suggested">Suggested correction (optional)</Label>
          <textarea
            id="feedback-suggested"
            value={suggested}
            onChange={(e) => setSuggested(e.target.value)}
            rows={2}
            maxLength={MAX_SUGGESTED}
            placeholder="Provide the corrected text…"
            className="w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 dark:bg-input/30"
          />
          <span className="block text-right text-xs text-muted-foreground tabular-nums">
            {suggested.length}/{MAX_SUGGESTED}
          </span>
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!message.trim() || mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit feedback'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
