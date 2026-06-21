import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TranscriptFeedbackDialog } from './TranscriptFeedbackDialog';

const mutate = vi.fn();
vi.mock('../hooks/useMyPractice', () => ({
  useSubmitTranscriptFeedback: () => ({ mutate, isPending: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  mutate.mockReset();
});

describe('TranscriptFeedbackDialog', () => {
  it('submits segment-level feedback including transcript_id', async () => {
    mutate.mockImplementation((_vars, opts) => opts?.onSuccess?.());
    render(
      <TranscriptFeedbackDialog
        videoId="v1"
        transcriptId="seg-3"
        segmentText="hello world"
        open
        onOpenChange={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/what.s wrong/i), {
      target: { value: 'The word is wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const [vars] = mutate.mock.calls[0];
    expect(vars).toMatchObject({
      videoId: 'v1',
      data: { transcript_id: 'seg-3', message: 'The word is wrong' },
    });
  });

  it('does not submit when the message is empty (validation)', () => {
    render(<TranscriptFeedbackDialog videoId="v1" open onOpenChange={() => {}} />);
    // Submit button is disabled while message is empty.
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows the segment text for context but no transcript editing field', () => {
    render(
      <TranscriptFeedbackDialog videoId="v1" transcriptId="seg-3" segmentText="hello world" open onOpenChange={() => {}} />,
    );
    expect(screen.getByText('hello world')).toBeInTheDocument();
    // Feedback-only: the original segment is shown as read-only text, not an editable input.
    const editable = screen
      .queryAllByRole('textbox')
      .filter((el) => (el as HTMLTextAreaElement).value === 'hello world');
    expect(editable).toHaveLength(0);
  });
});
