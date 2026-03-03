import { create } from 'zustand';
import { DEFAULT_LOCK_TIMEOUT_MINUTES, MAX_LOCK_TIMEOUT_MINUTES } from '@/constants/securityConfig';
import { checkBiometricAvailability, isPinConfigured, isBiometricEnabled } from '@/security/biometricAuth';
import * as keyManager from '@/security/keyManager';

interface SecurityState {
  isLocked: boolean;
  isPinConfigured: boolean;
  isBiometricsEnabled: boolean;
  biometricAvailable: boolean;
  pinAttempts: number;
  lastActivityTimestamp: number | null;
  lockTimeoutMinutes: number;
}

interface SecurityActions {
  lock: () => void;
  unlock: () => void;
  updateLastActivity: () => Promise<void>;
  checkShouldLock: () => boolean;
  setLockTimeout: (minutes: number) => void;
  initSecurity: () => Promise<void>;
  resetPinAttempts: () => void;
  incrementPinAttempts: () => void;
  reset: () => void;
}

const initialState: SecurityState = {
  isLocked: false,
  isPinConfigured: false,
  isBiometricsEnabled: false,
  biometricAvailable: false,
  pinAttempts: 0,
  lastActivityTimestamp: null,
  lockTimeoutMinutes: DEFAULT_LOCK_TIMEOUT_MINUTES,
};

/**
 * Security store managing app lock state, biometric availability,
 * PIN configuration, and inactivity tracking.
 *
 * The lock/unlock state is kept in memory only (not persisted)
 * because the app should always lock on cold start.
 */
export const useSecurityStore = create<SecurityState & SecurityActions>()((set, get) => ({
  ...initialState,

  /** Locks the app, requiring PIN or biometric authentication to continue */
  lock: (): void => {
    set({ isLocked: true });
  },

  /** Unlocks the app after successful authentication */
  unlock: (): void => {
    set({ isLocked: false, pinAttempts: 0 });
  },

  /**
   * Updates the last activity timestamp in both the store and SecureStore.
   * Called on user interaction to track inactivity for auto-lock.
   */
  updateLastActivity: async (): Promise<void> => {
    const now = Date.now();
    set({ lastActivityTimestamp: now });
    try {
      await keyManager.setLastActivity(now);
    } catch {
      // Non-critical - activity tracking is best-effort
    }
  },

  /**
   * Checks whether the app should be locked based on the inactivity
   * timeout. Returns true if the time since last activity exceeds
   * the configured lock timeout.
   */
  checkShouldLock: (): boolean => {
    const { lastActivityTimestamp, lockTimeoutMinutes, isPinConfigured: hasPinConfig } = get();

    // Cannot lock if no PIN is configured
    if (!hasPinConfig) {
      return false;
    }

    // No activity recorded yet - do not lock
    if (lastActivityTimestamp === null) {
      return false;
    }

    const elapsedMs = Date.now() - lastActivityTimestamp;
    const timeoutMs = lockTimeoutMinutes * 60 * 1000;
    return elapsedMs > timeoutMs;
  },

  /**
   * Sets the lock timeout in minutes, clamped between 1 and MAX_LOCK_TIMEOUT_MINUTES.
   */
  setLockTimeout: (minutes: number): void => {
    const clamped = Math.max(1, Math.min(minutes, MAX_LOCK_TIMEOUT_MINUTES));
    set({ lockTimeoutMinutes: clamped });
  },

  /**
   * Initializes the security store by checking biometric availability,
   * PIN configuration, and biometric enablement from SecureStore.
   * Should be called once during app startup after SecurityGate passes.
   */
  initSecurity: async (): Promise<void> => {
    try {
      const [biometricResult, pinConfigured, biometricEnabled, pinAttempts, lastActivity] =
        await Promise.all([
          checkBiometricAvailability(),
          isPinConfigured(),
          isBiometricEnabled(),
          keyManager.getPinAttempts(),
          keyManager.getLastActivity(),
        ]);

      set({
        biometricAvailable: biometricResult.isAvailable,
        isPinConfigured: pinConfigured,
        isBiometricsEnabled: biometricEnabled,
        pinAttempts,
        lastActivityTimestamp: lastActivity,
      });
    } catch {
      // If initialization fails, keep defaults (safe state)
    }
  },

  /** Resets the PIN attempts counter to zero */
  resetPinAttempts: (): void => {
    set({ pinAttempts: 0 });
  },

  /** Increments the PIN attempts counter */
  incrementPinAttempts: (): void => {
    set((state) => ({ pinAttempts: state.pinAttempts + 1 }));
  },

  /** Resets the security store to its initial state */
  reset: (): void => {
    set({ ...initialState });
  },
}));
