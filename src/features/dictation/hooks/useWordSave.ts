import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { vocabularyService } from '@/features/vocabulary/services/vocabularyService';
import { vocabularyKeys } from '@/features/vocabulary/hooks/useVocabulary';

export function cleanForSave(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
}

export function useWordSave(videoId: string, source: string = 'cloze') {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (clean: string) => {
    if (!clean || saved.has(clean)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) next.delete(clean);
      else next.add(clean);
      return next;
    });
  };

  const selectedWords = Array.from(selected).filter((w) => !saved.has(w));

  const saveSelected = async (contextSentence: string, audioStartTime: number) => {
    if (!selectedWords.length || isSaving) return;
    setIsSaving(true);
    try {
      await Promise.allSettled(
        selectedWords.map((word) =>
          vocabularyService.saveWord({
            word,
            video_id: videoId,
            context_sentence: contextSentence,
            audio_start_time: audioStartTime,
            source,
          }),
        ),
      );
      void queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: vocabularyKeys.all });
      }, 2500);
      setSaved((prev) => {
        const next = new Set(prev);
        selectedWords.forEach((w) => next.add(w));
        return next;
      });
      setSelected(new Set());
    } finally {
      setIsSaving(false);
    }
  };

  return { selected, saved, isSaving, selectedWords, toggle, saveSelected };
}
