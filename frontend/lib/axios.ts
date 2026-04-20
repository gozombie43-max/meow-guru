import axios from 'axios';

const api = axios.create({
  baseURL:         process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true, // sends cookies automatically
});

// Attach token from localStorage to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
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
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        // Save new token
        localStorage.setItem('token', data.token);
        // Retry original request with new token
        original.headers.Authorization = `Bearer ${data.token}`;
        return axios(original);
      } catch (refreshErr) {
        // Refresh failed — clear token only for real auth failures
        const status = (refreshErr as { response?: { status?: number } })?.response?.status;
        if ((status === 401 || status === 403) && typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;