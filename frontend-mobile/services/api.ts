import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS, API_UPLOAD_TIMEOUT_MS } from '@/constants/config';
import * as keyManager from '@/security/keyManager';

/**
 * Axios instance for standard API requests.
 *
 * Features:
 * - Automatic Bearer token injection from SecureStore
 * - 401 response interception with token refresh + request retry
 * - Refresh deduplication (shared promise prevents concurrent refresh calls)
 * - Online/offline tracking via syncStore
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Axios instance for file uploads with a longer timeout */
export const uploadApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_UPLOAD_TIMEOUT_MS,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

// Extend InternalAxiosRequestConfig to include our retry flag
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Shared promise for refresh deduplication
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Request interceptor: Attaches the Bearer token from SecureStore
 * to every outgoing request.
 */
async function requestInterceptor(
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  try {
    const token = await keyManager.getToken('access');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // If token retrieval fails, send request without auth
    // The server will return 401 and trigger the refresh flow
  }
  return config;
}

/**
 * Performs a token refresh, deduplicating concurrent calls.
 * Returns true if refresh succeeded, false otherwise.
 */
async function performRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await keyManager.getToken('refresh');
      if (!refreshToken) {
        return false;
      }

      // Use a raw axios call to avoid interceptor loops
      const response = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;
      await keyManager.storeToken('access', access_token);
      await keyManager.storeToken('refresh', newRefreshToken);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Response error interceptor:
 * - On 401: attempts token refresh and retries the original request
 * - On network error: marks the app as offline via syncStore
 */
async function responseErrorInterceptor(error: AxiosError): Promise<unknown> {
  const originalRequest = error.config as RetryableRequestConfig | undefined;

  // Handle 401 Unauthorized
  if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
    originalRequest._retry = true;

    const refreshed = await performRefresh();
    if (refreshed) {
      // Retry the original request with the new token
      const newToken = await keyManager.getToken('access');
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
      }
      return api(originalRequest);
    }

    // Refresh failed - reset auth store (triggers login redirect)
    // Dynamic import to avoid circular dependency
    try {
      const { useAuthStore } = await import('@/stores/authStore');
      useAuthStore.getState().reset();
    } catch {
      // If store import fails, the app will handle the 401 elsewhere
    }

    return Promise.reject(error);
  }

  // Handle network errors (offline detection)
  if (!error.response && error.code === 'ERR_NETWORK') {
    try {
      const { useSyncStore } = await import('@/stores/syncStore');
      useSyncStore.getState().setOnline(false);
    } catch {
      // Non-critical
    }
  }

  return Promise.reject(error);
}

/**
 * Response success interceptor:
 * If we were previously offline and now getting responses,
 * mark as online.
 */
async function responseSuccessInterceptor(response: AxiosResponse): Promise<AxiosResponse> {
  try {
    const { useSyncStore } = await import('@/stores/syncStore');
    const store = useSyncStore.getState();
    if (!store.isOnline) {
      store.setOnline(true);
    }
  } catch {
    // Non-critical
  }
  return response;
}

// Attach interceptors to both API clients
api.interceptors.request.use(requestInterceptor);
api.interceptors.response.use(responseSuccessInterceptor, responseErrorInterceptor);

uploadApiClient.interceptors.request.use(requestInterceptor);
uploadApiClient.interceptors.response.use(responseSuccessInterceptor, responseErrorInterceptor);
