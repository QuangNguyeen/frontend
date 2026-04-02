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

  setSearch: (search: string) => void;
  setSelectedLang: (lang: string) => void;
  setSelectedLevel: (level: string) => void;
  reset: () => void;
}

const defaults = {
  search: '',
  selectedLang: 'All',
  selectedLevel: 'All',
};

export const useLibraryFiltersStore = create<LibraryFiltersState>()(
  persist(
    (set) => ({
      ...defaults,

      setSearch: (search) => set({ search }),
      setSelectedLang: (selectedLang) => set({ selectedLang }),
      setSelectedLevel: (selectedLevel) => set({ selectedLevel }),
      reset: () => set(defaults),
    }),
    { name: 'dictalearn-library-filters' },
  ),
);