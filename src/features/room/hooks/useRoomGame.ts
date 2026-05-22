import { useState, useCallback, useRef } from 'react';
import type { WSGameStart, WSSubmitPayload, WSSubmitResult } from '../types/room';

interface UseRoomGameReturn {
  currentSentenceIndex: number;
  replayCount: number;
  inputValue: string;
  setInputValue: (v: string) => void;
  incrementReplay: () => boolean;
  canReplay: boolean;
  handleSubmit: () => WSSubmitPayload | null;
  handleSkip: () => WSSubmitPayload;
  onSubmitResult: (result: WSSubmitResult) => void;
  isFinished: boolean;
  totalSentences: number;
  sentenceResults: Map<number, WSSubmitResult>;
}

export function useRoomGame(
  gameStart: WSGameStart | null,
  maxReplays: number,
): UseRoomGameReturn {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [sentenceResults, setSentenceResults] = useState<Map<number, WSSubmitResult>>(new Map());
  const submittedRef = useRef<Set<number>>(new Set());

  const totalSentences = gameStart?.total_sentences ?? 0;
  const isFinished = currentSentenceIndex >= totalSentences;
  const canReplay = replayCount < maxReplays;

  const advanceToNext = useCallback(() => {
    setCurrentSentenceIndex(prev => prev + 1);
    setReplayCount(0);
    setInputValue('');
  }, []);

  const incrementReplay = useCallback((): boolean => {
    if (replayCount >= maxReplays) return false;
    setReplayCount(c => c + 1);
    return true;
  }, [replayCount, maxReplays]);

  const handleSubmit = useCallback((): WSSubmitPayload | null => {
    const trimmed = inputValue.trim();
    if (!trimmed) return null;
    if (submittedRef.current.has(currentSentenceIndex)) return null;

    submittedRef.current.add(currentSentenceIndex);
    const payload: WSSubmitPayload = {
      sentence_index: currentSentenceIndex,
      user_input: trimmed,
      is_skipped: false,
      replay_count: replayCount,
    };
    advanceToNext();
    return payload;
  }, [inputValue, currentSentenceIndex, replayCount, advanceToNext]);

  const handleSkip = useCallback((): WSSubmitPayload => {
    submittedRef.current.add(currentSentenceIndex);
    const payload: WSSubmitPayload = {
      sentence_index: currentSentenceIndex,
      user_input: '',
      is_skipped: true,
      replay_count: replayCount,
    };
    advanceToNext();
    return payload;
  }, [currentSentenceIndex, replayCount, advanceToNext]);

  const onSubmitResult = useCallback((result: WSSubmitResult) => {
    setSentenceResults(prev => new Map(prev).set(result.sentence_index, result));
  }, []);

  return {
    currentSentenceIndex,
    replayCount,
    inputValue,
    setInputValue,
    incrementReplay,
    canReplay,
    handleSubmit,
    handleSkip,
    onSubmitResult,
    isFinished,
    totalSentences,
    sentenceResults,
  };
}
