/**
 * notificationStore — Zustand store for notification preferences.
 *
 * Persisted via AsyncStorage so preferences survive app restarts.
 * Syncs with backend when online; falls back to local cache when offline.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import type { NotificationPreferences } from '@/services/notificationTypes';
import { DEFAULT_PREFERENCES } from '@/services/notificationTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationState {
  preferences: NotificationPreferences;
  pushToken: string | null;
  isRegistered: boolean;
  unreadCount: number;
}

interface NotificationActions {
  /** Load preferences from backend (if online) or local cache */
  loadPreferences: () => Promise<void>;
  /** Update a single preference key (optimistic + persist + backend sync) */
  updatePreference: (
    key: keyof NotificationPreferences,
    value: boolean | string,
  ) => Promise<void>;
  /** Mark push token as registered */
  setRegistered: (token: string) => void;
  /** Increment unread notification count */
  incrementUnread: () => void;
  /** Clear unread notification count */
  clearUnread: () => void;
  /** Reset store to defaults */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: NotificationState = {
  preferences: { ...DEFAULT_PREFERENCES },
  pushToken: null,
  isRegistered: false,
  unreadCount: 0,
};

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      loadPreferences: async () => {
        try {
          const response = await api.get<NotificationPreferences>(
            '/devices/me/notification-settings',
          );
          set({ preferences: response.data });
        } catch {
          // Offline or endpoint unavailable — use local cache (already persisted)
        }
      },

      updatePreference: async (key, value) => {
        const current = get().preferences;
        const updated = { ...current, [key]: value };

        // Optimistic update
        set({ preferences: updated });

        // Sync to backend (non-blocking)
        try {
          await api.put('/devices/me/notification-settings', updated);
        } catch {
          // Offline — local cache is already updated and persisted.
          // Will sync on next loadPreferences when back online.
        }
      },

      setRegistered: (token) => {
        set({ pushToken: token, isRegistered: true });
      },

      incrementUnread: () => {
        set((s) => ({ unreadCount: s.unreadCount + 1 }));
      },

      clearUnread: () => {
        set({ unreadCount: 0 });
      },

      reset: () => {
        set({ ...initialState });
      },
    }),
    {
      name: 'idel-notifications',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        pushToken: state.pushToken,
        isRegistered: state.isRegistered,
      }),
    },
  ),
);
