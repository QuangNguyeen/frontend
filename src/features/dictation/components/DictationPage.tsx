import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, RotateCcw, Play, Pause,
  ChevronLeft, ChevronRight, ChevronDown, Eye, Trophy,
  Loader2, AlertCircle, CheckCircle2, XCircle,
  MinusCircle, Clock, Languages, GripVertical,
} from 'lucide-react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { YoutubePlayer } from './YoutubePlayer';
import type { YoutubePlayerHandle } from './YoutubePlayer';
import { usePlayerPrefsStore } from '../hooks/usePlayerPrefsStore';
import { useDictationSession, useSubmitAnswer, useCompleteSession } from '../hooks/useDictation';
import { useVideo, useVideoTranscripts } from '@/features/library/hooks/useVideos';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  PracticeMode, SentenceResultResponse, TranscriptResponse, WordDiffItem,
} from '@/shared/types/api';
import { WordSavePanel } from './WordSavePanel';
import { DictationSetup } from './DictationSetup';
// import { ClozeView } from './ClozeView';
import { FullClozeView } from './FullClozeView';
import { WordPreviewCard } from './WordPreviewCard';
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
  /** Provisional 0 until server responds with real score */
  score: number;
  userInput: string;
  correctText: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Binary search: returns the index of the segment containing `time`,
 * or -1 if no segment covers that timestamp.
 */
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

// ─── Caret-focus helper ───────────────────────────────────────────────────────

/**
 * Given the user's typed string and the server's word_diffs array, return
 * the character offset in the user string just after their FIRST mistake
 * word. Used to re-focus the textarea so the caret sits exactly where the
 * user needs to fix their input.
 *
 * Mapping rules (consistent with the backend SequenceMatcher opcodes):
 *   - 'correct' / 'wrong' / 'extra' each consume one user word.
 *   - 'missing' consumes zero user words (it's a gap in the user string).
 *
 * If the first error is 'missing', the caret lands at the end of the last
 * correctly-typed word before the gap — the natural spot to start typing
 * the forgotten word.
 */
function computeErrorCaretOffset(userText: string, diffs: WordDiffItem[]): number {
  // No errors at all → cursor at end.
  if (diffs.every((d) => d.status === 'correct')) return userText.length;

  // "Trailing missing" case: the user typed correctly so far but just hasn't
  // finished. Detect by finding the last diff that corresponds to a user-typed
  // word (i.e. not 'missing') and checking that every diff up to and including
  // it is 'correct'. Any trailing 'missing' entries are words yet to be typed,
  // so we leave the caret at the end.
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

  // Inline error: find the first real mistake. Prefer wrong/extra (the user
  // actually typed something incorrect), falling back to an inline 'missing'
  // (a word skipped mid-sentence, where the caret should land after the
  // previous correctly-typed word).
  let firstErrIdx = diffs.findIndex(
    (d) => d.status === 'wrong' || d.status === 'extra',
  );
  if (firstErrIdx === -1) {
    firstErrIdx = diffs.findIndex((d) => d.status === 'missing');
  }
  if (firstErrIdx === -1) return userText.length;

  // Count how many user-typed words to skip before landing the caret.
  // 'correct' / 'wrong' / 'extra' each consume one user word; 'missing' does not.
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


// ─── Main Component ───────────────────────────────────────────────────────────

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isDesktop;
}


/**
 * Full-transcript cloze layout — continuous reading with inline blanks.
 * Video plays continuously (no endTime gating). Active line highlights
 * based on current playback time.
 */
