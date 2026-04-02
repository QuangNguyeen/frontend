import axios from 'axios';

/**
 * Shared axios instance used by all feature services.
 * - Attaches Bearer token from localStorage on every request.
 * - Redirects to /login on 401 (except auth endpoints themselves).
 */
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ──────────────────────────────────────────────────────
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor ─────────────────────────────────────────────────────
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/**
 * Extracts a human-readable error string from an Axios error response.
 * Handles both string `detail` and FastAPI validation array formats.
 */
export function extractApiError(err: unknown, fallback = 'Something went wrong'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((d: { msg: string }) => d.msg).join(', ');
  return typeof detail === 'string' ? detail : fallback;
}