import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { YoutubePlayer } from './YoutubePlayer';
import type { YoutubePlayerHandle } from './YoutubePlayer';
import { FullClozeView } from './FullClozeView';
import { WordPopover } from './WordPopover';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';
import { vocabularyKeys } from '@/features/vocabulary/hooks/useVocabulary';
import { useQueryClient } from '@tanstack/react-query';
import { cleanForSave } from '../hooks/useWordSave';
import { toast } from 'sonner';
import type { ClozeDifficulty, WordPreviewResponse } from '@/shared/types/api';

interface ClozeModeProps {
  video: { title: string; youtube_id: string };
  videoId: string;
  sessionId: string | null;
  difficulty: ClozeDifficulty;
  playerHandle: React.RefObject<YoutubePlayerHandle | null>;
  onCompleted: () => void;
}

export function ClozeMode({
  video,
  videoId,
  sessionId,
  difficulty,
  playerHandle,
  onCompleted,
}: ClozeModeProps) {
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(0);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<{ word: string; context: string; startTime: number } | null>(null);
  const [previewResult, setPreviewResult] = useState<WordPreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSavingWord, setIsSavingWord] = useState(false);
  const previewRequestId = useRef(0);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);

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

  const handleWordClick = useCallback(async (word: string, contextSentence: string, audioStartTime: number, anchorEl?: HTMLElement) => {
    if (savedWords.has(word)) return;
    // Toggle off if same word clicked
    if (previewData?.word === word) {
      setPopoverAnchorEl(null);
      setPreviewData(null);
      setPreviewResult(null);
      return;
    }
    const requestId = ++previewRequestId.current;
    setPopoverAnchorEl(anchorEl ?? null);
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
  }, [savedWords, previewData?.word]);

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
    setPopoverAnchorEl(null);
    setPreviewData(null);
    setPreviewResult(null);
  }, []);

  const handlePlayAudio = useCallback(() => {}, []);

  const handleRetry = useCallback(() => {
    playerHandle.current?.pause();
    playerHandle.current?.seekTo(0);
    setPopoverAnchorEl(null);
    setPreviewData(null);
    setPreviewResult(null);
  }, [playerHandle]);

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

      {/* Floating word popover */}
      <WordPopover
        anchorEl={popoverAnchorEl}
        word={previewData?.word ?? ''}
        preview={previewResult}
        isLoading={isPreviewLoading}
        isSaved={previewResult?.is_saved ?? false}
        isSaving={isSavingWord}
        onSave={handleSaveFromPreview}
        onPlayAudio={handlePlayAudio}
        onDismiss={handleDismissPreview}
      />
    </div>
  );
}