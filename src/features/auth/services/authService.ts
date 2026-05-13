import { httpClient } from '@/shared/lib/httpClient';
import type { TokenResponse, UserResponse, RegisterRequest, UpdateProfileRequest } from '@/shared/types/api';

/**
 * Auth service — all authentication-related API calls.
 * Contains zero UI logic or state.
 */
export const authService = {
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    const res = await httpClient.post<TokenResponse>('/api/v1/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },

  register: async (data: RegisterRequest): Promise<UserResponse> => {
    const res = await httpClient.post<UserResponse>('/api/v1/auth/register', data);
    return res.data;
  },

  getMe: async (): Promise<UserResponse> => {
    const res = await httpClient.get<UserResponse>('/api/v1/auth/me');
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const res = await httpClient.post<TokenResponse>('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    return res.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<UserResponse> => {
    const res = await httpClient.put<UserResponse>('/api/v1/auth/me', data);
    return res.data;
  },

  googleLogin: async (idToken: string): Promise<TokenResponse> => {
    const res = await httpClient.post<TokenResponse>('/api/v1/auth/google', {
      id_token: idToken,
    });
    return res.data;
  },

  logout: async (): Promise<void> => {
    await httpClient.post('/api/v1/auth/logout');
  },
};