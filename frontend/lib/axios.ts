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

const updateStoredToken = (token: string | null) => {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(AUTH_TOKEN_CHANGED_EVENT, { detail: token }));
};

const api = axios.create({
  baseURL:         process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true, // sends cookies automatically
});

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
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = getStoredRefreshToken();
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/auth/refresh`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true }
        );
        if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
        updateStoredToken(data.token);
        // Retry original request with new token
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch (refreshErr) {
        // Refresh failed — clear token only for real auth failures
        const status = (refreshErr as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          updateStoredToken(null);
          setStoredRefreshToken(null);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
