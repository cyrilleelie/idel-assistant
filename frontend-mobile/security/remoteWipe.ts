import { API_BASE_URL, API_TIMEOUT_MS } from '@/constants/config';
import * as keyManager from '@/security/keyManager';
import { performSecureWipe } from '@/security/secureWipe';

/**
 * Checks whether the server has requested a remote wipe for this device.
 *
 * Uses raw fetch() instead of the Axios instance to avoid circular
 * dependencies with the auth store and API interceptors.
 *
 * Returns true ONLY if the server explicitly responds with
 * wipe_requested === true. Any error (network, 404, 401, etc.)
 * returns false to avoid accidental wipes.
 */
export async function checkRemoteWipeStatus(): Promise<boolean> {
  try {
    const accessToken = await keyManager.getToken('access');
    if (!accessToken) {
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/devices/me/wipe-status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data?.wipe_requested === true;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  } catch {
    // Any unexpected error = do not wipe
    return false;
  }
}

/**
 * Checks for a remote wipe request and executes it if needed.
 * Returns true if a wipe was performed, false otherwise.
 */
export async function executeRemoteWipeIfRequested(): Promise<boolean> {
  const wipeRequested = await checkRemoteWipeStatus();
  if (wipeRequested) {
    await performSecureWipe('remote_wipe_requested');
    return true;
  }
  return false;
}
