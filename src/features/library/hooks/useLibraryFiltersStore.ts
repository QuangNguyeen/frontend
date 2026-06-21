import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Persisted library filter preferences.
 * The user's last search query, language, and difficulty level are restored
 * when they navigate back to the Library page.
 */

interface LibraryFiltersState {
  search: string;
  selectedLang: string;
  selectedLevel: string;
  /** Selected public topic-tag slugs (multi-select). */
  selectedTopics: string[];

  setSearch: (search: string) => void;
  setSelectedLang: (lang: string) => void;
  setSelectedLevel: (level: string) => void;
  setSelectedTopics: (topics: string[]) => void;
  addSelectedTopic: (topic: string) => void;
  reset: () => void;
}

const defaults = {
  search: '',
  selectedLang: 'All',
  selectedLevel: 'All',
  selectedTopics: [] as string[],
};

export const useLibraryFiltersStore = create<LibraryFiltersState>()(
  persist(
    (set) => ({
      ...defaults,

      setSearch: (search) => set({ search }),
      setSelectedLang: (selectedLang) => set({ selectedLang }),
      setSelectedLevel: (selectedLevel) => set({ selectedLevel }),
      setSelectedTopics: (selectedTopics) => set({ selectedTopics }),
      addSelectedTopic: (topic) =>
        set((s) => (s.selectedTopics.includes(topic) ? s : { selectedTopics: [...s.selectedTopics, topic] })),
      reset: () => set(defaults),
    }),
    {
      name: 'dictalearn-library-filters',
      version: 2,
      // Old persisted state stored a single `selectedTopic` string.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Record<string, unknown> & { selectedTopic?: string };
        if (typeof state.selectedTopic === 'string') {
          state.selectedTopics = state.selectedTopic ? [state.selectedTopic] : [];
          delete state.selectedTopic;
        }
        if (!Array.isArray(state.selectedTopics)) state.selectedTopics = [];
        return state as unknown as LibraryFiltersState;
      },
    },
  ),
);