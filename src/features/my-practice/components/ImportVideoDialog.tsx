import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Youtube } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppSelect } from '@/components/ui/app-select';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';
import { extractApiError } from '@/shared/lib/httpClient';
import {
  LANGUAGE_OPTIONS,
  getLevelOptions,
  isLevelValidForLanguage,
} from '@/shared/lib/languageLevels';
import { useImportVideo } from '@/features/library/hooks/useVideos';
import { useActiveTopicTags } from '@/features/library/hooks/useTopicTags';
import { summarizeImportResult } from '../lib/status';
import type { ImportVideoResult } from '@/shared/types/api';

interface ImportVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import. Default behaviour navigates to My Practice. */
  onImported?: (result: ImportVideoResult) => void;
}

const NONE_LEVEL = '__none__';

function languagesFor(language: string): string[] {
  if (language === 'en') return ['en', 'en-US', 'en-GB'];
  return [language];
}

export function ImportVideoDialog({ open, onOpenChange, onImported }: ImportVideoDialogProps) {
  const navigate = useNavigate();
  const importMutation = useImportVideo();
  const { data: tags = [], isLoading: tagsLoading } = useActiveTopicTags();

  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('en');
  const [level, setLevel] = useState<string>(NONE_LEVEL);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [maxSegment, setMaxSegment] = useState('10');
  const [error, setError] = useState('');

  const levelOptions = [
    { value: NONE_LEVEL, label: 'Auto / unspecified' },
    ...getLevelOptions(language),
  ];

  const reset = () => {
    setUrl('');
    setLanguage('en');
    setLevel(NONE_LEVEL);
    setTagIds([]);
    setMaxSegment('10');
    setError('');
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const showSummary = (result: ImportVideoResult) => {
    const summary = summarizeImportResult(result);
    const description = summary.details.length ? summary.details.join('\n') : undefined;
    const opts = description ? { description } : undefined;
    if (summary.tone === 'success') toast.success(summary.title, opts);
    else if (summary.tone === 'warning') toast.warning(summary.title, opts);
    else toast.info(summary.title, opts);
  };

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed || importMutation.isPending) return;
    setError('');

    const segment = Number(maxSegment);
    importMutation.mutate(
      {
        youtube_url: trimmed,
        language,
        level: level === NONE_LEVEL ? null : level,
        languages: languagesFor(language),
        max_segment_duration: Number.isFinite(segment) && segment > 0 ? segment : 10,
        topic_tag_ids: tagIds,
      },
      {
        onSuccess: (result) => {
          showSummary(result);
          close();
          if (onImported) onImported(result);
          else if (result.video?.id) navigate('/my-practice');
        },
        onError: (err) => {
          // 400: invalid / inactive / nonexistent tags and other validation errors.
          setError(extractApiError(err, 'Failed to import video'));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="size-5 text-primary" />
            Import a video
          </DialogTitle>
          <DialogDescription>
            Imported videos are added to your My Practice and start as private.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="import-url">YouTube URL</Label>
            <Input
              id="import-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-language">Language</Label>
              <AppSelect
                value={language}
                onValueChange={(val) => {
                  setLanguage(val);
                  setLevel((cur) =>
                    cur !== NONE_LEVEL && isLevelValidForLanguage(val, cur) ? cur : NONE_LEVEL,
                  );
                }}
                options={LANGUAGE_OPTIONS}
                triggerClassName="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-level">Level</Label>
              <AppSelect
                value={level}
                onValueChange={setLevel}
                options={levelOptions}
                triggerClassName="w-full"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-tags">Topic tags</Label>
            <TagMultiSelect
              id="import-tags"
              options={tags}
              value={tagIds}
              onChange={setTagIds}
              loading={tagsLoading}
              placeholder="Select topic tags (optional)"
              emptyText="No active topic tags yet"
            />
            <p className="text-xs text-muted-foreground">
              Personal tags for your My Practice. Tags are managed by administrators.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-segment">Max segment duration (seconds)</Label>
            <Input
              id="import-segment"
              type="number"
              min={1}
              max={60}
              value={maxSegment}
              onChange={(e) => setMaxSegment(e.target.value)}
              className="w-32"
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={importMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim() || importMutation.isPending}>
            {importMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Importing…
              </>
            ) : (
              'Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
