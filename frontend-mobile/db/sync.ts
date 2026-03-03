// WatermelonDB sync engine - pulls/pushes changes to the backend API
// Skeleton implementation with stubs for backend endpoints

import { synchronize } from '@nozbe/watermelondb/sync';
import type { Database } from '@nozbe/watermelondb';
import type { AxiosInstance } from 'axios';

/**
 * Perform a full bidirectional sync between local WatermelonDB and the backend.
 *
 * Pull: fetches all records changed since lastPulledAt from the server.
 * Push: sends all locally created/updated/deleted records to the server.
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
    pullChanges: async ({ lastPulledAt }) => {
      // TODO: GET /api/v1/sync/pull?last_synced_at=${lastPulledAt}
      // Expected response: { changes: { patients: { created: [], updated: [], deleted: [] }, ... }, timestamp }
      console.log('[Sync] Pull stub - lastPulledAt:', lastPulledAt);

      return { changes: {}, timestamp: Date.now() };
    },
    pushChanges: async ({ changes }) => {
      // TODO: POST /api/v1/sync/push with body { changes, lastPulledAt }
      // Expected request body: { changes: { patients: { created: [], updated: [], deleted: [] }, ... } }
      console.log(
        '[Sync] Push stub - tables with changes:',
        Object.keys(changes),
      );
    },
  });
}
