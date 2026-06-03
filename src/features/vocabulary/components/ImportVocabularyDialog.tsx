import { useCallback, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { AppSelect } from '@/components/ui/app-select';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/shared/lib/httpClient';
import { vocabularyService } from '../services/vocabularyService';
import { useImportVocabulary, useImportJobStatus } from '../hooks/useVocabulary';
import type { ImportResult } from '@/shared/types/api';

const MAX_WORDS = 100;

type CanonicalField = 'word' | 'meaning' | 'phonetic' | 'part_of_speech' | 'note' | 'context_sentence';

const FIELDS: CanonicalField[] = ['word', 'meaning', 'phonetic', 'part_of_speech', 'note', 'context_sentence'];

const FIELD_LABELS: Record<CanonicalField, string> = {
  word: 'Word',
  meaning: 'Meaning',
  phonetic: 'Phonetic',
  part_of_speech: 'Part of speech',
  note: 'Note',
  context_sentence: 'Context sentence',
};

const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  word: ['word', 'term', 'vocab', 'vocabulary', 'english', 'en'],
  meaning: ['meaning', 'definition', 'translation', 'trans', 'vietnamese', 'vi', 'nghia'],
  phonetic: ['phonetic', 'ipa', 'pronunciation'],
  part_of_speech: ['part_of_speech', 'pos', 'type', 'word_type'],
  note: ['note', 'notes', 'comment'],
  context_sentence: ['context_sentence', 'context', 'sentence', 'example'],
};

type ParsedFile = { headers: string[]; rows: Record<string, string>[] };

type Step = 'upload' | 'mapping' | 'progress';

async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: '' });
    if (matrix.length === 0) return { headers: [], rows: [] };
    const headers = matrix[0].map((h) => String(h ?? '').trim());
    const rows = matrix.slice(1).map((cells) => {
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => { rec[h] = String((cells as unknown[])[i] ?? '').trim(); });
      return rec;
    });
    return { headers, rows };
  }
  // CSV
  const text = await file.text();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = (result.meta.fields ?? []).map((h) => h.trim());
  const rows = (result.data ?? []).map((r) => {
    const rec: Record<string, string> = {};
    headers.forEach((h) => { rec[h] = String(r[h] ?? '').trim(); });
    return rec;
  });
  return { headers, rows };
}

function autoDetect(headers: string[]): Partial<Record<CanonicalField, string>> {
  const mapping: Partial<Record<CanonicalField, string>> = {};
  for (const field of FIELDS) {
    const match = headers.find((h) => {
      const key = h.trim().toLowerCase();
      return key === field || FIELD_ALIASES[field].includes(key);
    });
    if (match) mapping[field] = match;
  }
  return mapping;
}

