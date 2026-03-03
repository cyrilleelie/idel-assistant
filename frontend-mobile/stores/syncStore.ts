import { create } from 'zustand';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingOperationsCount: number;
  lastSyncAt: number | null;
  syncError: string | null;
}

interface SyncActions {
  setOnline: (value: boolean) => void;
  setSyncing: () => void;
  setSyncComplete: (timestamp: number) => void;
  setSyncError: (error: string) => void;
  incrementPendingOps: () => void;
  decrementPendingOps: () => void;
  setPendingOpsCount: (n: number) => void;
  reset: () => void;
}

const initialState: SyncState = {
  isOnline: true,
  syncStatus: 'idle',
  pendingOperationsCount: 0,
  lastSyncAt: null,
  syncError: null,
};

/**
 * Sync store managing online/offline state, synchronization progress,
 * and pending operations count. Used by the offline queue and sync engine
 * to coordinate background data synchronization.
 */
export const useSyncStore = create<SyncState & SyncActions>()((set) => ({
  ...initialState,

  /** Sets the online/offline connectivity state */
  setOnline: (value: boolean): void => {
    set({ isOnline: value });
  },

  /** Transitions to the syncing state, clearing any previous error */
  setSyncing: (): void => {
    set({ syncStatus: 'syncing', syncError: null });
  },

  /** Marks synchronization as complete with the given timestamp */
  setSyncComplete: (timestamp: number): void => {
    set({
      syncStatus: 'idle',
      lastSyncAt: timestamp,
      syncError: null,
    });
  },

  /** Sets a sync error message and transitions to the error state */
  setSyncError: (error: string): void => {
    set({ syncStatus: 'error', syncError: error });
  },

  /** Increments the pending operations counter by 1 */
  incrementPendingOps: (): void => {
    set((state) => ({
      pendingOperationsCount: state.pendingOperationsCount + 1,
    }));
  },

  /** Decrements the pending operations counter by 1, minimum 0 */
  decrementPendingOps: (): void => {
    set((state) => ({
      pendingOperationsCount: Math.max(0, state.pendingOperationsCount - 1),
    }));
  },

  /** Sets the pending operations counter to an exact value */
  setPendingOpsCount: (n: number): void => {
    set({ pendingOperationsCount: Math.max(0, n) });
  },

  /** Resets the sync store to its initial state */
  reset: (): void => {
    set({ ...initialState });
  },
}));
