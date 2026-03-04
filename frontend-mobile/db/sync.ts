/**
 * WatermelonDB sync engine — pulls/pushes changes to the backend API.
 *
 * Strategy:
 * - Server UUIDs are used as WatermelonDB `id` (local primary key)
 * - `server_id` column stores the same value for traceability
 * - Foreign keys (patient_id, appointment_id) use server UUIDs too
 *
 * This means WatermelonDB's `id` === backend UUID, so relations
 * (appointment.patient_id → patient.id) resolve correctly.
 *
 * Pull: GET /api/v1/sync/pull?last_synced_at={ms_timestamp}
 * Push: POST /api/v1/sync/push with WatermelonDB changes payload
 */

import { synchronize } from '@nozbe/watermelondb/sync';
import type { Database } from '@nozbe/watermelondb';
import type { AxiosInstance } from 'axios';

/**
 * Resets WatermelonDB's internal lastPulledAt timestamp to force a full
 * re-pull on the next sync. Use when the local DB is empty or corrupted.
 */
export async function resetSyncState(database: Database): Promise<void> {
  try {
    await database.adapter.setLocal('__watermelon_last_pulled_at', '');
    console.log('[Sync] Reset lastPulledAt — next sync will be a full pull');
  } catch (error) {
    console.warn('[Sync] Failed to reset sync state:', error);
  }
}

/**
 * Perform a full bidirectional sync between local WatermelonDB and the backend.
 *
 * @param database - The WatermelonDB database instance
 * @param apiClient - Axios instance configured with auth headers and base URL
 */
export async function performSync(
  database: Database,
  apiClient: AxiosInstance,
): Promise<void> {
  await synchronize({
    database,
    sendCreatedAsUpdated: true, // Avoids conflicts when a "created" record already exists locally
    pullChanges: async ({ lastPulledAt }) => {
      const timestamp = lastPulledAt ?? 0;
      console.log('[Sync] Pulling changes since:', timestamp);

      const response = await apiClient.get('/sync/pull', {
        params: { last_synced_at: timestamp },
      });

      const { changes, timestamp: serverTimestamp } = response.data;
      const mappedChanges = mapServerChanges(changes);

      console.log(
        '[Sync] Pull complete:',
        Object.keys(mappedChanges).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (k) => `${k}: ${countChanges((mappedChanges as any)[k])}`,
        ),
      );

      return { changes: mappedChanges, timestamp: serverTimestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasChanges = Object.values(changes).some((table: any) =>
        (table.created?.length || 0) + (table.updated?.length || 0) + (table.deleted?.length || 0) > 0,
      );

      if (!hasChanges) {
        console.log('[Sync] No local changes to push');
        return;
      }

      console.log('[Sync] Pushing local changes...');

      try {
        await apiClient.post('/sync/push', {
          changes: mapLocalChanges(changes),
          last_pulled_at: lastPulledAt,
        });
        console.log('[Sync] Push complete');
      } catch (error) {
        console.error('[Sync] Push failed:', error);
        throw error;
      }
    },
  });
}

/**
 * Maps server response to WatermelonDB sync format.
 *
 * The backend returns records with `id` = server UUID.
 * WatermelonDB will use this `id` as its local primary key.
 * All foreign keys (patient_id etc.) also use server UUIDs.
 */
function mapServerChanges(changes: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [table, data] of Object.entries(changes)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableData = data as any;
    result[table] = {
      created: (tableData.created || []).map(ensureSyncFields),
      updated: (tableData.updated || []).map(ensureSyncFields),
      deleted: tableData.deleted || [],
    };
  }

  return result;
}

/**
 * Ensures each server record has the fields WatermelonDB expects.
 * - `id` is used as WatermelonDB's local primary key (= server UUID)
 * - `server_id` = same as `id` for traceability
 * - `last_synced_at` = current timestamp
 * - Booleans converted to 0/1 for SQLite
 */
function ensureSyncFields(record: Record<string, unknown>): Record<string, unknown> {
  const mapped = { ...record };

  // server_id = id (backend UUID)
  if (!mapped.server_id && mapped.id) {
    mapped.server_id = mapped.id;
  }

  mapped.last_synced_at = Date.now();

  // SQLite stores booleans as 0/1
  for (const [key, value] of Object.entries(mapped)) {
    if (typeof value === 'boolean') {
      mapped[key] = value ? 1 : 0;
    }
  }

  return mapped;
}

/**
 * Maps local WatermelonDB changes to the server push format.
 */
function mapLocalChanges(changes: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [table, data] of Object.entries(changes)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableData = data as any;
    result[table] = {
      created: (tableData.created || []).map(extractRaw),
      updated: (tableData.updated || []).map(extractRaw),
      deleted: tableData.deleted || [],
    };
  }

  return result;
}

/**
 * Extracts the raw fields from a WatermelonDB record for push.
 */
function extractRaw(record: Record<string, unknown>): Record<string, unknown> {
  const raw = (record as Record<string, unknown>)._raw || record;
  return { ...(raw as Record<string, unknown>) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countChanges(tableData: any): number {
  if (!tableData) return 0;
  return (
    (tableData.created?.length || 0) +
    (tableData.updated?.length || 0) +
    (tableData.deleted?.length || 0)
  );
}