export function ImportVocabularyDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<CanonicalField, string>>>({});
  const [enrich, setEnrich] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportVocabulary();
  const { data: jobStatus } = useImportJobStatus(jobId, step === 'progress');

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setParsed(null);
    setMapping({});
    setEnrich(true);
    setParseError(null);
    setImportResult(null);
    setJobId(null);
    importMutation.reset();
  }, [importMutation]);

  const handleClose = useCallback((next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  }, [onOpenChange, reset]);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParseError(null);
    try {
      const result = await parseFile(f);
      if (result.headers.length === 0) {
        setParseError('The file appears to be empty.');
        return;
      }
      setParsed(result);
      setMapping(autoDetect(result.headers));
      setStep('mapping');
    } catch {
      setParseError('Could not read this file. Please upload a valid CSV or XLSX.');
    }
  }, []);

  const wordRows = useMemo(() => {
    if (!parsed) return [];
    const wordCol = mapping.word;
    if (!wordCol) return [];
    return parsed.rows.filter((r) => (r[wordCol] ?? '').trim());
  }, [parsed, mapping]);

  const previewRows = useMemo(() => (parsed ? parsed.rows.slice(0, 5) : []), [parsed]);

  const tooMany = wordRows.length > MAX_WORDS;
  const canImport = !!mapping.word && wordRows.length > 0 && !tooMany;

  const handleImport = useCallback(async () => {
    if (!parsed || !mapping.word) return;
    const mappedRows = wordRows.map((r) => {
      const out: Record<string, string> = {};
      for (const field of FIELDS) {
        const src = mapping[field];
        out[field] = src ? (r[src] ?? '') : '';
      }
      return out;
    });
    const csv = Papa.unparse({ fields: FIELDS as string[], data: mappedRows });
    const csvFile = new File([csv], 'import.csv', { type: 'text/csv' });

    setStep('progress');
    importMutation.mutate(
      { file: csvFile, enrich },
      {
        onSuccess: (result) => {
          setImportResult(result);
          if (result.job_id && result.enrich_queued) setJobId(result.job_id);
        },
      },
    );
  }, [parsed, mapping, wordRows, enrich, importMutation]);

  const handleViewNow = useCallback(() => {
    onComplete?.();
    handleClose(false);
  }, [onComplete, handleClose]);

  // ── Derived progress state ──────────────────────────────────────────────────
  const enriching = !!jobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed';
  const progressPct = jobStatus?.progress_pct ?? 0;
  const phaseLabel: Record<string, string> = {
    meanings: 'Fetching meanings & audio…',
    audio: 'Fetching audio…',
    translations: 'Generating examples & translations…',
    done: 'Done',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'mapping' && (
              <button
                onClick={() => setStep('upload')}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Upload className="h-4 w-4" />
            {step === 'progress' && enriching ? 'Enriching vocabulary…' : 'Import Vocabulary'}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to add words to your vocabulary in bulk.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 0: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="flex flex-col gap-4 py-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Drag &amp; drop your file here</p>
                <p className="text-xs text-muted-foreground">CSV or Excel (.xlsx) · Maximum {MAX_WORDS} words</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.xlsm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Browse File
              </Button>
            </div>

            {parseError && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {parseError}
              </p>
            )}

            <button
              onClick={() => vocabularyService.downloadTemplate()}
              className="flex items-center gap-1.5 self-start text-sm text-primary hover:underline"
            >
              <Download className="h-4 w-4" /> Download template CSV
            </button>
          </div>
        )}

        {/* ── Step 1: Mapping + preview ──────────────────────────────────── */}
        {step === 'mapping' && parsed && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="font-medium text-foreground">{file?.name}</span>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Map your columns</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FIELDS.map((field) => (
                  <label key={field} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {FIELD_LABELS[field]}
                      {field === 'word' && <span className="text-destructive"> *</span>}
                    </span>
                    <AppSelect
                      value={mapping[field] ?? '__none__'}
                      onValueChange={(val) =>
                        setMapping((m) => ({ ...m, [field]: val === '__none__' ? undefined : val }))
                      }
                      options={[
                        { value: '__none__', label: '— none —' },
                        ...parsed.headers.map((h) => ({ value: h, label: h })),
                      ]}
                      size="sm"
                      triggerClassName="w-full"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <p className="mb-1.5 text-sm font-medium">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      {FIELDS.filter((f) => mapping[f]).map((f) => (
                        <th key={f} className="px-3 py-2 font-medium">{FIELD_LABELS[f]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {FIELDS.filter((f) => mapping[f]).map((f) => (
                          <td key={f} className="px-3 py-1.5 text-muted-foreground">
                            {r[mapping[f]!] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={cn('mt-1.5 text-xs', tooMany ? 'text-destructive' : 'text-muted-foreground')}>
                {tooMany
                  ? `Too many rows: ${wordRows.length} words detected (maximum ${MAX_WORDS} per import).`
                  : `${wordRows.length} word${wordRows.length !== 1 ? 's' : ''} detected.`}
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                checked={enrich}
                onChange={(e) => setEnrich(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                <span className="font-medium">Auto-enrich</span>: fill missing meaning, audio &amp; examples
                <span className="block text-xs text-muted-foreground">
                  Uses AI — runs in the background (~2 min for {MAX_WORDS} words).
                </span>
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
              <Button size="sm" disabled={!canImport} onClick={handleImport}>
                Import {wordRows.length} word{wordRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Progress ───────────────────────────────────────────── */}
        {step === 'progress' && (
          <div className="flex flex-col gap-4 py-2">
            {importMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Importing words…
              </div>
            )}

            {importMutation.isError && (
              <div className="flex flex-col gap-3">
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {extractApiError(importMutation.error, 'Import failed')}
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>Back</Button>
                  <Button size="sm" onClick={() => handleClose(false)}>Close</Button>
                </div>
              </div>
            )}

            {importResult && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-[color:var(--badge-success)]" />
                  <span>
                    <strong>{importResult.imported}</strong> imported
                    {importResult.updated > 0 && <> · <strong>{importResult.updated}</strong> updated</>}
                  </span>
                </div>

                {importResult.errors.length > 0 && (
                  <p className="text-xs text-amber-600">
                    {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} skipped (missing word).
                  </p>
                )}

                {jobId && jobStatus?.status === 'failed' && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" /> Enrichment failed: {jobStatus.error ?? 'unknown error'}
                  </p>
                )}

                {jobId && jobStatus?.status !== 'failed' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {enriching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {phaseLabel[jobStatus?.phase ?? 'meanings'] ?? 'Working…'}
                      </span>
                      <span className="font-medium">{progressPct}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-lg bg-muted">
                      <div
                        className="h-full rounded-lg bg-primary transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {jobStatus?.enriched ?? 0} / {jobStatus?.total ?? importResult.total_words} words enriched
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={handleViewNow}>
                    {jobStatus?.status === 'completed' || !jobId ? 'Done' : 'View words now'}
                  </Button>
                </div>
                {jobId && enriching && (
                  <p className="text-right text-[11px] text-muted-foreground">
                    Enrichment continues in the background.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
