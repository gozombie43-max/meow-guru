import axios from 'axios';
import { canRetry, isFirstPartyApi, retryCount, retryDelay, waitForRetry } from '@/shared/api/policy';
import { normalizeError } from '@/shared/api/error';
import type {} from '@/shared/api/request';
import { API_BASE } from '@/lib/api-base';

export const AUTH_TOKEN_CHANGED_EVENT = 'auth-token-changed';
const LEGACY_AUTH_STORAGE_KEYS = ['token', 'refreshToken'] as const;
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export const clearLegacyAuthStorage = () => {
  if (typeof window === 'undefined') return;
  LEGACY_AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
};

export const updateAccessToken = (token: string | null) => {
  accessToken = token;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_CHANGED_EVENT, { detail: token }));
  }
};

const api = axios.create({
  adapter: 'fetch',
  baseURL:         API_BASE,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true, // sends cookies automatically
  timeout:         15000,
});

// Single in-flight refresh promise to cleanly handle concurrent 401s
let inFlightRefreshPromise: Promise<string | null> | null = null;

export const requestTokenRefresh = async (): Promise<string | null> => {
  if (inFlightRefreshPromise) return inFlightRefreshPromise;

  inFlightRefreshPromise = (async () => {
    try {
      const refresh = () => axios.post(
        `${API_BASE}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 15_000 }
      );
      const { data } = typeof navigator !== 'undefined' && navigator.locks
        ? await navigator.locks.request('meow-session-refresh', refresh)
        : await refresh();

      if (data.token) {
        updateAccessToken(data.token);
        return data.token as string;
      }
      return null;
    } catch (refreshErr) {
      const refreshStatus = (refreshErr as { response?: { status?: number } })?.response?.status;
      if (refreshStatus === 401 || refreshStatus === 403) {
        updateAccessToken(null);
      }
      return null;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
};

// Access tokens stay in memory. The HttpOnly refresh cookie restores sessions after reloads.
api.interceptors.request.use((config) => {
  const trusted = isFirstPartyApi(api.getUri(config));
  const session = trusted && config.apiPolicy?.auth !== 'none';
  if (!session) config.withCredentials = false;
  const token = session ? getAccessToken() : null;
  if (!session && config.headers.Authorization === `Bearer ${getAccessToken()}`) config.headers.delete('Authorization');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) config.headers.delete('Content-Type');
  return config;
});

// Auto-refresh when access token expires
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const method = (original.method || 'get').toLowerCase();
    const isRefreshCall = typeof original.url === 'string' && original.url.includes('/auth/refresh');

    if (axios.isCancel(error) || original.signal?.aborted) return Promise.reject(normalizeError(error, original.signal));
    const session = isFirstPartyApi(api.getUri(original)) && original.apiPolicy?.auth !== 'none';
    if (status === 401 && session && !original._retry && !isRefreshCall) {
      original._retry = true;
      try {
        const newToken = await requestTokenRefresh();
        if (newToken) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        // Handled in requestTokenRefresh
      }
    }

    const policy = original.apiPolicy ?? {};
    if (canRetry(method, status, policy)) {
      const count = original._networkRetryCount ?? 0;
      if (count < retryCount(policy)) {
        original._networkRetryCount = count + 1;
        try {
          await waitForRetry(retryDelay(count, policy, error.response?.headers?.['retry-after']), original.signal);
        } catch (cancelled) {
          throw normalizeError(cancelled, original.signal);
        }
        return api(original);
      }
    }

    return Promise.reject(normalizeError(error, original.signal));
  }
);

export default api;
