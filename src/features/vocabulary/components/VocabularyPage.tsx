import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, AlertCircle, Trash2, Pencil,
  BookOpen, GraduationCap, Clock, Search, BookmarkCheck, Volume2,
  Upload, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountBadge, PageContainer, PageStickyArea, PageScrollArea, PageHeader, RefreshButton } from '@/components/layout/PageShell';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useVocabulary, useDueCards, useUpdateWord, useDeleteWord, vocabularyKeys } from '../hooks/useVocabulary';
import { ImportVocabularyDialog } from './ImportVocabularyDialog';
import { vocabularyService } from '../services/vocabularyService';
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
    <div className="group flex h-full min-h-[250px] flex-col overflow-hidden rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface,var(--color-card))] text-[color:var(--color-text-primary,var(--color-foreground))] shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-soft-lg">
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex min-w-0 flex-col">
              <h3 className="truncate text-xl font-extrabold leading-tight tracking-[-0.02em] text-primary">
                {word.word}
              </h3>
              {word.phonetic && (
                <span className="truncate font-mono text-sm italic text-[color:var(--color-text-muted,var(--color-muted-foreground))]">
                  {word.phonetic}
                </span>
              )}
            </div>
            {word.audio_url && (
              <button
                onClick={(e) => { e.stopPropagation(); new Audio(word.audio_url!).play(); }}
                className="shrink-0 rounded-xl p-2 text-accent-blue transition-colors hover:bg-primary-soft hover:text-primary"
                title="Pronunciation"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => onEdit(word)}
              className="rounded-lg p-1.5 text-[color:var(--color-text-muted,var(--color-muted-foreground))] transition-colors hover:bg-[color:var(--color-surface-muted,var(--color-muted))] hover:text-[color:var(--color-text-primary,var(--color-foreground))]"
              title="Edit meaning/note"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="rounded-lg p-1.5 text-[color:var(--color-text-muted,var(--color-muted-foreground))] transition-colors hover:bg-destructive/10 hover:text-destructive"
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

        <div className="flex flex-1 flex-col gap-3">
        {word.context_sentence && (
          <p
            className="line-clamp-2 text-sm italic leading-relaxed text-[color:var(--color-text-secondary,var(--color-muted-foreground))]"
            title={word.context_sentence}
          >
            &ldquo;{highlightWord(word.context_sentence, word.word)}&rdquo;
          </p>
        )}

        {word.context_translation && (
          <p
            className="line-clamp-2 text-sm text-[color:var(--color-text-muted,var(--color-muted-foreground))]"
            title={word.context_translation}
          >
            → {word.context_translation}
          </p>
        )}

        {word.note && (
          <div className="flex items-start gap-2">
            <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-orange" />
            <p
              className="line-clamp-2 text-sm text-[color:var(--color-text-muted,var(--color-muted-foreground))]"
              title={word.note}
            >
              {word.note}
            </p>
          </div>
        )}

        {word.meaning && (
          <div className="mt-auto flex items-center gap-2 rounded-xl bg-[color:var(--color-primary-soft)] px-3.5 py-3">
            <BookOpen className="h-4 w-4 shrink-0 text-[color:var(--color-primary)]" />
            <p
              className="line-clamp-2 text-sm font-semibold leading-snug text-[color:var(--color-text-primary,var(--color-foreground))]"
              title={word.meaning}
            >
              {word.meaning}
            </p>
          </div>
        )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] px-4 py-3 text-xs sm:px-5">
        <span className={cn(
          'flex items-center gap-1 font-medium',
          isDue ? 'text-accent-orange font-semibold' : 'text-[color:var(--color-text-muted,var(--color-muted-foreground))]',
        )}>
          <Clock className="h-3 w-3" />
          {review}
        </span>
        <span className="shrink-0 text-[color:var(--color-text-muted,var(--color-muted-foreground))]">
          {word.repetitions > 0 ? `${word.repetitions}x reviewed` : 'Not reviewed'}
        </span>
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
          <DialogDescription>
            Update the meaning, phonetic, and notes for this saved word.
          </DialogDescription>
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
  const queryClient = useQueryClient();
  const { data: words = [], isLoading, isError, refetch } = useVocabulary();
  const { data: dueData } = useDueCards();
  const updateMutation = useUpdateWord();
  const deleteMutation = useDeleteWord();
  const totalDue = dueData?.total_due ?? 0;

  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<SavedWordResponse | null>(null);
  const [showImport, setShowImport] = useState(false);

  const handleExport = () => {
    vocabularyService.exportWords();
  };

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
    <PageContainer>
      <PageStickyArea>
        <PageHeader
          title="Vocabulary"
          meta={(
            <CountBadge icon={<BookmarkCheck className="h-4 w-4" />}>
              {words.length} words
            </CountBadge>
          )}
          actions={<RefreshButton onClick={() => refetch()} />}
          toolbar={(
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="relative w-full sm:flex-1 sm:min-w-48 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search words..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 py-2 text-sm bg-card border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/25 placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport} className="flex-1 gap-1.5 h-10 sm:flex-none">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="flex-1 gap-1.5 h-10 sm:flex-none">
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
                <Button
                  onClick={() => navigate('/vocabulary/review')}
                  className="flex-1 gap-2 h-10 sm:flex-none whitespace-nowrap"
                  size="sm"
                >
                  <GraduationCap className="h-4 w-4" />
                  <span className="sm:hidden">Review</span>
                  <span className="hidden sm:inline">Flashcard Review</span>
                </Button>
              </div>
            </div>
          )}
        />

        {totalDue > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent-orange/20 bg-accent-orange/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-orange/15">
                <GraduationCap className="h-5 w-5 text-accent-orange" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                You have <strong>{totalDue}</strong> word{totalDue !== 1 ? 's' : ''} due for review!
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/vocabulary/review')}
              className="shrink-0 gap-1.5 bg-accent-orange hover:bg-accent-orange/90 text-white"
            >
              Review Now
            </Button>
          </div>
        )}
      </PageStickyArea>

      <PageScrollArea>
        <div>
        {words.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-12 text-center shadow-soft">
            <div className="h-12 w-12 rounded-xl bg-primary-soft flex items-center justify-center mb-3">
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
          <div className="grid auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch gap-4">
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
      </PageScrollArea>

      {/* Edit dialog */}
      <EditWordDialog
        word={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onSave={handleSaveEdit}
        isSaving={updateMutation.isPending}
      />

      {/* Import dialog */}
      <ImportVocabularyDialog
        open={showImport}
        onOpenChange={setShowImport}
        onComplete={() => queryClient.invalidateQueries({ queryKey: vocabularyKeys.all })}
      />
    </PageContainer>
  );
}
