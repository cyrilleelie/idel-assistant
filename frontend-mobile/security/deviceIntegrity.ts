/**
 * Device integrity checker. Detects jailbroken/rooted devices,
 * mock location providers, and external storage installations.
 *
 * Uses jail-monkey as an optional dependency. If the module is not
 * installed or in __DEV__ mode, returns a safe result (not compromised).
 */

export interface IntegrityResult {
  isCompromised: boolean;
  reasons: string[];
}

/**
 * Checks device integrity by looking for jailbreak/root indicators,
 * mock location providers, and external storage installations.
 *
 * In development mode or if jail-monkey is not available, this always
 * returns {isCompromised: false} to avoid blocking development.
 */
export function checkDeviceIntegrity(): IntegrityResult {
  // Skip checks in development to avoid blocking the dev workflow
  if (__DEV__) {
    return { isCompromised: false, reasons: [] };
  }

  try {
    // jail-monkey is an optional native dependency that may not be linked
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JailMonkey = require('jail-monkey');
    const reasons: string[] = [];

    if (JailMonkey.isJailBroken && JailMonkey.isJailBroken()) {
      reasons.push('Device is jailbroken or rooted');
    }

    if (JailMonkey.canMockLocation && JailMonkey.canMockLocation()) {
      reasons.push('Mock location provider detected');
    }

    if (JailMonkey.isOnExternalStorage && JailMonkey.isOnExternalStorage()) {
      reasons.push('Application installed on external storage');
    }

    return {
      isCompromised: reasons.length > 0,
      reasons,
    };
  } catch {
    // Module not found or not linked - treat as safe
    return { isCompromised: false, reasons: [] };
  }
}
