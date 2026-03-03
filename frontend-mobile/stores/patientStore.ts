/**
 * patientStore.ts — UI state for the patients tab.
 *
 * Manages search query and refreshKey for manual re-fetches
 * (LokiJS adapter doesn't fire observable change notifications).
 */

import { create } from 'zustand';

interface PatientStoreState {
  searchQuery: string;
  refreshKey: number;
}

interface PatientStoreActions {
  setSearchQuery: (query: string) => void;
  bumpRefresh: () => void;
  reset: () => void;
}

const initialState: PatientStoreState = {
  searchQuery: '',
  refreshKey: 0,
};

export const usePatientStore = create<PatientStoreState & PatientStoreActions>()(
  (set) => ({
    ...initialState,

    setSearchQuery: (query: string): void => {
      set({ searchQuery: query });
    },

    bumpRefresh: (): void => {
      set((s) => ({ refreshKey: s.refreshKey + 1 }));
    },

    reset: (): void => {
      set(initialState);
    },
  }),
);