function ClozeMode({
  video,
  videoId,
  sessionId,
  difficulty,
  playerHandle,
  onCompleted,
}: {
  video: { title: string; youtube_id: string };
  videoId: string;
  sessionId: string | null;
  difficulty: ClozeDifficulty;
  playerHandle: React.RefObject<YoutubePlayerHandle | null>;
  onCompleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(0);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<{ word: string; context: string; startTime: number } | null>(null);
  const [previewResult, setPreviewResult] = useState<WordPreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSavingWord, setIsSavingWord] = useState(false);
  const previewRequestId = useRef(0);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleTimeSeek = useCallback((timeSec: number) => {
    if (!playerHandle.current) return;
    playerHandle.current.seekTo(timeSec);
    playerHandle.current.play();
  }, [playerHandle]);

  const handleCompleted = useCallback(() => {
    onCompleted();
  }, [onCompleted]);

  const handleWordClick = useCallback(async (word: string, contextSentence: string, audioStartTime: number) => {
    if (savedWords.has(word)) return;
    const requestId = ++previewRequestId.current;
    setPreviewData({ word, context: contextSentence, startTime: audioStartTime });
    setPreviewResult(null);
    setIsPreviewLoading(true);
    try {
      const result = await vocabularyService.previewWord(word, contextSentence);
      if (previewRequestId.current !== requestId) return;
      setPreviewResult(result);
    } catch (err) {
      if (previewRequestId.current !== requestId) return;
      console.error('[ClozeMode] Preview fetch failed:', err);
    } finally {
      if (previewRequestId.current === requestId) {
        setIsPreviewLoading(false);
      }
    }
  }, [savedWords]);

  const handleSaveFromPreview = useCallback(async () => {
    if (!previewData || isSavingWord) return;
    const wasSaved = previewResult?.is_saved ?? false;
    setIsSavingWord(true);
    try {
      await vocabularyService.saveWord({
        word: previewData.word.toLowerCase(),
        video_id: videoId,
        context_sentence: previewData.context,
        audio_start_time: previewData.startTime,
        source: 'cloze',
        audio_url: previewResult?.audio_url ?? undefined,
        phonetic: previewResult?.phonetic ?? undefined,
        meaning: previewResult?.meaning ?? undefined,
        context_translation: previewResult?.context_translation ?? undefined,
        part_of_speech: previewResult?.part_of_speech ?? undefined,
      });
      setSavedWords(prev => {
        const next = new Set(prev);
        next.add(cleanForSave(previewData.word));
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      toast.success(wasSaved ? 'Word updated with new context' : 'Word saved to flashcards');
      setPreviewData(null);
      setPreviewResult(null);
    } catch (err) {
      console.error('[ClozeMode] Word save failed:', err);
      toast.error('Failed to save word');
    } finally {
      setIsSavingWord(false);
    }
  }, [previewData, previewResult, isSavingWord, videoId, queryClient]);

  const handleDismissPreview = useCallback(() => {
    setPreviewData(null);
    setPreviewResult(null);
  }, []);

  const handleRetry = useCallback(() => {
    playerHandle.current?.pause();
    playerHandle.current?.seekTo(0);
    setPreviewData(null);
    setPreviewResult(null);
  }, [playerHandle]);

  // Auto-play on mount
  useEffect(() => {
    if (!sessionId || !playerHandle.current) return;
    const t = setTimeout(() => {
      playerHandle.current?.seekTo(0);
      playerHandle.current?.play();
    }, 500);
    return () => clearTimeout(t);
  }, [sessionId, playerHandle]);

  const difficultyLabel = difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Medium';

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Compact header */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Link
          to="/library"
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
              Cloze
            </p>
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {difficultyLabel}
            </span>
          </div>
          <h1 className="text-sm font-semibold tracking-tight truncate">
            {video.title}
          </h1>
        </div>
      </header>

      {/* Content — video left (4 cols), transcript right (8 cols) */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 py-4 max-w-[1400px] mx-auto">
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            <div className="lg:col-span-4 lg:sticky lg:top-4 self-start">
              <div className="rounded-xl overflow-hidden border border-border shadow-soft bg-card">
                <YoutubePlayer
                  ref={playerHandle}
                  videoId={video.youtube_id}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayChange={() => {}}
                />
              </div>
              {previewData && (
                <WordPreviewCard
                  word={previewData.word}
                  preview={previewResult}
                  isLoading={isPreviewLoading}
                  isSaving={isSavingWord}
                  onSave={handleSaveFromPreview}
                  onDismiss={handleDismissPreview}
                />
              )}
            </div>

            <div className="lg:col-span-8 min-w-0 flex flex-col min-h-0">
              <FullClozeView
                sessionId={sessionId}
                videoId={videoId}
                difficulty={difficulty}
                currentTime={currentTime}
                onTimeSeek={handleTimeSeek}
                onCompleted={handleCompleted}
                savedWords={savedWords}
                previewingWord={previewData?.word ?? null}
                onWordClick={handleWordClick}
                onRetry={handleRetry}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DictationPage() {
  const isDesktop = useIsDesktop();
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();

  const playerHandle = useRef<YoutubePlayerHandle>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const segmentListRef = useRef<HTMLDivElement>(null);
  /** Ref mirror of liveSegmentIdx — avoids stale closure in handleTimeUpdate. */
  const liveSegmentIdxRef = useRef(-1);
  const [liveSegmentIdx, setLiveSegmentIdx] = useState(-1);

  /**
   * After user presses Play once, autoPlayRef = true so subsequent sentences
   * play automatically on sentence switch.
   */
  const autoPlayRef = useRef(false);
  /**
   * Stable pointer to the latest handleNext. Used by the auto-advance effect
   * so the effect only depends on [phase] and never creates double-timeouts
   * due to handleNext reference churn.
   */
  const handleNextRef = useRef<() => void>(() => { });

  // ── Persisted user preferences ─────────────────────────────────────────────
  const autoNext = usePlayerPrefsStore((s) => s.autoNext);
  const toggleAutoNext = usePlayerPrefsStore((s) => s.toggleAutoNext);
  /** Ref mirror of autoNext — lets auto-advance effect read the latest value
   *  without being in its dependency array (avoids retriggering on toggle). */
  const autoNextRef = useRef(autoNext);
  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);

  // ── API state ──────────────────────────────────────────────────────────────
  /** Null until the user picks a mode on the setup screen. */
  const [practiceMode, setPracticeMode] = useState<PracticeMode | null>(null);
  const [clozeDifficulty, setClozeDifficulty] = useState<ClozeDifficulty>('medium');
  const { sessionId, sessionData } = useDictationSession(videoId, practiceMode);
  const [currentIndex, setCurrentIndex] = useState(0);
  /** Whether we've already applied the resume index from sessionData */
  const resumeAppliedRef = useRef(false);
  /**
   * Results are added IMMEDIATELY when a sentence is completed locally.
   * We do NOT wait for the server response before showing results or advancing.
   * The background mutation updates the score field once the server responds.
   */
  const [results, setResults] = useState<LocalResult[]>([]);
  /** Server results keyed by sentence index — has word_diffs + word_difficulty. */
  const [serverResults, setServerResults] = useState<Map<number, SentenceResultResponse>>(new Map());

  // ── Practice state ─────────────────────────────────────────────────────────
  /** Freeform text the user has typed for the current sentence. */
  const [inputValue, setInputValue] = useState('');
  /** Incremented each time the user clicks "Show Hint" — passed to the backend. */
  const [hintsUsed, setHintsUsed] = useState(0);
  /** When true, the full transcript is revealed inline as a hint. */
  const [showHint, setShowHint] = useState(false);
  /** True while a submit request is in-flight to the backend. */
  const [isVerifying, setIsVerifying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');

  // ── Player state ───────────────────────────────────────────────────────────
  const [playCount, setPlayCount] = useState(0);

  // ── Word preview state (sentence mode) ────────────────────────────────────
  const sentenceQueryClient = useQueryClient();
  const [sentenceSavedWords, setSentenceSavedWords] = useState<Set<string>>(new Set());
  const [sentencePreviewData, setSentencePreviewData] = useState<{ word: string; context: string; startTime: number } | null>(null);
  const [sentencePreviewResult, setSentencePreviewResult] = useState<WordPreviewResponse | null>(null);
  const [isSentencePreviewLoading, setIsSentencePreviewLoading] = useState(false);
  const [isSentenceSavingWord, setIsSentenceSavingWord] = useState(false);
  const sentencePreviewRequestId = useRef(0);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: video, isLoading: videoLoading, isError: videoError } = useVideo(videoId);
  const { data: sentences = [], isLoading: sentencesLoading } = useVideoTranscripts(videoId);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Apply resume index from session data (runs once when session loads)
  useEffect(() => {
    if (
      !sessionData?.resumed ||
      resumeAppliedRef.current ||
      sentences.length === 0
    ) return;
    const idx = sessionData.current_sentence_index ?? 0;
    if (idx > 0 && idx < sentences.length) {
      resumeAppliedRef.current = true;
      /* eslint-disable react-hooks/set-state-in-effect */
      setCurrentIndex(idx);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [sessionData, sentences]);

  // Hydrate previous results from resumed session so segment list shows
  // scores/icons and running average is correct immediately.
  useEffect(() => {
    if (
      !sessionData?.resumed ||
      !sessionData.sentence_results?.length ||
      results.length > 0  // already hydrated or user started practicing
    ) return;

    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [sessionData, videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset all practice state when the active sentence changes.
  // If the sentence was already completed (hydrated from resume or finished
  // earlier in this session), jump straight to 'completed' phase so the user
  // sees their prior score/diffs instead of an empty textarea.
  useEffect(() => {
    const sentence = sentences[currentIndex];
    if (!sentence) return;
    const alreadyDone = results.find((r) => r.sentenceIndex === currentIndex);
    /* eslint-disable react-hooks/set-state-in-effect */
    setInputValue('');
    setPhase(alreadyDone ? 'completed' : 'practicing');
    setPlayCount(0);
    setHintsUsed(0);
    setShowHint(false);
    setShowTranslation(false);
    setIsVerifying(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    // `results` is read inside but intentionally excluded from deps —
    // adding it would re-trigger the effect on every sentence completion.
  }, [currentIndex, sentences]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Auto-play when the active sentence changes — only triggers if the user has
   * already played at least once (autoPlayRef.current = true).
   */
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

  // Keep input focused while the user should be typing
  useEffect(() => {
    if (phase !== 'completed') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase, currentIndex]);

  // Scroll the active segment into view in the right panel
  useEffect(() => {
    segmentListRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const currentSentence = sentences[currentIndex];
  const totalSentences = sentences.length;
  const sentenceProgress = totalSentences > 0 ? (currentIndex / totalSentences) * 100 : 0;
  const isLastSentence = currentIndex === totalSentences - 1;
  const latestResult = results.find((r) => r.sentenceIndex === currentIndex);
  /** Server scoring result for the current sentence — drives the diff panel. */
  const latestDiffCheck = serverResults.get(currentIndex) ?? null;

  // ── Background scoring mutation ────────────────────────────────────────────
  // Fire-and-forget scoring hook — session may not exist yet, that's fine.
  const submitMutation = useSubmitAnswer(sessionId);
  const completeMutation = useCompleteSession(sessionId);

  // ── Sentence verification / completion ────────────────────────────────────
  /**
   * validateSentence hits the backend for scoring + diffing. It does NOT
   * transition phase — that's finalizeSentence's job. Safe to call multiple
   * times for the same sentence index (backend upserts per-sentence state).
   * Resolves with the server result so callers can branch on score.
   */
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

  /**
   * finalizeSentence locks in the score and flips phase → 'completed'.
   * Only called on perfect score (1.0) or when the user explicitly skips.
   */
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
      // Track live position in segment list regardless of phase
      if (sentences.length > 0) {
        const idx = findSegmentByTime(sentences, time);
        if (idx !== liveSegmentIdxRef.current) {
          liveSegmentIdxRef.current = idx;
          setLiveSegmentIdx(idx);
        }
      }
      // Always pause at the current sentence boundary
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
        // Native play button pressed — force guided play for the current sentence
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

  /**
   * Submit the typed sentence for verification.
   * - On perfect score (1.0) → finalize and advance.
   * - On partial score → stay in practicing, the unified diff panel appears
   *   above the textarea, the user's text is preserved, and the caret jumps
   *   to the end of the first mistake word so they can fix it in place.
   */
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
    // Partial: jump caret to the end of the first mistake word in the raw
    // input (we use inputValue, not typed, so leading whitespace offsets line up).
    // If the offset lands at the very end (e.g. "trailing missing" — user
    // simply hasn't finished typing yet), skip setSelectionRange entirely:
    // focus() alone preserves the caret's natural end-of-text position and
    // avoids a distracting jump.
    const offset = computeErrorCaretOffset(inputValue, result.word_diffs);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (offset === inputValue.length) return;
      try {
        el.setSelectionRange(offset, offset);
      } catch {
        /* some browsers throw on out-of-range — best-effort */
      }
    });
  }, [inputValue, hintsUsed, validateSentence, finalizeSentence, phase, isVerifying]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter submits; Shift+Enter inserts a newline (textarea default).
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

  /** Reveals the full transcript as a hint. Counts as one hint use. */
  const handleRevealHint = useCallback(() => {
    if (showHint) return;
    setShowHint(true);
    setHintsUsed((h) => h + 1);
  }, [showHint]);

  /**
   * Force-move past this sentence. Submits whatever the user has typed so the
   * attempt is recorded, then finalizes with the server score (0 on empty).
   */
  const handleSkip = useCallback(async () => {
    if (isVerifying) return;
    const typed = inputValue.trim();
    // If the sentence was already completed and the user hasn't typed
    // anything new, preserve the existing score instead of overwriting it
    // with a 0% empty-string submission.
    const existingResult = results.find((r) => r.sentenceIndex === currentIndex);
    if (existingResult && !typed) {
      finalizeSentence(existingResult.userInput, existingResult.score);
      return;
    }
    const result = await validateSentence(typed, hintsUsed);
    const score = result ? Math.round(result.score * 100) : 0;
    finalizeSentence(typed, score);
  }, [inputValue, hintsUsed, validateSentence, finalizeSentence, isVerifying, results, currentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= totalSentences) {
      // Explicitly mark session as completed (fire-and-forget safety net)
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
    if(showHint){
      setShowHint(false);
    }
  }

  // ── Word preview handlers (sentence mode) ─────────────────────────────────
  const handleSentenceWordClick = useCallback(async (word: string, contextSentence: string, audioStartTime: number) => {
    if (sentenceSavedWords.has(word)) return;
    const requestId = ++sentencePreviewRequestId.current;
    setSentencePreviewData({ word, context: contextSentence, startTime: audioStartTime });
    setSentencePreviewResult(null);
    setIsSentencePreviewLoading(true);
    try {
      const result = await vocabularyService.previewWord(word, contextSentence);
      if (sentencePreviewRequestId.current !== requestId) return;
      setSentencePreviewResult(result);
    } catch (err) {
      if (sentencePreviewRequestId.current !== requestId) return;
      console.error('[SentenceMode] Preview fetch failed:', err);
    } finally {
      if (sentencePreviewRequestId.current === requestId) {
        setIsSentencePreviewLoading(false);
      }
    }
  }, [sentenceSavedWords]);

  const handleSentenceSaveFromPreview = useCallback(async () => {
    if (!sentencePreviewData || isSentenceSavingWord) return;
    const wasSaved = sentencePreviewResult?.is_saved ?? false;
    setIsSentenceSavingWord(true);
    try {
      await vocabularyService.saveWord({
        word: sentencePreviewData.word.toLowerCase(),
        video_id: videoId!,
        context_sentence: sentencePreviewData.context,
        audio_start_time: sentencePreviewData.startTime,
        source: 'dictation',
        audio_url: sentencePreviewResult?.audio_url ?? undefined,
        phonetic: sentencePreviewResult?.phonetic ?? undefined,
        meaning: sentencePreviewResult?.meaning ?? undefined,
        context_translation: sentencePreviewResult?.context_translation ?? undefined,
        part_of_speech: sentencePreviewResult?.part_of_speech ?? undefined,
      });
      setSentenceSavedWords(prev => {
        const next = new Set(prev);
        next.add(cleanForSave(sentencePreviewData.word));
        return next;
      });
      void sentenceQueryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      toast.success(wasSaved ? 'Word updated with new context' : 'Word saved to flashcards');
      setSentencePreviewData(null);
      setSentencePreviewResult(null);
    } catch (err) {
      console.error('[SentenceMode] Word save failed:', err);
      toast.error('Failed to save word');
    } finally {
      setIsSentenceSavingWord(false);
    }
  }, [sentencePreviewData, sentencePreviewResult, isSentenceSavingWord, videoId, sentenceQueryClient]);

  const handleSentenceDismissPreview = useCallback(() => {
    setSentencePreviewData(null);
    setSentencePreviewResult(null);
  }, []);

  // Keep handleNextRef pointing at the latest handleNext without it being
  // a dep of the auto-advance effect (prevents double-trigger).
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  /**
   * Auto-advance effect.
   * Only depends on [phase] — fires exactly once when phase becomes 'completed'.
   * Reads handleNextRef/autoNextRef at call time so fresh values are used
   * without adding them as deps (avoids double-trigger on reference churn).
   */
  useEffect(() => {
    if (phase !== 'completed') return;
    const t = setTimeout(() => {
      // Check at callback time, not at setup — handles toggling off during the delay
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

  if (!sentences.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No transcript available</p>
        <Link to="/library" className="text-sm text-muted-foreground underline">Back to Library</Link>
      </div>
    );
  }

  // ── Setup gate ─────────────────────────────────────────────────────────────
  // Show the mode-picker until the user starts a session.
  if (!practiceMode) {
    return (
      <DictationSetup
        video={video}
        onStart={(mode, difficulty) => {
          setPracticeMode(mode);
          if (difficulty) setClozeDifficulty(difficulty);
        }}
      />
    );
  }

  // While the session is being created after the user clicks Start
  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-full gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Starting session…</span>
      </div>
    );
  }

  // ── Cloze branch ───────────────────────────────────────────────────────────
  // User's fresh pick takes priority (backend now resets on mode mismatch).
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

  // ── Derived: running average ────────────────────────────────────────────────
  const runningAverage = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Top bar ── */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center gap-3 z-10">
        <Link
          to="/library"
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Back to library"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-muted-foreground">
              Sentence
            </p>
          </div>
          <h1 className="text-sm font-semibold tracking-tight truncate">{video.title}</h1>
        </div>
      </header>

      {/* ── Body: 3-column resizable on lg, stacked on mobile ── */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden bg-muted/10">
        {isDesktop ? (
          <div className="h-full max-w-[1600px] mx-auto px-2 py-4">
            <Group autoSaveId="dictalearn-layout-v1" direction="horizontal" className="h-full">
              
              {/* COLUMN 1: Video (Default 25%) */}
              <Panel defaultSize={25} minSize={20} className="flex flex-col gap-4 overflow-y-auto pr-2 pb-2">
                <div className="rounded-xl overflow-hidden border border-border shadow-soft bg-card shrink-0">
                  <YoutubePlayer
                    ref={playerHandle}
                    videoId={video.youtube_id}
                    endTime={currentSentence?.end_time ?? null}
                    onTimeUpdate={handleTimeUpdate}
                    onPlayChange={handlePlayChange}
                  />
                </div>
                
                {/* Play controls */}
                <div className="flex items-center gap-2 justify-center shrink-0">
                  {isVideoPlaying && phase !== 'playing' ? (
                    <button
                      onClick={() => { playerHandle.current?.pause(); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95"
                    >
                      <Pause className="h-3.5 w-3.5 fill-current" /> Pause
                    </button>
                  ) : (
                    <button
                      onClick={handlePlay}
                      disabled={phase === 'playing'}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                        phase === 'playing'
                          ? 'bg-primary/10 text-primary cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-95',
                      )}
                    >
                      {phase === 'playing' ? (
                        <><span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Playing…</>
                      ) : playCount === 0 ? (
                        <><Play className="h-3.5 w-3.5 fill-current" /> Play Sentence</>
                      ) : (
                        <><RotateCcw className="h-3.5 w-3.5" /> Replay</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={toggleAutoNext}
                    title={autoNext ? 'Auto-Next: On — click to disable' : 'Auto-Next: Off — click to enable'}
                    className={cn(
                      'flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors',
                      autoNext
                        ? 'border-primary/40 bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <span>Auto</span>
                    <span className={cn(
                      'relative inline-flex h-5 w-9 rounded-full transition-colors duration-200',
                      autoNext ? 'bg-primary' : 'bg-muted-foreground/30',
                    )}>
                      <span className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                        autoNext ? 'translate-x-3.5' : 'translate-x-0.5',
                      )} />
                    </span>
                  </button>
                </div>

                {/* Word Preview Card dynamically appears here */}
                {sentencePreviewData && (
                  <div className="animate-in slide-in-from-top-2 fade-in shrink-0">
                    <WordPreviewCard
                      word={sentencePreviewData.word}
                      preview={sentencePreviewResult}
                      isLoading={isSentencePreviewLoading}
                      isSaving={isSentenceSavingWord}
                      onSave={handleSentenceSaveFromPreview}
                      onDismiss={handleSentenceDismissPreview}
                    />
                  </div>
                )}
              </Panel>

              {/* RESIZER 1 */}
              <Separator className="w-2 flex items-center justify-center group hover:bg-primary/20 transition-colors cursor-col-resize rounded-full mx-1">
                <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </Separator>

              {/* COLUMN 2: Input Area (Default 50%) */}
              <Panel defaultSize={50} minSize={35} className="flex flex-col min-w-0 px-2 overflow-y-auto pb-2">
                <div className={cn(
                  'bg-card rounded-xl border shadow-soft p-5 sm:p-6 flex flex-col gap-5 transition-colors duration-500 min-h-full',
                  phase === 'completed' ? 'border-green-300 bg-green-50/30' : 'border-border'
                )}>
                  {/* Status bar */}
                  <div className="flex items-center justify-between pb-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-semibold">
                        Sentence {currentIndex + 1} <span className="text-muted-foreground font-normal">of {totalSentences}</span>
                      </span>
                      <button
                        onClick={handleNext}
                        title="Next sentence (Tab)"
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {results.length > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Avg <span className="font-semibold text-foreground">{runningAverage}%</span>
                        </span>
                      )}
                      {/* Progress bar */}
                      <div className="hidden sm:block w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/50 transition-all duration-500 rounded-full"
                          style={{ width: `${sentenceProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Phase: practicing / playing */}
                  {phase !== 'completed' && (
                    <div className="flex flex-col gap-4">
                      {/* Live feedback */}
                      {latestDiffCheck && !latestDiffCheck.word_diffs.every((d) => d.status === 'correct') && currentSentence && videoId && (
                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200 shrink-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-medium text-amber-700">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Not quite — fix the highlighted word and press Enter again
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {Math.round(latestDiffCheck.score * 100)}% · {latestDiffCheck.correct_count}/
                              {latestDiffCheck.word_diffs.filter((d) => d.status !== 'extra').length}
                            </span>
                          </div>
                          <WordSavePanel
                            text={latestDiffCheck.original_text || currentSentence.text}
                            videoId={latestDiffCheck.video_id || videoId}
                            audioStartTime={latestDiffCheck.audio_start_time || currentSentence.start_time}
                            wordDifficulty={latestDiffCheck.word_difficulty ?? {}}
                            diffs={latestDiffCheck.word_diffs}
                            savedWords={sentenceSavedWords}
                            previewingWord={sentencePreviewData?.word ?? null}
                            onWordClick={handleSentenceWordClick}
                          />
                        </div>
                      )}

                      {/* Textarea */}
                      <div className={cn(
                        'flex items-start gap-3 rounded-2xl border-2 px-4 py-4 transition-all duration-200 bg-background shadow-sm shrink-0',
                        isVerifying
                          ? 'border-muted-foreground/30 ring-4 ring-muted/30'
                          : 'border-primary ring-4 ring-primary/10',
                      )}>
                        <textarea
                          ref={inputRef}
                          value={inputValue}
                          onChange={handleInputChange}
                          onKeyDown={handleKeyDown}
                          placeholder="Type what you hear…"
                          rows={4}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          disabled={isVerifying}
                          className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed disabled:opacity-60"
                        />
                        {inputValue && !isVerifying && (
                          <kbd className="shrink-0 mt-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                            ↵
                          </kbd>
                        )}
                        {isVerifying && (
                          <Loader2 className="shrink-0 mt-1 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {/* Hint */}
                      {showHint && currentSentence && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 shrink-0">
                          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
                            Hint
                          </p>
                          <p className="text-sm leading-relaxed text-amber-900">
                            {currentSentence.text}
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={handleRevealHint}
                          disabled={showHint}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {showHint ? 'Hint shown' : 'Show Hint'}
                          {hintsUsed > 0 && (
                            <span className="ml-0.5 text-[10px] bg-muted px-1 rounded">
                              {hintsUsed}
                            </span>
                          )}
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={handleSkip}
                          disabled={isVerifying}
                          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                        >
                          Skip sentence
                        </button>
                        <Button
                          size="sm"
                          onClick={handleSubmit}
                          disabled={!inputValue.trim() || isVerifying}
                          className="gap-1.5 rounded-xl min-w-24"
                        >
                          {isVerifying ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</>
                          ) : latestDiffCheck && !latestDiffCheck.word_diffs.every((d) => d.status === 'correct') ? (
                            'Retry'
                          ) : (
                            'Submit'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Phase: completed */}
                  {phase === 'completed' && latestResult && (
                    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* Score banner */}
                      <div className={cn(
                        'flex items-center justify-between px-5 py-4 rounded-xl border',
                        latestResult.score >= 80 ? 'bg-green-50 border-green-200' :
                          latestResult.score >= 50 ? 'bg-yellow-50 border-yellow-200' :
                            'bg-red-50 border-red-200',
                      )}>
                        <div className="flex items-center gap-2">
                          {latestResult.score >= 80 ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : latestResult.score >= 50 ? (
                            <MinusCircle className="h-5 w-5 text-yellow-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className={cn(
                            'text-base font-semibold',
                            latestResult.score >= 80 ? 'text-green-800' :
                              latestResult.score >= 50 ? 'text-yellow-800' : 'text-red-800',
                          )}>
                            {latestResult.score >= 80 ? 'Excellent!'
                              : latestResult.score >= 50 ? 'Good effort!'
                                : 'Keep practicing!'}
                          </span>
                          {latestDiffCheck && latestDiffCheck.wrong_count + latestDiffCheck.missing_count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({latestDiffCheck.wrong_count + latestDiffCheck.missing_count} {latestDiffCheck.wrong_count + latestDiffCheck.missing_count === 1 ? 'mistake' : 'mistakes'})
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          'text-2xl font-bold tabular-nums',
                          latestResult.score >= 80 ? 'text-green-700' :
                            latestResult.score >= 50 ? 'text-yellow-700' : 'text-red-600',
                        )}>
                          {Math.round(latestResult.score)}%
                        </span>
                      </div>

                      {/* WordSavePanel ONLY (Preview is in Col 1) */}
                      {currentSentence && videoId && (
                        <WordSavePanel
                          text={latestDiffCheck?.original_text || currentSentence.text}
                          videoId={latestDiffCheck?.video_id || videoId}
                          audioStartTime={latestDiffCheck?.audio_start_time || currentSentence.start_time}
                          wordDifficulty={latestDiffCheck?.word_difficulty ?? {}}
                          diffs={latestDiffCheck?.word_diffs}
                          savedWords={sentenceSavedWords}
                          previewingWord={sentencePreviewData?.word ?? null}
                          onWordClick={handleSentenceWordClick}
                        />
                      )}

                      {/* Translation */}
                      {currentSentence?.translation && (
                        <div className="rounded-xl border border-border overflow-hidden">
                          <button
                            onClick={() => setShowTranslation((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
                          >
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <Languages className="h-4 w-4" />
                              Translation
                            </span>
                            <ChevronDown className={cn(
                              'h-4 w-4 text-muted-foreground transition-transform duration-200',
                              showTranslation && 'rotate-180',
                            )} />
                          </button>
                          {showTranslation && (
                            <div className="px-4 py-3 bg-muted/20 border-t border-border">
                              <p className="text-sm leading-relaxed text-muted-foreground italic">
                                {currentSentence.translation}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Next button */}
                      <div className="flex-1" />
                      <Button onClick={handleNext} className="w-full gap-2 rounded-xl h-12 text-base shrink-0 mt-4">
                        {isLastSentence ? (
                          <><Trophy className="h-4 w-4" /> See Final Results</>
                        ) : (
                          <>Next Sentence <ChevronRight className="h-4 w-4" /></>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>

              {/* RESIZER 2 */}
              <Separator className="w-2 flex items-center justify-center group hover:bg-primary/20 transition-colors cursor-col-resize rounded-full mx-1">
                <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </Separator>

              {/* COLUMN 3: Segments (Default 25%) */}
              <Panel defaultSize={25} minSize={15} className="flex flex-col pl-2 pb-2">
                <div className="flex flex-col bg-card border border-border rounded-xl overflow-hidden h-full">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0">
                    <p className="text-sm font-semibold">All Segments</p>
                    <p className="text-xs text-muted-foreground">{results.length} / {totalSentences} done</p>
                  </div>
                  <div ref={segmentListRef} className="flex-1 overflow-y-auto divide-y divide-border">
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
                            'flex items-start gap-2.5 px-4 py-2.5 transition-colors',
                            isActive && 'bg-primary/5 border-l-2 border-l-primary',
                            isLive && !isActive && 'bg-blue-50/50 dark:bg-blue-950/20',
                            !isActive && 'cursor-pointer hover:bg-muted/30 hover:opacity-100',
                            !isDone && !isActive && !isLive && 'opacity-50',
                          )}
                        >
                          <div className="shrink-0 mt-0.5">
                            {isDone ? (
                              result!.score >= 80 ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : result!.score >= 50 ? (
                                <MinusCircle className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )
                            ) : isActive ? (
                              <span className="h-4 w-4 flex items-center justify-center">
                                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                              </span>
                            ) : isLive ? (
                              <span className="h-4 w-4 flex items-center justify-center">
                                <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                              </span>
                            ) : (
                              <span className="h-4 w-4 flex items-center justify-center">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className={cn('text-xs font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}>
                                #{i + 1}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />{formatTime(seg.start_time)}
                              </span>
                              {isDone && (
                                <span className={cn(
                                  'text-xs font-bold px-1.5 py-0.5 rounded-full leading-none',
                                  result!.score >= 80 ? 'bg-green-100 text-green-700' :
                                    result!.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700',
                                )}>
                                  {Math.round(result!.score)}%
                                </span>
                              )}
                            </div>
                            <p className={cn(
                              'text-xs leading-snug line-clamp-2',
                              isDone ? 'text-foreground' : 'text-muted-foreground',
                            )}>
                              {isDone ? seg.text : seg.text.replace(/\S/g, '·')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>

            </Group>
          </div>
        ) : (
          /* Mobile Fallback */
          <div className="h-full px-4 py-4 overflow-y-auto">
            <div className="flex flex-col gap-4 pb-28 max-w-[800px] mx-auto">
              {/* VIDEO */}
              <div className="rounded-xl overflow-hidden border border-border shadow-soft bg-card shrink-0">
                <YoutubePlayer
                  ref={playerHandle}
                  videoId={video.youtube_id}
                  endTime={currentSentence?.end_time ?? null}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayChange={handlePlayChange}
                />
              </div>

              {/* CONTROLS */}
              <div className="flex items-center gap-2 justify-center shrink-0">
                {isVideoPlaying && phase !== 'playing' ? (
                  <button
                    onClick={() => { playerHandle.current?.pause(); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-all active:scale-95"
                  >
                    <Pause className="h-3.5 w-3.5 fill-current" /> Pause
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    disabled={phase === 'playing'}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                      phase === 'playing'
                        ? 'bg-primary/10 text-primary cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-95',
                    )}
                  >
                    {phase === 'playing' ? (
                      <><span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Playing…</>
                    ) : playCount === 0 ? (
                      <><Play className="h-3.5 w-3.5 fill-current" /> Play Sentence</>
                    ) : (
                      <><RotateCcw className="h-3.5 w-3.5" /> Replay</>
                    )}
                  </button>
                )}
              </div>

              {/* CENTER INTERACTION AREA */}
              <div className={cn(
                'bg-card rounded-xl border shadow-soft p-5 sm:p-6 flex flex-col gap-5 transition-colors duration-500',
                phase === 'completed' ? 'border-green-300 bg-green-50/30' : 'border-border'
              )}>
                {/* Status bar */}
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold">
                      Sentence {currentIndex + 1} <span className="text-muted-foreground font-normal">of {totalSentences}</span>
                    </span>
                    <button
                      onClick={handleNext}
                      title="Next sentence (Tab)"
                      className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Phase: completed */}
                {phase === 'completed' && latestResult && (
                  <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Score banner */}
                    <div className={cn(
                      'flex items-center justify-between px-5 py-4 rounded-xl border',
                      latestResult.score >= 80 ? 'bg-green-50 border-green-200' :
                        latestResult.score >= 50 ? 'bg-yellow-50 border-yellow-200' :
                          'bg-red-50 border-red-200',
                    )}>
                      <div className="flex items-center gap-2">
                        {latestResult.score >= 80 ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : latestResult.score >= 50 ? (
                          <MinusCircle className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className={cn(
                          'text-base font-semibold',
                          latestResult.score >= 80 ? 'text-green-800' :
                            latestResult.score >= 50 ? 'text-yellow-800' : 'text-red-800',
                        )}>
                          {latestResult.score >= 80 ? 'Excellent!'
                            : latestResult.score >= 50 ? 'Good effort!'
                              : 'Keep practicing!'}
                        </span>
                      </div>
                      <span className={cn(
                        'text-2xl font-bold tabular-nums',
                        latestResult.score >= 80 ? 'text-green-700' :
                          latestResult.score >= 50 ? 'text-yellow-700' : 'text-red-600',
                      )}>
                        {Math.round(latestResult.score)}%
                      </span>
                    </div>

                    {/* WordSavePanel + Preview inline for mobile */}
                    {currentSentence && videoId && (
                      <>
                        <WordSavePanel
                          text={latestDiffCheck?.original_text || currentSentence.text}
                          videoId={latestDiffCheck?.video_id || videoId}
                          audioStartTime={latestDiffCheck?.audio_start_time || currentSentence.start_time}
                          wordDifficulty={latestDiffCheck?.word_difficulty ?? {}}
                          diffs={latestDiffCheck?.word_diffs}
                          savedWords={sentenceSavedWords}
                          previewingWord={sentencePreviewData?.word ?? null}
                          onWordClick={handleSentenceWordClick}
                        />
                        {sentencePreviewData && (
                          <WordPreviewCard
                            word={sentencePreviewData.word}
                            preview={sentencePreviewResult}
                            isLoading={isSentencePreviewLoading}
                            isSaving={isSentenceSavingWord}
                            onSave={handleSentenceSaveFromPreview}
                            onDismiss={handleSentenceDismissPreview}
                          />
                        )}
                      </>
                    )}

                    {/* Translation */}
                    {currentSentence?.translation && (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <button
                          onClick={() => setShowTranslation((v) => !v)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
                        >
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Languages className="h-4 w-4" />
                            Translation
                          </span>
                          <ChevronDown className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform duration-200',
                            showTranslation && 'rotate-180',
                          )} />
                        </button>
                        {showTranslation && (
                          <div className="px-4 py-3 bg-muted/20 border-t border-border">
                            <p className="text-sm leading-relaxed text-muted-foreground italic">
                              {currentSentence.translation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <Button onClick={handleNext} className="w-full gap-2 rounded-xl h-12 text-base mt-4">
                      {isLastSentence ? (
                        <><Trophy className="h-4 w-4" /> See Final Results</>
                      ) : (
                        <>Next Sentence <ChevronRight className="h-4 w-4" /></>
                      )}
                    </Button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
{/* ── Mobile sticky input ── */}
      {phase !== 'completed' && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3 z-20 shadow-lg flex flex-col gap-2 max-h-[55%] overflow-y-auto">
          {latestDiffCheck && !latestDiffCheck.word_diffs.every((d) => d.status === 'correct') && currentSentence && videoId && (
            <>
              <WordSavePanel
                text={latestDiffCheck.original_text || currentSentence.text}
                videoId={latestDiffCheck.video_id || videoId}
                audioStartTime={latestDiffCheck.audio_start_time || currentSentence.start_time}
                wordDifficulty={latestDiffCheck.word_difficulty ?? {}}
                diffs={latestDiffCheck.word_diffs}
                savedWords={sentenceSavedWords}
                previewingWord={sentencePreviewData?.word ?? null}
                onWordClick={handleSentenceWordClick}
              />
              {sentencePreviewData && (
                <WordPreviewCard
                  word={sentencePreviewData.word}
                  preview={sentencePreviewResult}
                  isLoading={isSentencePreviewLoading}
                  isSaving={isSentenceSavingWord}
                  onSave={handleSentenceSaveFromPreview}
                  onDismiss={handleSentenceDismissPreview}
                />
              )}
            </>
          )}
          <div className={cn(
            'flex items-start gap-2 rounded-2xl border-2 px-3 py-2 bg-background ring-4',
            isVerifying
              ? 'border-muted-foreground/30 ring-muted/30'
              : 'border-primary ring-primary/10',
          )}>
            <textarea
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type what you hear…"
              rows={2}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={isVerifying}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/40 resize-none leading-snug disabled:opacity-60"
            />
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button
                onClick={handleRevealHint}
                disabled={showHint}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Show hint"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isVerifying}
                className="p-1.5 rounded-lg text-primary disabled:opacity-30"
                title="Submit (Enter)"
              >
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
