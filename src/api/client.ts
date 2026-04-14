import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';
import { getItem, multiRemove } from '../utils/storage';

/**
 * Shared Axios instance for all API calls.
 *
 * The backend uses a single JWT token (no refresh flow).
 * On 401, we clear local auth state so the app redirects to login.
 */

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Inject token into every request if available */
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getItem(STORAGE_KEYS.TOKEN);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** On 401 (non-auth endpoints), clear local tokens to trigger login redirect */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? '';

    const isAuthEndpoint = url.startsWith('/auth/');

    if (status === 401 && !isAuthEndpoint) {
      await multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
