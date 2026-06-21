import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, RotateCcw, Play, Pause,
  ChevronLeft, ChevronRight, ChevronDown, Trophy,
  Loader2, AlertCircle, CheckCircle2, XCircle,
  MinusCircle, Languages, List, MessageSquareWarning,
} from 'lucide-react';
import { TranscriptFeedbackDialog } from '@/features/my-practice/components/TranscriptFeedbackDialog';
import { YoutubePlayer } from './YoutubePlayer';
import type { YoutubePlayerHandle } from './YoutubePlayer';
import { usePlayerPrefsStore } from '../hooks/usePlayerPrefsStore';
import { useDictationSession, useSubmitAnswer, useCompleteSession } from '../hooks/useDictation';
import { useVideo, useVideoTranscripts } from '@/features/library/hooks/useVideos';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type {
  PracticeMode, SentenceResultResponse, TranscriptResponse, WordDiffItem,
} from '@/shared/types/api';
import { WordSavePanel } from './WordSavePanel';
import { WordPopover } from './WordPopover';
import { DottedHintBar } from './DottedHintBar';
import { ClozeMode } from './ClozeMode';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';
import { vocabularyKeys } from '@/features/vocabulary/hooks/useVocabulary';
import { useQueryClient } from '@tanstack/react-query';
import { cleanForSave } from '../hooks/useWordSave';
import { toast } from 'sonner';
import type { ClozeDifficulty, WordPreviewResponse } from '@/shared/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'playing' | 'practicing' | 'completed';

interface LocalResult {
  sentenceIndex: number;
  score: number;
  userInput: string;
  correctText: string;
}

interface DictationInputPanelProps {
  isVerifying: boolean;
  currentSentence: TranscriptResponse | undefined;
  videoId: string | undefined;
  savedWords: Set<string>;
  previewingWord: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  inputValue: string;
  latestDiffCheck: SentenceResultResponse | null;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSkip: () => void;
  onSubmit: () => void;
  onWordClick: (word: string, contextSentence: string, startTime: number, anchorEl: HTMLElement) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function findSegmentByTime(segs: TranscriptResponse[], time: number): number {
  let lo = 0, hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (time < segs[mid].start_time) hi = mid - 1;
    else if (time >= segs[mid].end_time) lo = mid + 1;
    else return mid;
  }
  return -1;
}

function computeErrorCaretOffset(userText: string, diffs: WordDiffItem[]): number {
  if (diffs.every((d) => d.status === 'correct')) return userText.length;

  let lastNonMissingIdx = -1;
  for (let i = diffs.length - 1; i >= 0; i--) {
    if (diffs[i].status !== 'missing') {
      lastNonMissingIdx = i;
      break;
    }
  }
  if (lastNonMissingIdx >= 0) {
    const allTypedCorrect = diffs
      .slice(0, lastNonMissingIdx + 1)
      .every((d) => d.status === 'correct');
    if (allTypedCorrect) return userText.length;
  }

  let firstErrIdx = diffs.findIndex(
    (d) => d.status === 'wrong' || d.status === 'extra',
  );
  if (firstErrIdx === -1) {
    firstErrIdx = diffs.findIndex((d) => d.status === 'missing');
  }
  if (firstErrIdx === -1) return userText.length;

  let userWordsConsumed = 0;
  for (let i = 0; i <= firstErrIdx; i++) {
    const s = diffs[i].status;
    if (s === 'correct' || s === 'wrong' || s === 'extra') {
      userWordsConsumed++;
    }
  }
  if (userWordsConsumed === 0) return 0;

  const re = /\S+/g;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = re.exec(userText)) !== null) {
    count++;
    if (count === userWordsConsumed) {
      return match.index + match[0].length;
    }
  }
  return userText.length;
}

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[26px] min-h-[22px] items-center justify-center rounded-md border border-border/80 bg-muted/60 px-[7px] py-[2px] text-xs font-bold leading-none text-foreground shadow-[inset_0_-1px_0_rgb(18_38_58_/_0.08)]">
      {children}
    </kbd>
  );
}

function ShortcutHint({
  keys,
  label,
}: {
  keys: React.ReactNode[];
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {keys.map((key, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground/50">/</span>}
          <KeyboardKey>{key}</KeyboardKey>
        </span>
      ))}
      <span className="text-xs font-semibold text-foreground/70">{label}</span>
    </span>
  );
}

