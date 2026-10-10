import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/authStore';

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach token
apiClient.interceptors.request.use(config => {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

// Response interceptor — handle token refresh
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { tokens, updateTokens, clearAuth } = useAuthStore.getState();

      if (tokens?.refreshToken) {
        try {
          const response = await axios.post('/api/v1/auth/refresh', {
            refreshToken: tokens.refreshToken,
          });
          const newTokens = response.data.data.tokens;
          updateTokens(newTokens);
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return apiClient(originalRequest);
        } catch {
          clearAuth();
          window.location.href = '/login';
        }
      } else {
        clearAuth();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;
