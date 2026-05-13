import { useMutation } from '@tanstack/react-query';
import { authService } from '../services/authService';
import { useAuthStore } from './useAuthStore';
import type { RegisterRequest } from '@/shared/types/api';

/**
 * useLogin — handles the full login flow:
 * POST /auth/login → store token → GET /auth/me → update auth store.
 *
 * Navigation is left to the component so this hook stays reusable.
 *
 * @example
 * const { mutate: login, isPending, error } = useLogin();
 * login({ email, password }, { onSuccess: () => navigate('/library') });
 */
export function useLogin() {
  const storeLogin = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const tokens = await authService.login(email, password);
      localStorage.setItem('access_token', tokens.access_token);
      const user = await authService.getMe();
      return { tokens, user };
    },
    onSuccess: ({ tokens, user }) => {
      storeLogin(user, tokens.access_token, tokens.refresh_token);
    },
  });
}

/**
 * useRegister — handles the full register + auto-login flow:
 * POST /auth/register → POST /auth/login → GET /auth/me → update auth store.
 *
 * @example
 * const { mutate: register, isPending, error } = useRegister();
 * register({ email, password, display_name }, { onSuccess: () => navigate('/library') });
 */
export function useRegister() {
  const storeLogin = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      await authService.register(data);
      const tokens = await authService.login(data.email, data.password);
      localStorage.setItem('access_token', tokens.access_token);
      const user = await authService.getMe();
      return { tokens, user };
    },
    onSuccess: ({ tokens, user }) => {
      storeLogin(user, tokens.access_token, tokens.refresh_token);
    },
  });
}

/**
 * useGoogleLogin — handles the Google OAuth login flow:
 * POST /auth/google → store token → GET /auth/me → update auth store.
 */
export function useGoogleLogin() {
  const storeLogin = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: async (idToken: string) => {
      const tokens = await authService.googleLogin(idToken);
      localStorage.setItem('access_token', tokens.access_token);
      const user = await authService.getMe();
      return { tokens, user };
    },
    onSuccess: ({ tokens, user }) => {
      storeLogin(user, tokens.access_token, tokens.refresh_token);
    },
  });
}

/**
 * useLogout — clears auth state and tokens from storage.
 */
export function useLogout() {
  const storeLogout = useAuthStore((s) => s.logout);
  return () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    storeLogout();
  };
}