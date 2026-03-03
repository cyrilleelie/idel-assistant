/**
 * tourneeStore.ts — State management for the daily round (tournee) screen.
 *
 * Responsibilities:
 * - selectedDate: which day is currently displayed (defaults to today)
 * - Date navigation: previous/next day, jump to today
 * - markAsCompleted / undoCompletion: WatermelonDB write + API sync + offline queue
 * - isMarkingComplete: ID of the appointment being marked (string | null)
 * - error: last write error, clearable by the UI
 *
 * WatermelonDB operations are performed inside database.write() for
 * transactional consistency. The database and userId are passed as
 * parameters to keep the store decoupled from React contexts.
 */

import { create } from 'zustand';
import type { Database } from '@nozbe/watermelondb';
import type Appointment from '@/db/models/Appointment';
import { getTodayString, addDays } from '@/utils/dateHelpers';
import { api } from '@/services/api';
import { globalQueue } from '@/services/globalQueue';
import { AuditLogger } from '@/security/auditLogger';
import { useSyncStore } from '@/stores/syncStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TourneeState {
  /** Currently displayed date as 'YYYY-MM-DD' */
  selectedDate: string;
  /**
   * WatermelonDB local ID of the appointment currently being
   * marked complete or undone, or null when idle.
   */
  isMarkingComplete: string | null;
  /** Last error message from a write operation, or null */
  error: string | null;
  /**
   * Monotonically increasing counter bumped after every successful
   * local DB write. Used by the tournee screen as a useEffect dependency
   * to re-fetch appointment data (LokiJS adapter does not fire observable
   * change notifications on local writes).
   */
  refreshKey: number;
}

interface TourneeActions {
  /** Set the selected date directly */
  setSelectedDate: (date: string) => void;
  /** Navigate to the previous day */
  goToPreviousDay: () => void;
  /** Navigate to the next day */
  goToNextDay: () => void;
  /** Jump back to today */
  goToToday: () => void;
  /**
   * Mark an appointment as completed in WatermelonDB, then sync to the
   * server if online or enqueue if offline.
   *
   * @param appointmentId - WatermelonDB local ID
   * @param serverId      - Server-side UUID (used for the API call)
   * @param database      - Active WatermelonDB instance
   * @param userId        - Authenticated user ID (for audit logging)
   */
  markAsCompleted: (
    appointmentId: string,
    serverId: string,
    database: Database,
    userId: string,
  ) => Promise<void>;
  /**
   * Undo a completed appointment, reverting it to 'scheduled'.
   *
   * @param appointmentId - WatermelonDB local ID
   * @param serverId      - Server-side UUID (used for the API call)
   * @param database      - Active WatermelonDB instance
   */
  undoCompletion: (
    appointmentId: string,
    serverId: string,
    database: Database,
  ) => Promise<void>;
  /** Clear the last error */
  clearError: () => void;
  /** Reset store to initial state */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: TourneeState = {
  selectedDate: getTodayString(),
  isMarkingComplete: null,
  error: null,
  refreshKey: 0,
};

export const useTourneeStore = create<TourneeState & TourneeActions>()((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  ...initialState,

  // ── Date navigation ────────────────────────────────────────────────────────

  setSelectedDate: (date: string): void => {
    set({ selectedDate: date });
  },

  goToPreviousDay: (): void => {
    const { selectedDate } = get();
    set({ selectedDate: addDays(selectedDate, -1) });
  },

  goToNextDay: (): void => {
    const { selectedDate } = get();
    set({ selectedDate: addDays(selectedDate, 1) });
  },

  goToToday: (): void => {
    set({ selectedDate: getTodayString() });
  },

  // ── Write operations ───────────────────────────────────────────────────────

  markAsCompleted: async (
    appointmentId: string,
    serverId: string,
    database: Database,
    userId: string,
  ): Promise<void> => {
    if (get().isMarkingComplete !== null) return;
    set({ isMarkingComplete: appointmentId, error: null });

    try {
      // 1. Write to local WatermelonDB (source of truth for offline-first)
      //    Use _raw access directly — decorator setters can be unreliable
      //    depending on Babel class-properties transform order.
      await database.write(async () => {
        const appointment = await database
          .get<Appointment>('appointments')
          .find(appointmentId);

        await appointment.update(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = (appointment as any)._raw;
          raw.status = 'completed';
          raw.completed_at = Date.now();
        });
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
      set({ error: message });
    } finally {
      // Release the lock and bump refreshKey so the UI re-fetches data.
      set((s) => ({ isMarkingComplete: null, refreshKey: s.refreshKey + 1 }));
    }

    // 2. Sync to server or enqueue — fire-and-forget (non-blocking)
    //    This runs after isMarkingComplete is cleared so the UI is responsive.
    (async () => {
      try {
        const isOnline = useSyncStore.getState().isOnline;
        if (isOnline && serverId) {
          try {
            await api.post(`/appointments/${serverId}/complete`);
          } catch {
            await globalQueue.enqueue('POST', `/appointments/${serverId}/complete`);
          }
        } else if (serverId) {
          await globalQueue.enqueue('POST', `/appointments/${serverId}/complete`);
        }
      } catch {
        // Enqueue failure is non-critical for local-first UX
      }

      // 4. Audit log (RGPD/HDS — never throws)
      try {
        await AuditLogger.log('mark_completed', 'appointment', appointmentId, userId);
      } catch {
        // Audit failure must not break the app
      }
    })();
  },

  undoCompletion: async (
    appointmentId: string,
    serverId: string,
    database: Database,
  ): Promise<void> => {
    if (get().isMarkingComplete !== null) return;
    set({ isMarkingComplete: appointmentId, error: null });

    try {
      // 1. Write to local WatermelonDB
      await database.write(async () => {
        const appointment = await database
          .get<Appointment>('appointments')
          .find(appointmentId);

        await appointment.update(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = (appointment as any)._raw;
          raw.status = 'scheduled';
          raw.completed_at = null;
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
      set({ error: message });
    } finally {
      set((s) => ({ isMarkingComplete: null, refreshKey: s.refreshKey + 1 }));
    }

    // 2. Sync to server or enqueue — fire-and-forget (non-blocking)
    (async () => {
      try {
        const isOnline = useSyncStore.getState().isOnline;
        if (isOnline && serverId) {
          try {
            await api.patch(`/appointments/${serverId}`, { status: 'scheduled' });
          } catch {
            await globalQueue.enqueue('PATCH', `/appointments/${serverId}`, {
              status: 'scheduled',
            });
          }
        } else if (serverId) {
          await globalQueue.enqueue('PATCH', `/appointments/${serverId}`, {
            status: 'scheduled',
          });
        }
      } catch {
        // Non-critical
      }
    })();
  },

  clearError: (): void => {
    set({ error: null });
  },

  reset: (): void => {
    set({ ...initialState, selectedDate: getTodayString() });
  },
}));
