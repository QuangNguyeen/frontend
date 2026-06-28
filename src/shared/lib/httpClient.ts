import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * Shared axios instance used by all feature services.
 * - Attaches Bearer token from localStorage on every request.
 * - On a 401, transparently refreshes the access token using the stored
 *   refresh token and retries the original request. Only when the refresh
 *   itself fails do we clear tokens and redirect to /login.
 *
 * This is what keeps a session alive across tab switches: when the user comes
 * back to a backgrounded tab and a request fires with an expired access token,
 * it is refreshed in the background instead of forcing a logout.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const httpClient = axios.create({
  baseURL: API_BASE,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ──────────────────────────────────────────────────────
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Token refresh (single-flight) ────────────────────────────────────────────
// While one refresh is in flight, concurrent 401s await the same promise instead
// of each firing their own /auth/refresh call.
let refreshPromise: Promise<string> | null = null;

function forceLogout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/login';
}

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  // Use a bare axios call so this request does not recurse through the
  // interceptors below.
  const { data } = await axios.post(
    `${API_BASE}/api/v1/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );

  localStorage.setItem('access_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

// ── Response interceptor ─────────────────────────────────────────────────────
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/');

    // Genuine 401 on a non-auth request: try a one-time transparent refresh.
    if (status === 401 && !isAuthEndpoint && original && !original._retry) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return httpClient(original);
      } catch {
        forceLogout();
        return Promise.reject(error);
      }
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