function PracticeActionButtons({
  isVerifying,
  canSubmit,
  isRetry,
  onSkip,
  onSubmit,
}: {
  isVerifying: boolean;
  canSubmit: boolean;
  isRetry: boolean;
  onSkip: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
      <button
        onClick={onSkip}
        disabled={isVerifying}
        className="h-[34px] rounded-[10px] px-3 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-30"
      >
        Skip
      </button>
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={!canSubmit || isVerifying}
        className="h-[34px] gap-1.5 rounded-[10px] px-4 text-[13px] font-bold transition-all active:scale-95"
      >
        {isVerifying ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking</>
        ) : isRetry ? (
          'Retry'
        ) : (
          'Submit'
        )}
      </Button>
    </div>
  );
}

function DictationInputPanel({
  isVerifying,
  currentSentence,
  videoId,
  savedWords,
  previewingWord,
  inputRef,
  inputValue,
  latestDiffCheck,
  onInputChange,
  onKeyDown,
  onSkip,
  onSubmit,
  onWordClick,
}: DictationInputPanelProps) {
  const isRetry = !!latestDiffCheck && !latestDiffCheck.word_diffs.every((d) => d.status === 'correct');
  const feedbackScore = latestDiffCheck ? Math.round(latestDiffCheck.score * 100) : null;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[14px] border bg-card p-3.5 shadow-soft transition-all duration-200 ease-in-out',
        isVerifying
          ? 'border-muted-foreground/20'
          : 'border-border focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgb(20_125_111_/_0.14),var(--shadow-soft)]',
      )}
    >
      {isVerifying && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 bg-primary/40 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
        </div>
      )}
      {latestDiffCheck && currentSentence && videoId && (
        <div
          className={cn(
            'min-h-10 max-h-20 overflow-y-auto rounded-lg border px-3 py-2 text-xs',
            isRetry
              ? 'border-accent-orange/25 bg-accent-orange/10 text-accent-orange'
              : 'border-[color:var(--badge-success)]/25 bg-[color:var(--badge-success)]/10 text-[color:var(--badge-success)]',
          )}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 font-bold">
                {isRetry ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {isRetry ? 'Fix highlighted words' : 'Looks correct'}
              </span>
              <span className="font-bold tabular-nums">{feedbackScore}%</span>
            </div>
            <div>
              <WordSavePanel
                text={latestDiffCheck.original_text || currentSentence.text}
                videoId={latestDiffCheck.video_id || videoId}
                audioStartTime={latestDiffCheck.audio_start_time || currentSentence.start_time}
                wordDifficulty={latestDiffCheck.word_difficulty ?? {}}
                diffs={latestDiffCheck.word_diffs}
                savedWords={savedWords}
                previewingWord={previewingWord}
                onWordClick={onWordClick}
                compact
              />
            </div>
          </div>
        </div>
      )}

      <textarea
        ref={inputRef}
        value={inputValue}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        placeholder="Type what you hear…"
        rows={2}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={isVerifying}
        className="dictation-input mt-2.5 max-h-[84px] min-h-[52px] w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-base leading-[1.45] text-foreground caret-primary outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-ring/15 disabled:opacity-60 dark:bg-input/30"
      />

      <div className="mt-2.5 flex flex-col gap-2 border-t border-border pt-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ShortcutHint keys={['Enter']} label="Check" />
          <ShortcutHint keys={['Tab']} label="Next" />
          <ShortcutHint keys={['H']} label="Hint" />
          <ShortcutHint keys={['R']} label="Replay" />
        </div>
        <PracticeActionButtons
          isVerifying={isVerifying}
          canSubmit={!!inputValue.trim()}
          isRetry={isRetry}
          onSkip={onSkip}
          onSubmit={onSubmit}
        />
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DictationPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const playerHandle = useRef<YoutubePlayerHandle>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const segmentListRef = useRef<HTMLDivElement>(null);
  const liveSegmentIdxRef = useRef(-1);
  const [liveSegmentIdx, setLiveSegmentIdx] = useState(-1);

  const autoPlayRef = useRef(false);
  const handleNextRef = useRef<() => void>(() => { });

  // ── Persisted user preferences ─────────────────────────────────────────────
  const autoNext = usePlayerPrefsStore((s) => s.autoNext);
  const toggleAutoNext = usePlayerPrefsStore((s) => s.toggleAutoNext);
  const autoNextRef = useRef(autoNext);
  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);

  // ── API state ──────────────────────────────────────────────────────────────
  const modeParam = searchParams.get('mode') as PracticeMode | null;
  const [practiceMode] = useState<PracticeMode | null>(modeParam || 'sentence');
  const [clozeDifficulty] = useState<ClozeDifficulty>(
    (searchParams.get('difficulty') as ClozeDifficulty) || 'medium',
  );
  const { sessionId, sessionData } = useDictationSession(videoId, practiceMode);
  const [currentIndex, setCurrentIndex] = useState(0);
  const resumeAppliedRef = useRef(false);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [serverResults, setServerResults] = useState<Map<number, SentenceResultResponse>>(new Map());

  // ── Practice state ─────────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [playCount, setPlayCount] = useState(0);

  // ── Transcript feedback ────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ transcriptId?: string; segmentText?: string } | null>(null);

  // ── Word popover state ─────────────────────────────────────────────────────
  const sentenceQueryClient = useQueryClient();
  const [sentenceSavedWords, setSentenceSavedWords] = useState<Set<string>>(new Set());
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverWord, setPopoverWord] = useState<string | null>(null);
  const [popoverContext, setPopoverContext] = useState<{ context: string; startTime: number } | null>(null);
  const [popoverPreview, setPopoverPreview] = useState<WordPreviewResponse | null>(null);
  const [isPopoverLoading, setIsPopoverLoading] = useState(false);
  const [isPopoverSaving, setIsPopoverSaving] = useState(false);
  const popoverRequestId = useRef(0);

  // ── Dotted hint state ─────────────────────────────────────────────────────
  const [revealedHintIndices, setRevealedHintIndices] = useState<Set<number>>(new Set());
  const [allHintsRevealed, setAllHintsRevealed] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: video, isLoading: videoLoading, isError: videoError } = useVideo(videoId);
  const { data: sentences = [], isLoading: sentencesLoading, transcriptionStatus } = useVideoTranscripts(videoId);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (
      !sessionData?.resumed ||
      resumeAppliedRef.current ||
      sentences.length === 0
    ) return;
    const idx = sessionData.current_sentence_index ?? 0;
    if (idx > 0 && idx < sentences.length) {
      resumeAppliedRef.current = true;
      setCurrentIndex(idx);
    }
  }, [sessionData, sentences]);

  useEffect(() => {
    if (
      !sessionData?.resumed ||
      !sessionData.sentence_results?.length ||
      results.length > 0
    ) return;

    setResults(
      sessionData.sentence_results.map((sr) => ({
        sentenceIndex: sr.sentence_index,
        score: Math.round(sr.score * 100),
        userInput: '',
        correctText: '',
      })),
    );

    const serverMap = new Map<number, SentenceResultResponse>();
    for (const sr of sessionData.sentence_results) {
      const diffs = sr.word_diff ?? [];
      serverMap.set(sr.sentence_index, {
        sentence_index: sr.sentence_index,
        score: sr.score,
        word_diffs: diffs,
        correct_count: diffs.filter((d) => d.status === 'correct').length,
        wrong_count: diffs.filter((d) => d.status === 'wrong').length,
        missing_count: diffs.filter((d) => d.status === 'missing').length,
        original_text: '',
        video_id: videoId ?? '',
        audio_start_time: 0,
        word_difficulty: {},
      });
    }
    setServerResults(serverMap);
  }, [sessionData, videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sentence = sentences[currentIndex];
    if (!sentence) return;
    const alreadyDone = results.find((r) => r.sentenceIndex === currentIndex);
    setInputValue('');
    setPhase(alreadyDone ? 'completed' : 'practicing');
    setPlayCount(0);
    setHintsUsed(0);
    setShowTranslation(false);
    setIsVerifying(false);
    setPopoverAnchorEl(null);
    setPopoverWord(null);
    setPopoverPreview(null);
    setRevealedHintIndices(new Set());
    setAllHintsRevealed(false);
  }, [currentIndex, sentences]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoPlayRef.current) return;
    const sentence = sentences[currentIndex];
    if (!sentence || !playerHandle.current) return;
    const t = setTimeout(() => {
      if (!playerHandle.current) return;
      playerHandle.current.seekTo(sentence.start_time);
      playerHandle.current.play();
      setIsVideoPlaying(true);
      setPhase('playing');
      setPlayCount(1);
    }, 100);
    return () => clearTimeout(t);
  }, [currentIndex, sentences]);

  useEffect(() => {
    if (phase !== 'completed') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase, currentIndex]);

  useEffect(() => {
    segmentListRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const currentSentence = sentences[currentIndex];
  const totalSentences = sentences.length;
  const isLastSentence = currentIndex === totalSentences - 1;
  const latestResult = results.find((r) => r.sentenceIndex === currentIndex);
  const latestDiffCheck = serverResults.get(currentIndex) ?? null;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const submitMutation = useSubmitAnswer(sessionId);
  const completeMutation = useCompleteSession(sessionId);

  // ── Sentence verification ─────────────────────────────────────────────────
  const validateSentence = useCallback(
    (userInput: string, hintsUsedCount: number): Promise<SentenceResultResponse | null> => {
      const capturedIndex = currentIndex;
      return new Promise((resolve) => {
        setIsVerifying(true);
        submitMutation.mutate(
          {
            sentence_index: capturedIndex,
            user_input: userInput,
            hints_used: hintsUsedCount,
            replay_count: Math.max(0, playCount - 1),
          },
          {
            onSuccess: (result) => {
              setIsVerifying(false);
              if (!result) { resolve(null); return; }
              setServerResults((prev) =>
                new Map(prev).set(capturedIndex, {
                  ...result,
                  word_difficulty: result.word_difficulty ?? {},
                }),
              );
              resolve(result);
            },
            onError: (err) => {
              setIsVerifying(false);
              console.error(`[Dictation] Failed to verify sentence ${capturedIndex}:`, err);
              resolve(null);
            },
          },
        );
      });
    },
    [currentIndex, playCount, submitMutation],
  );

  const finalizeSentence = useCallback(
    (userInput: string, score: number) => {
      const capturedIndex = currentIndex;
      setResults((prev) => [
        ...prev.filter((r) => r.sentenceIndex !== capturedIndex),
        {
          sentenceIndex: capturedIndex,
          score,
          userInput,
          correctText: currentSentence?.text ?? '',
        },
      ]);
      setPhase('completed');
    },
    [currentIndex, currentSentence],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    if (!currentSentence || !playerHandle.current) return;
    autoPlayRef.current = true;
    playerHandle.current.seekTo(currentSentence.start_time);
    playerHandle.current.play();
    setIsVideoPlaying(true);
    setPhase('playing');
    setPlayCount((c) => c + 1);
  }, [currentSentence]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (sentences.length > 0) {
        const idx = findSegmentByTime(sentences, time);
        if (idx !== liveSegmentIdxRef.current) {
          liveSegmentIdxRef.current = idx;
          setLiveSegmentIdx(idx);
        }
      }
      if (currentSentence && time >= currentSentence.end_time) {
        playerHandle.current?.pause();
        setIsVideoPlaying(false);
        if (phase === 'playing') setPhase('practicing');
      }
    },
    [phase, currentSentence, sentences],
  );

  const handlePlayChange = useCallback(
    (playing: boolean) => {
      setIsVideoPlaying(playing);
      if (playing && phase !== 'playing') {
        if (currentSentence && playerHandle.current) {
          playerHandle.current.seekTo(currentSentence.start_time);
          autoPlayRef.current = true;
          setPhase('playing');
          setPlayCount((c) => c + 1);
        }
      }
      if (!playing && phase === 'playing') setPhase('practicing');
    },
    [phase, currentSentence],
  );

  const handleSubmit = useCallback(async () => {
    if (phase === 'completed' || isVerifying) return;
    const typed = inputValue.trim();
    if (!typed) return;
    const result = await validateSentence(typed, hintsUsed);
    if (!result) return;
    const isPerfectText = result.word_diffs.every((d) => d.status === 'correct');
    if (isPerfectText) {
      finalizeSentence(typed, Math.round(result.score * 100));
      return;
    }
    const offset = computeErrorCaretOffset(inputValue, result.word_diffs);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (offset === inputValue.length) return;
      try {
        el.setSelectionRange(offset, offset);
      } catch { /* best-effort */ }
    });
  }, [inputValue, hintsUsed, validateSentence, finalizeSentence, phase, isVerifying]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        handleNextRef.current();
      }
    },
    [handleSubmit],
  );

  const handleRevealHintWord = useCallback((index: number) => {
    setRevealedHintIndices((prev) => new Set(prev).add(index));
    setHintsUsed((h) => h + 1);
  }, []);

  const handleRevealAllHints = useCallback(() => {
    setAllHintsRevealed(true);
    setHintsUsed((h) => h + 1);
  }, []);

  const handleSkip = useCallback(async () => {
    if (isVerifying) return;
    const existingResult = results.find((r) => r.sentenceIndex === currentIndex);
    if (existingResult) {
      finalizeSentence(existingResult.userInput, existingResult.score);
      return;
    }
    setIsVerifying(true);
    submitMutation.mutate(
      {
        sentence_index: currentIndex,
        user_input: inputValue.trim(),
        hints_used: hintsUsed,
        replay_count: Math.max(0, playCount - 1),
        skipped: true,
      },
      {
        onSuccess: (result) => {
          setIsVerifying(false);
          if (result) {
            setServerResults((prev) => new Map(prev).set(currentIndex, result));
          }
          finalizeSentence('', 0);
        },
        onError: () => {
          setIsVerifying(false);
          finalizeSentence('', 0);
        },
      },
    );
  }, [inputValue, hintsUsed, currentIndex, submitMutation, finalizeSentence, isVerifying, results, playCount]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= totalSentences) {
      completeMutation.mutate();
      const totalScore =
        results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
          : 0;
      navigate(`/result/${videoId}`, {
        state: {
          video,
          results: results.map((r) => ({
            sentenceIndex: r.sentenceIndex,
            userInput: r.userInput,
            correctText: r.correctText,
            score: r.score,
            wordDiffs: serverResults.get(r.sentenceIndex)?.word_diffs ?? [],
          })),
          totalScore,
        },
      });
      return;
    }
    setCurrentIndex(next);
  }, [currentIndex, totalSentences, results, serverResults, navigate, videoId, video, completeMutation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  // ── Word popover handlers ──────────────────────────────────────────────────
  const handleWordPopover = useCallback(
    async (word: string, contextSentence: string, startTime: number, anchorEl: HTMLElement) => {
      if (sentenceSavedWords.has(word)) return;
      if (popoverWord === word) {
        setPopoverAnchorEl(null);
        setPopoverWord(null);
        return;
      }
      const reqId = ++popoverRequestId.current;
      setPopoverAnchorEl(anchorEl);
      setPopoverWord(word);
      setPopoverContext({ context: contextSentence, startTime });
      setPopoverPreview(null);
      setIsPopoverLoading(true);
      try {
        const result = await vocabularyService.previewWord(word, contextSentence);
        if (popoverRequestId.current !== reqId) return;
        setPopoverPreview(result);
      } catch (err) {
        if (popoverRequestId.current !== reqId) return;
        console.error('[Popover] Preview failed:', err);
      } finally {
        if (popoverRequestId.current === reqId) setIsPopoverLoading(false);
      }
    },
    [popoverWord, sentenceSavedWords],
  );

  const handleDismissPopover = useCallback(() => {
    setPopoverAnchorEl(null);
    setPopoverWord(null);
    setPopoverPreview(null);
  }, []);

  const handlePopoverSave = useCallback(async () => {
    if (!popoverWord || !popoverContext || isPopoverSaving) return;
    const wasSaved = popoverPreview?.is_saved ?? false;
    setIsPopoverSaving(true);
    try {
      await vocabularyService.saveWord({
        word: popoverWord.toLowerCase(),
        video_id: videoId!,
        context_sentence: popoverContext.context,
        audio_start_time: popoverContext.startTime,
        source: 'dictation',
        audio_url: popoverPreview?.audio_url ?? undefined,
        phonetic: popoverPreview?.phonetic ?? undefined,
        meaning: popoverPreview?.meaning ?? undefined,
        context_translation: popoverPreview?.context_translation ?? undefined,
        part_of_speech: popoverPreview?.part_of_speech ?? undefined,
      });
      setSentenceSavedWords((prev) => {
        const next = new Set(prev);
        next.add(cleanForSave(popoverWord));
        return next;
      });
      setPopoverPreview((p) => (p ? { ...p, is_saved: true } : p));
      void sentenceQueryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      toast.success(wasSaved ? 'Word updated with new context' : 'Word saved to flashcards');
    } catch (err) {
      console.error('[Popover] Save failed:', err);
      toast.error('Failed to save word');
    } finally {
      setIsPopoverSaving(false);
    }
  }, [popoverWord, popoverContext, popoverPreview, isPopoverSaving, videoId, sentenceQueryClient]);

  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  useEffect(() => {
    if (phase !== 'completed') return;
    const t = setTimeout(() => {
      if (autoNextRef.current) handleNextRef.current();
    }, 4000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (videoLoading || sentencesLoading) {
    return (
      <div className="flex items-center justify-center min-h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (videoError || !video) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">Video not found</p>
        <Link to="/library" className="text-sm text-muted-foreground underline">Back to Library</Link>
      </div>
    );
  }

  if (transcriptionStatus === 'pending' || transcriptionStatus === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-medium">Transcription in progress…</p>
        <p className="text-sm text-muted-foreground">This may take a minute. The page will update automatically.</p>
      </div>
    );
  }

  if (transcriptionStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">Transcription failed</p>
        <p className="text-sm text-muted-foreground">Please try re-importing this video.</p>
        <Link to="/library" className="text-sm text-muted-foreground underline">Back to Library</Link>
      </div>
    );
  }

  if (!sentences.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No transcript available</p>
        <Link to="/library" className="text-sm text-muted-foreground underline">Back to Library</Link>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Starting session…</span>
      </div>
    );
  }

  const effectiveMode: PracticeMode = practiceMode ?? sessionData.practice_mode ?? 'sentence';
  if (effectiveMode === 'cloze') {
    return (
      <ClozeMode
        video={video}
        videoId={videoId!}
        sessionId={sessionId}
        difficulty={clozeDifficulty}
        playerHandle={playerHandle}
        onCompleted={() => completeMutation.mutate()}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── HEADER — 44px ── */}
      <header className="shrink-0 h-14 border-b border-border bg-card/95 backdrop-blur flex items-center gap-3 px-4 z-10">
        <Link
          to="/library"
          className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary-soft transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-bold truncate flex-1 min-w-0">{video.title}</h1>
        <button
          onClick={() => setFeedback({})}
          title="Report a transcript issue for this video"
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-primary-soft transition-colors shrink-0"
        >
          <MessageSquareWarning className="h-4 w-4" />
          Report issue
        </button>
        <span className="text-sm font-bold text-primary-hover bg-primary-soft px-3 py-1.5 rounded-lg tabular-nums shrink-0">
          {currentIndex + 1}/{totalSentences}
        </span>

      </header>

      {/* ── BODY — main + right panel ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── CENTER — main practice area ── */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-2.5">

            {/* Video player — height-capped so controls + input stay on screen */}
            <div className="mx-auto w-full max-w-[min(100%,calc((100dvh-21rem)*16/9))] rounded-[18px] overflow-hidden border border-border bg-card shadow-soft shrink-0">
              <YoutubePlayer
                ref={playerHandle}
                videoId={video.youtube_id}
                endTime={currentSentence?.end_time ?? null}
                onTimeUpdate={handleTimeUpdate}
                onPlayChange={handlePlayChange}
              />
            </div>

            {/* Play controls bar */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2.5 shadow-soft">
              <div className="flex items-center gap-2">
                {isVideoPlaying && phase !== 'playing' ? (
                  <button
                    onClick={() => { playerHandle.current?.pause(); }}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-primary-soft text-primary-hover hover:bg-primary-light/30 transition-all active:scale-95"
                  >
                    <Pause className="h-4 w-4 fill-current" /> Pause
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    disabled={phase === 'playing'}
                    className={cn(
                      'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-all',
                      phase === 'playing'
                        ? 'bg-primary-soft text-primary cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm active:scale-95',
                    )}
                  >
                    {phase === 'playing' ? (
                      <><span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Playing…</>
                    ) : playCount === 0 ? (
                      <><Play className="h-4 w-4 fill-current" /> Play</>
                    ) : (
                      <><RotateCcw className="h-4 w-4" /> Replay</>
                    )}
                  </button>
                )}

                {/* Prev / Next */}
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary-soft disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={handleNext}
                  title="Next sentence (Tab)"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary-soft transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Auto-Next toggle */}
              <button
                onClick={toggleAutoNext}
                title={autoNext ? 'Auto-Next: On' : 'Auto-Next: Off'}
                className={cn(
                  'flex items-center gap-2 h-9 px-3 text-xs font-semibold rounded-xl border transition-colors',
                  autoNext
                    ? 'border-primary/40 bg-primary-soft text-primary-hover'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-primary-soft',
                )}
              >
                <span>Auto</span>
                <span className={cn(
                  'relative inline-flex h-4 w-7 rounded-full transition-colors duration-200',
                  autoNext ? 'bg-primary' : 'bg-muted-foreground/30',
                )}>
                  <span className={cn(
                    'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200',
                    autoNext ? 'translate-x-3.5' : 'translate-x-0.5',
                  )} />
                </span>
              </button>
            </div>

            {/* Compact typing panel */}
            {phase !== 'completed' && (
              <DictationInputPanel
                isVerifying={isVerifying}
                currentSentence={currentSentence}
                videoId={videoId}
                savedWords={sentenceSavedWords}
                previewingWord={popoverWord}
                inputRef={inputRef}
                inputValue={inputValue}
                latestDiffCheck={latestDiffCheck}
                onInputChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onSkip={handleSkip}
                onSubmit={handleSubmit}
                onWordClick={handleWordPopover}
              />
            )}

            {/* Hint bar */}
            {phase !== 'completed' && currentSentence && (
              <DottedHintBar
                sentence={currentSentence.text}
                revealedIndices={revealedHintIndices}
                onRevealWord={handleRevealHintWord}
                onRevealAll={handleRevealAllHints}
                allRevealed={allHintsRevealed}
              />
            )}

            {/* Segment-level transcript feedback */}
            {currentSentence && (
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    setFeedback({ transcriptId: currentSentence.id, segmentText: currentSentence.text })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageSquareWarning className="h-3.5 w-3.5" />
                  Report issue with this segment
                </button>
              </div>
            )}

            {/* Completed result */}
            {phase === 'completed' && latestResult && (
              <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'inline-flex items-center text-base font-bold px-3 py-1.5 rounded-lg animate-in zoom-in-90 duration-200',
                    latestResult.score >= 80 ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
                      : latestResult.score >= 50 ? 'bg-[color:var(--badge-warning)]/15 text-[color:var(--badge-warning)]'
                      : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
                  )}>
                    {latestResult.score}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {latestResult.score >= 90 ? 'Excellent!' : latestResult.score >= 70 ? 'Good job' : 'Keep practicing'}
                  </span>
                  <Button onClick={handleNext} size="default" className="ml-auto gap-1.5 text-sm font-bold transition-all duration-200 ease-in-out active:scale-95">
                    {isLastSentence ? (
                      <><Trophy className="h-4 w-4" /> Results</>
                    ) : (
                      <>Next <ChevronRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </div>

                {/* WordSavePanel */}
                {currentSentence && videoId && (
                  <WordSavePanel
                    text={latestDiffCheck?.original_text || currentSentence.text}
                    videoId={latestDiffCheck?.video_id || videoId}
                    audioStartTime={latestDiffCheck?.audio_start_time || currentSentence.start_time}
                    wordDifficulty={latestDiffCheck?.word_difficulty ?? {}}
                    diffs={latestDiffCheck?.word_diffs}
                    savedWords={sentenceSavedWords}
                    previewingWord={popoverWord}
                    onWordClick={handleWordPopover}
                  />
                )}

                {/* Translation */}
                {currentSentence?.translation && (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setShowTranslation((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-primary-soft/60 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Languages className="h-4 w-4" />
                        Translation
                      </span>
                      <ChevronDown className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform duration-200',
                        (showTranslation || latestResult.score < 70) && 'rotate-180',
                      )} />
                    </button>
                    {(showTranslation || latestResult.score < 70) && (
                      <div className="px-3 py-2.5 bg-muted/20 border-t border-border animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-sm leading-relaxed text-muted-foreground italic">
                          {currentSentence.translation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>

        {/* ── RIGHT PANEL — sentence list (desktop only) ── */}
        <aside className="hidden lg:flex flex-col w-[340px] shrink-0 border-l border-border bg-card min-h-0">
          {/* Panel header */}
          <div className="shrink-0 px-4 py-3 border-b border-border bg-card flex items-center justify-between">
            <span className="text-sm font-bold">Sentences</span>
            <span className="text-xs text-muted-foreground tabular-nums font-medium">
              {currentIndex + 1}/{totalSentences}
            </span>
          </div>
          {/* Progress indicator */}
          <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {totalSentences > 0 ? Math.round((results.length / totalSentences) * 100) : 0}%
            </span>
          </div>
          <div className="shrink-0 h-1.5 bg-primary-soft">
            <div
              className="h-full bg-primary rounded-lg transition-all duration-500 ease-in-out"
              style={{ width: `${totalSentences > 0 ? (results.length / totalSentences) * 100 : 0}%` }}
            />
          </div>
          {/* Scrollable card list */}
          <div ref={segmentListRef} className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-stable">
            {sentences.map((seg, i) => {
              const result = results.find((r) => r.sentenceIndex === i);
              const isActive = i === currentIndex;
              const isDone = !!result;
              const isLive = i === liveSegmentIdx && !isActive;

              return (
                <div
                  key={seg.id}
                  data-active={isActive}
                  data-live={isLive}
                  onClick={() => !isActive && setCurrentIndex(i)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 transition-all duration-200 ease-in-out cursor-pointer',
                    isActive && 'bg-primary-soft border-primary-light ring-1 ring-primary/20 shadow-soft',
                    isLive && !isActive && 'bg-accent-blue/10 border-accent-blue/40',
                    isDone && !isActive && 'border-border bg-card hover:bg-primary-soft/40',
                    !isDone && !isActive && !isLive && 'border-border/50 bg-muted/20 opacity-60 hover:opacity-85',
                  )}
                >
                  {/* Meta row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="shrink-0 w-4.5 h-4.5 flex items-center justify-center">
                      {isDone ? (
                        result!.score >= 80 ? (
                          <CheckCircle2 className="h-4.5 w-4.5 text-[color:var(--badge-success)]" />
                        ) : result!.score >= 50 ? (
                          <MinusCircle className="h-4.5 w-4.5 text-[color:var(--badge-warning)]" />
                        ) : (
                          <XCircle className="h-4.5 w-4.5 text-[color:var(--badge-danger)]" />
                        )
                      ) : isActive ? (
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      ) : isLive ? (
                        <span className="h-2 w-2 rounded-full bg-accent-blue animate-pulse" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                      )}
                    </span>
                    <span className={cn(
                      'text-sm font-semibold tabular-nums',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}>
                      #{i + 1}
                    </span>
                    {isActive && !isDone && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                        Current
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                      {formatTime(seg.start_time)}
                    </span>
                    {isDone && (
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-lg',
                        result!.score >= 80 ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
                          : result!.score >= 50 ? 'bg-[color:var(--badge-warning)]/15 text-[color:var(--badge-warning)]'
                          : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
                      )}>
                        {Math.round(result!.score)}%
                      </span>
                    )}
                  </div>
                  {/* Sentence text */}
                  <p className={cn(
                    'text-xs leading-snug line-clamp-2',
                    isDone ? 'text-foreground' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}>
                    {isDone ? seg.text : seg.text.replace(/\S/g, '·')}
                  </p>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* ── MOBILE: bottom bar ── */}
      <div className="lg:hidden shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {results.length}/{totalSentences} completed
        </span>
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition-colors">
              <List className="h-4 w-4" /> Sentences
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] p-0 rounded-t-3xl">
            <SheetHeader className="px-4 pt-3 pb-2 border-b border-border">
              <SheetTitle className="text-sm">Sentences — {results.length}/{totalSentences}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-2">
              {sentences.map((seg, i) => {
                const result = results.find((r) => r.sentenceIndex === i);
                const isActive = i === currentIndex;
                const isDone = !!result;
                return (
                  <button
                    key={seg.id}
                    onClick={() => setCurrentIndex(i)}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 mb-1.5 text-left transition-all duration-200',
                      isActive && 'bg-primary/5 border-primary/40 ring-1 ring-primary/20',
                      isDone && !isActive && 'border-border bg-card',
                      !isDone && !isActive && 'border-border/50 bg-muted/20 opacity-50',
                      !isActive && 'hover:border-primary/20',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-sm font-semibold tabular-nums',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}>
                        #{i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                        {formatTime(seg.start_time)}
                      </span>
                      {isDone && result && (
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-lg',
                          result.score >= 80 ? 'bg-[color:var(--badge-success)]/15 text-[color:var(--badge-success)]'
                            : result.score >= 50 ? 'bg-[color:var(--badge-warning)]/15 text-[color:var(--badge-warning)]'
                            : 'bg-[color:var(--badge-danger)]/15 text-[color:var(--badge-danger)]',
                        )}>
                          {Math.round(result.score)}%
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-sm leading-relaxed line-clamp-2',
                      isDone ? 'text-foreground' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                    )}>
                      {isDone ? seg.text : seg.text.replace(/\S/g, '·')}
                    </p>
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Floating word popover */}
      {popoverWord && (
        <WordPopover
          anchorEl={popoverAnchorEl}
          word={popoverWord}
          preview={popoverPreview}
          isLoading={isPopoverLoading}
          isSaved={sentenceSavedWords.has(popoverWord)}
          isSaving={isPopoverSaving}
          onSave={handlePopoverSave}
          onPlayAudio={() => {}}
          onDismiss={handleDismissPopover}
        />
      )}

      {/* Transcript feedback (video- or segment-level) */}
      {videoId && feedback && (
        <TranscriptFeedbackDialog
          videoId={videoId}
          transcriptId={feedback.transcriptId}
          segmentText={feedback.segmentText}
          open={Boolean(feedback)}
          onOpenChange={(open) => !open && setFeedback(null)}
        />
      )}
    </div>
  );
}
