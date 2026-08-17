import axios from 'axios';

export const AUTH_TOKEN_STORAGE_KEY = 'token';
export const AUTH_TOKEN_CHANGED_EVENT = 'auth-token-changed';
export const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

export const getStoredRefreshToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
};

export const setStoredRefreshToken = (token: string | null) => {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
};

export const updateStoredToken = (token: string | null) => {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(AUTH_TOKEN_CHANGED_EVENT, { detail: token }));
};

// Default to local backend in dev when NEXT_PUBLIC_API_URL isn't provided
const defaultApiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

const api = axios.create({
  baseURL:         defaultApiBase,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true, // sends cookies automatically
  timeout:         15000,
});

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const MAX_NETWORK_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryNetwork = (status: number | undefined, method: string) => {
  if (!RETRYABLE_METHODS.has(method)) return false;
  if (status === undefined) return true;
  return RETRYABLE_STATUS.has(status);
};

// Single in-flight refresh promise to cleanly handle concurrent 401s
let inFlightRefreshPromise: Promise<string | null> | null = null;

export const requestTokenRefresh = async (): Promise<string | null> => {
  if (inFlightRefreshPromise) return inFlightRefreshPromise;

  inFlightRefreshPromise = (async () => {
    try {
      const refreshToken = getStoredRefreshToken();
      const { data } = await axios.post(
        `${defaultApiBase}/auth/refresh`,
        refreshToken ? { refreshToken } : {},
        { withCredentials: true }
      );

      if (data.refreshToken) {
        setStoredRefreshToken(data.refreshToken);
      }
      if (data.token) {
        updateStoredToken(data.token);
        return data.token as string;
      }
      return null;
    } catch (refreshErr) {
      const refreshStatus = (refreshErr as { response?: { status?: number } })?.response?.status;
      if (refreshStatus === 401 || refreshStatus === 403) {
        updateStoredToken(null);
        setStoredRefreshToken(null);
      }
      return null;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
};

// Attach token from localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
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

    if (status === 401 && !original._retry && !isRefreshCall) {
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

    if (shouldRetryNetwork(status, method)) {
      const retryCount = original._networkRetryCount || 0;
      if (retryCount < MAX_NETWORK_RETRIES) {
        original._networkRetryCount = retryCount + 1;
        await sleep(1200 * (retryCount + 1));
        return api(original);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
