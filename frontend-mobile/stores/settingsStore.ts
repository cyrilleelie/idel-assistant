/**
 * settingsStore.ts — User preference settings persisted via Zustand + AsyncStorage.
 *
 * Currently stores:
 * - gpsAppPreference: which GPS application to open when navigating to patients
 *
 * Persisted to AsyncStorage under the key 'settings' so preferences
 * survive app restarts without requiring authentication.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** GPS application preference for the navigation service. */
export type GpsApp = 'system' | 'google_maps' | 'waze' | 'apple_maps';

interface SettingsState {
  /** Preferred GPS application for patient navigation */
  gpsAppPreference: GpsApp;
}

interface SettingsActions {
  /** Updates the preferred GPS application */
  setGpsAppPreference: (app: GpsApp) => void;
  /** Resets all settings to their default values */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Settings store with AsyncStorage persistence.
 * Survives app restarts; does not require the user to be authenticated.
 */
export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // ── Initial state ────────────────────────────────────────────────────
      gpsAppPreference: 'system',

      // ── Actions ─────────────────────────────────────────────────────────
      setGpsAppPreference: (app: GpsApp) => {
        set({ gpsAppPreference: app });
      },

      reset: () => {
        set({ gpsAppPreference: 'system' });
      },
    }),
    {
      name: 'idel-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the state fields, not action functions
      partialize: (state) => ({
        gpsAppPreference: state.gpsAppPreference,
      }),
    },
  ),
);
