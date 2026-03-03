/**
 * preparationStore.ts — Zustand store for "Prepare My Day" screen state.
 *
 * Loads preparation data from local DB first, optionally enriches
 * with server AI summaries when online.
 */

import { create } from 'zustand';
import type { Database } from '@nozbe/watermelondb';
import {
  buildPreparationFromLocal,
  fetchPreparationFromServer,
} from '@/services/preparationService';
import type { PreparationData } from '@/services/preparationService';
import { addDays, getTodayString } from '@/utils/dateHelpers';

type DataSource = 'local' | 'server';

interface PreparationState {
  preparationDate: string;
  data: PreparationData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  source: DataSource | null;
}

interface PreparationActions {
  loadPreparation: (
    database: Database,
    currentUserId: string,
    isOnline: boolean,
    date?: string,
  ) => Promise<void>;

  refreshPreparation: (
    database: Database,
    currentUserId: string,
    isOnline: boolean,
  ) => Promise<void>;

  setPreparationDate: (date: string) => void;
}

const initialState: PreparationState = {
  preparationDate: addDays(getTodayString(), 1),
  data: null,
  isLoading: false,
  isRefreshing: false,
  source: null,
};

export const usePreparationStore = create<PreparationState & PreparationActions>()(
  (set, get) => ({
    ...initialState,

    loadPreparation: async (database, currentUserId, isOnline, date?) => {
      const targetDate = date ?? get().preparationDate;
      set({ isLoading: true, preparationDate: targetDate });

      try {
        // Try server first if online
        if (isOnline) {
          const serverData = await fetchPreparationFromServer(targetDate);
          if (serverData) {
            set({ data: serverData, source: 'server', isLoading: false });
            return;
          }
        }

        // Fallback to local
        const localData = await buildPreparationFromLocal(
          database,
          targetDate,
          currentUserId,
        );
        set({ data: localData, source: 'local', isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    },

    refreshPreparation: async (database, currentUserId, isOnline) => {
      const targetDate = get().preparationDate;
      set({ isRefreshing: true });

      try {
        if (isOnline) {
          const serverData = await fetchPreparationFromServer(targetDate);
          if (serverData) {
            set({ data: serverData, source: 'server', isRefreshing: false });
            return;
          }
        }

        const localData = await buildPreparationFromLocal(
          database,
          targetDate,
          currentUserId,
        );
        set({ data: localData, source: 'local', isRefreshing: false });
      } catch {
        set({ isRefreshing: false });
      }
    },

    setPreparationDate: (date) => {
      set({ preparationDate: date });
    },
  }),
);
