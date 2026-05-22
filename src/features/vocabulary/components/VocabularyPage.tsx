import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, AlertCircle, RefreshCw, Trash2, Pencil,
  BookOpen, GraduationCap, Clock, Search, BookmarkCheck, Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useVocabulary, useDueCards, useUpdateWord, useDeleteWord } from '../hooks/useVocabulary';
import type { SavedWordResponse } from '@/shared/types/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatReviewDate(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'Due now';
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Highlight occurrences of `word` inside `sentence` with a bold span. */
function highlightWord(sentence: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = sentence.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <strong key={i} className="text-primary font-semibold">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// ─── Word card ───────────────────────────────────────────────────────────────

function WordCard({
  word,
  onEdit,
  onDelete,
}: {
  word: SavedWordResponse;
  onEdit: (word: SavedWordResponse) => void;
  onDelete: (id: string) => void;
}) {
  const review = formatReviewDate(word.next_review_at);
  const isDue = review === 'Due now' || review === 'Today';

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-sm transition-all duration-200 hover:border-primary/20 flex flex-col">
      {/* Header */}
      <div className="px-[var(--card-padding)] pt-[var(--card-padding)] pb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="flex flex-col min-w-0">
            <h3 className="text-lg font-bold text-primary leading-tight">{word.word}</h3>
            {word.phonetic && (
              <span className="text-sm text-muted-foreground font-mono italic">{word.phonetic}</span>
            )}
          </div>
          {word.audio_url && (
            <button
              onClick={(e) => { e.stopPropagation(); new Audio(word.audio_url!).play(); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
              title="Pronunciation"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(word)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Edit meaning/note"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete word"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{word.word}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the word from your vocabulary. You can always save it again
                  during a future dictation session.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(word.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Body */}
      <div className="px-[var(--card-padding)] pb-[var(--card-padding)] flex flex-col gap-2 flex-1">
        {word.context_sentence && (
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            &ldquo;{highlightWord(word.context_sentence, word.word)}&rdquo;
          </p>
        )}

        {word.context_translation && (
          <p className="text-sm text-muted-foreground/80">→ {word.context_translation}</p>
        )}

        {word.meaning && (
          <div className="flex items-start gap-2">
            <BookOpen className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">{word.meaning}</p>
          </div>
        )}

        {word.note && (
          <div className="flex items-start gap-2">
            <Pencil className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">{word.note}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-[var(--card-padding)] py-2 border-t border-border bg-muted/20 flex items-center justify-between">
        <span className={cn(
          'text-xs flex items-center gap-1',
          isDue ? 'text-amber-600 font-medium' : 'text-muted-foreground',
        )}>
          <Clock className="h-3 w-3" />
          {review}
        </span>
        {word.repetitions > 0 && (
          <span className="text-xs text-muted-foreground">
            {word.repetitions}x reviewed
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Edit dialog ─────────────────────────────────────────────────────────────

function EditWordDialog({
  word,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: {
  word: SavedWordResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (meaning: string, note: string) => void;
  isSaving: boolean;
}) {
  const [meaning, setMeaning] = useState('');
  const [note, setNote] = useState('');

  // Sync form when a new word is selected for editing
  const [lastId, setLastId] = useState<string | null>(null);
  if (word && word.id !== lastId) {
    setLastId(word.id);
    setMeaning(word.meaning ?? '');
    setNote(word.note ?? '');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit &ldquo;{word?.word}&rdquo;
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Meaning</label>
            <input
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="Enter the meaning of the word..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any personal notes, mnemonics, examples..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={isSaving}
            onClick={() => onSave(meaning, note)}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export function VocabularyPage() {
  const navigate = useNavigate();
  const { data: words = [], isLoading, isError, refetch } = useVocabulary();
  const { data: dueData } = useDueCards();
  const updateMutation = useUpdateWord();
  const deleteMutation = useDeleteWord();
  const totalDue = dueData?.total_due ?? 0;

  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<SavedWordResponse | null>(null);

  const filtered = words.filter((w) => {
    const q = search.toLowerCase();
    return (
      w.word.toLowerCase().includes(q) ||
      (w.meaning?.toLowerCase().includes(q) ?? false) ||
      (w.context_sentence?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleSaveEdit = (meaning: string, note: string) => {
    if (!editTarget) return;
    updateMutation.mutate(
      { wordId: editTarget.id, data: { meaning, note } },
      {
        onSuccess: () => setEditTarget(null),
      },
    );
  };

  // ── Loading / error ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading vocabulary...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium text-sm">Failed to load vocabulary</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="px-[var(--page-px)] py-2.5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-semibold">Vocabulary</h1>
              <p className="text-xs text-muted-foreground">
                Your saved words and spaced-repetition progress
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <BookmarkCheck className="h-4 w-4" />
                {words.length} words
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search words..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <Button
              onClick={() => navigate('/vocabulary/review')}
              className="gap-2.5 h-10"
              size="sm"
            >
              <GraduationCap className="h-4 w-4" />
              Flashcard Review
            </Button>
          </div>
        </div>
      </div>

      {/* Due-review banner */}
      {totalDue > 0 && (
        <div className="mx-[var(--page-px)] mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
              <GraduationCap className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-amber-900">
              You have <strong>{totalDue}</strong> word{totalDue !== 1 ? 's' : ''} due for review!
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/vocabulary/review')}
            className="shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            Review Now
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="px-[var(--page-px)] py-[var(--page-py)]">
        {words.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center mb-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-sm mb-1">No saved words yet</h2>
            <p className="text-xs text-muted-foreground max-w-sm mb-3">
              Practice dictation and click on any word in the results to save it here.
            </p>
            <Button size="sm" onClick={() => navigate('/library')} className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Go to Library
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mb-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">No words match &ldquo;{search}&rdquo;</p>
            <p className="text-muted-foreground text-xs mt-0.5">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((w) => (
              <WordCard
                key={w.id}
                word={w}
                onEdit={setEditTarget}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <EditWordDialog
        word={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onSave={handleSaveEdit}
        isSaving={updateMutation.isPending}
      />
    </div>
  );
}
