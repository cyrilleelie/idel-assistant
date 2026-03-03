import Constants from 'expo-constants';

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // In development, use the host machine's IP from Expo dev server
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8000/api/v1`;
  }
  return 'http://localhost:8000/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();
export const API_TIMEOUT_MS = 15_000;
export const API_UPLOAD_TIMEOUT_MS = 60_000;
export const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const SYNC_WINDOW_DAYS = 3; // J-1, J, J+1
export const TRANSMISSION_RETENTION_DAYS = 7;
