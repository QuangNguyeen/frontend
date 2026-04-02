import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Persisted player preferences.
 * Volume, mute, playback rate, and audio-only mode survive page navigation
 * and browser restarts.
 */

interface PlayerPrefsState {
  volume: number;
  muted: boolean;
  rate: number;
  audioOnly: boolean;
  /** When true, advance to the next sentence automatically after completion. */
  autoNext: boolean;

  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setRate: (rate: number) => void;
  setAudioOnly: (audioOnly: boolean) => void;
  toggleAudioOnly: () => void;
  toggleAutoNext: () => void;
}

export const usePlayerPrefsStore = create<PlayerPrefsState>()(
  persist(
    (set) => ({
      volume: 1,
      muted: false,
      rate: 1,
      audioOnly: false,
      autoNext: true,

      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setRate: (rate) => set({ rate }),
      setAudioOnly: (audioOnly) => set({ audioOnly }),
      toggleAudioOnly: () => set((s) => ({ audioOnly: !s.audioOnly })),
      toggleAutoNext: () => set((s) => ({ autoNext: !s.autoNext })),
    }),
    { name: 'dictalearn-player-prefs' },
  ),
);