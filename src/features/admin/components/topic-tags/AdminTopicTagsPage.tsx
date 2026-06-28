import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, PowerOff, RefreshCcw, Search, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppSelect } from '@/components/ui/app-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { extractApiError } from '@/shared/lib/httpClient';
import type { TopicTag } from '@/shared/types/api';
import {
  useAdminTopicTags,
  useCreateTopicTag,
  useDeactivateTopicTag,
  useUpdateTopicTag,
} from '../../hooks/useAdmin';
import { AdminPageShell } from '../AdminPageShell';
import { AdminEmptyState, AdminLoadingSkeleton } from '../AdminStates';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...ACTIVE_OPTIONS,
];

interface TagFormState {
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: string;
}

const EMPTY_FORM: TagFormState = {
  slug: '',
  name: '',
  description: '',
  is_active: true,
  sort_order: '0',
};

function TagEditorDialog({
  tag,
  open,
  onOpenChange,
}: {
  tag: TopicTag | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = Boolean(tag);
  const [form, setForm] = useState<TagFormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  const createMutation = useCreateTopicTag();
  const updateMutation = useUpdateTopicTag();
  const pending = createMutation.isPending || updateMutation.isPending;

  // Sync form when the dialog opens for a given tag.
  if (open && !initialized) {
    setForm(
      tag
        ? {
            slug: tag.slug,
            name: tag.name,
            description: tag.description ?? '',
            is_active: tag.is_active,
            sort_order: String(tag.sort_order ?? 0),
          }
        : EMPTY_FORM,
    );
    setError('');
    setInitialized(true);
  }
  if (!open && initialized) setInitialized(false);

  const update = (patch: Partial<TagFormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = () => {
    if (pending) return;
    const slug = form.slug.trim();
    const name = form.name.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setError('Slug must be lowercase letters, numbers and single hyphens (e.g. "business-news").');
      return;
    }
    const sortOrder = Number(form.sort_order);
    const payload = {
      slug,
      name,
      description: form.description.trim() || null,
      is_active: form.is_active,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    };

    const onSuccess = () => {
      toast.success(isEdit ? 'Topic tag updated' : 'Topic tag created');
      onOpenChange(false);
    };
    const onError = (err: unknown) => setError(extractApiError(err, 'Failed to save topic tag'));

    if (isEdit && tag) {
      updateMutation.mutate({ tagId: tag.id, data: payload }, { onSuccess, onError });
    } else {
      createMutation.mutate(payload, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit topic tag' : 'New topic tag'}</DialogTitle>
          <DialogDescription>
            Topic tags are fixed and shared across the catalog. Slugs should be stable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  // Auto-suggest a slug for new tags from the name.
                  update(
                    !isEdit && (form.slug === '' || form.slug === slugify(form.name))
                      ? { name, slug: slugify(name) }
                      : { name },
                  );
                  setError('');
                }}
                placeholder="Business"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-slug">Slug</Label>
              <Input
                id="tag-slug"
                value={form.slug}
                onChange={(e) => {
                  update({ slug: e.target.value });
                  setError('');
                }}
                placeholder="business"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tag-description">Description</Label>
            <textarea
              id="tag-description"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
              placeholder="Business-related videos"
              className="w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 dark:bg-input/30"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tag-active">Status</Label>
              <AppSelect
                value={form.is_active ? 'true' : 'false'}
                onValueChange={(v) => update({ is_active: v === 'true' })}
                options={ACTIVE_OPTIONS}
                triggerClassName="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-sort">Sort order</Label>
              <Input
                id="tag-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => update({ sort_order: e.target.value })}
              />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : isEdit ? 'Save changes' : 'Create tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function AdminTopicTagsPage() {
  const { data: tags = [], isLoading, isFetching, refetch } = useAdminTopicTags(true);
  const deactivate = useDeactivateTopicTag();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TopicTag | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TopicTag | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const sorted = useMemo(
    () => [...tags]
      .filter((tag) => {
        const matchesSearch =
          !search.trim() ||
          tag.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          tag.slug.toLowerCase().includes(search.trim().toLowerCase());
        const matchesStatus =
          !status || tag.is_active === (status === 'true');
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [search, status, tags],
  );

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (tag: TopicTag) => {
    setEditing(tag);
    setEditorOpen(true);
  };

  const handleDeactivate = () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    deactivate.mutate(target.id, {
      onSuccess: () => {
        toast.success(`“${target.name}” deactivated`);
        setDeactivateTarget(null);
      },
      onError: (err) => {
        toast.error(extractApiError(err, 'Failed to deactivate tag'));
        setDeactivateTarget(null);
      },
    });
  };

  return (
    <AdminPageShell
      title="Topic Tags"
      description="Maintain the shared taxonomy used by public catalog content."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="min-w-28 justify-center px-4">
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="min-w-28 justify-center px-4">
            <Plus className="size-4" />
            New tag
          </Button>
        </div>
      }
      toolbar={
        <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-9"
              placeholder="Search name or slug"
            />
          </label>
          <AppSelect
            value={status}
            onValueChange={setStatus}
            options={STATUS_FILTER_OPTIONS}
            size="sm"
            triggerClassName="w-full"
          />
        </div>
      }
    >
      <Card className="flex min-h-[340px] flex-col overflow-hidden sm:min-h-[420px]">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-bold">
          <Tags className="size-4 text-primary" />
          {sorted.length} of {tags.length} tag{tags.length === 1 ? '' : 's'}
        </div>

        {isLoading ? (
          <AdminLoadingSkeleton rows={7} />
        ) : sorted.length === 0 ? (
          <AdminEmptyState
            title={tags.length === 0 ? 'No topic tags yet' : 'No matching topic tags'}
            description={
              tags.length === 0
                ? 'Create the first public taxonomy label.'
                : 'Adjust the search or status filter.'
            }
            icon={Tags}
            action={tags.length === 0 ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                Create the first tag
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto scrollbar-stable">
            <table className="w-full min-w-[560px] text-left text-sm sm:min-w-[640px]">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-xs uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Name</th>
                  <th className="px-3 py-2.5 font-bold">Slug</th>
                  <th className="hidden px-3 py-2.5 font-bold md:table-cell">Description</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Order</th>
                  <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((tag) => (
                  <tr key={tag.id}>
                    <td className="px-4 py-2.5 font-bold">{tag.name}</td>
                    <td className="px-3 py-2.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{tag.slug}</code>
                    </td>
                    <td className="hidden max-w-[280px] truncate px-3 py-2.5 text-muted-foreground md:table-cell">
                      {tag.description || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {tag.is_active ? (
                        <span className="inline-flex rounded-full border border-accent-emerald/25 bg-accent-emerald/10 px-2 py-0.5 text-xs font-bold text-accent-emerald">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{tag.sort_order}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={() => openEdit(tag)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        {tag.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2.5 text-xs"
                            onClick={() => setDeactivateTarget(tag)}
                          >
                            <PowerOff className="size-3.5" />
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TagEditorDialog tag={editing} open={editorOpen} onOpenChange={setEditorOpen} />

      <AlertDialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate “{deactivateTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The tag stays visible on videos that already use it, but it can no longer be selected
              for new imports. You can re-activate it later by editing the tag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivate.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivate.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleDeactivate();
              }}
            >
              {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageShell>
  );
}
