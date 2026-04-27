import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserResponse } from '../../../shared/types/api';
import { authService } from '../services/authService';

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: UserResponse, accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
  setUser: (user: UserResponse) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      logout: async () => {
        try {
          await authService.logout();
        } catch {
          // Clear local state even if the API call fails
        }
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        window.location.href = '/login';
      },

      setUser: (user) => set({ user }),
    }),
    { name: 'dictalearn-auth' },
  ),
);