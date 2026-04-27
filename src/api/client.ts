import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';
import { getItem, multiRemove } from '../utils/storage';

/**
 * Shared Axios instance for all REST calls.
 *
 * - Injects the JWT access token on every request.
 * - On 401 we clear the local session so the auth guard redirects to login.
 * - On network failure we surface a typed error so callers can present a
 *   retry UI rather than silently falling through to dummy data.
 */

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(message: string, opts: { code?: string; status?: number; details?: unknown } = {}) {
    super(message);
    this.code = opts.code ?? 'UNKNOWN';
    this.status = opts.status ?? 0;
    this.details = opts.details;
  }
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const clearSession = async (): Promise<void> => {
  await multiRemove([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.PUSH_TOKEN,
    STORAGE_KEYS.USER,
  ]);
  // Avoid static import cycle (authStore -> auth.api -> client -> authStore).
  const { useAuthStore } = await import('../stores/authStore');
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
};

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getItem(STORAGE_KEYS.TOKEN);
  if (token && config.headers) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status: number = error.response?.status ?? 0;
    const url: string = error.config?.url ?? '';
    const isAuthEndpoint = url.startsWith('/auth/');

    if (status === 401 && !isAuthEndpoint) {
      await clearSession();
    }

    const payload = error.response?.data?.error;
    const mapped = new ApiError(
      payload?.message || error.message || 'Network error',
      {
        code: payload?.code || (status === 0 ? 'NETWORK' : 'HTTP_' + status),
        status,
        details: payload?.details,
      },
    );

    return Promise.reject(mapped);
  },
);

export default apiClient;
