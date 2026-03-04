/**
 * Sync orchestrator — tries real backend sync, falls back to dev seed.
 *
 * On startup (trySyncOrSeed):
 * 1. Ping the backend health endpoint (raw axios, no auth interceptor)
 * 2. If reachable → purge dev seed data, perform real WatermelonDB sync
 * 3. If unreachable + __DEV__ → run dev seed for local testing
 *
 * This ensures the app works both with and without backend connectivity.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { api } from '@/services/api';
import { API_BASE_URL } from '@/constants/config';
import { performSync, resetSyncState } from '@/db/sync';

const SEED_FLAG_KEY = 'idel_dev_seed_active';

/**
 * Attempts to sync with the backend. If the backend is unreachable
 * and we're in dev mode, runs the dev seed instead.
 *
 * When switching from dev seed to real backend:
 * - Resets the local WatermelonDB to avoid mixing seed + real data
 * - Sets a flag so we know seed data was purged
 */
export async function trySyncOrSeed(
  database: Database,
  userId: string,
): Promise<void> {
  const backendReachable = await isBackendReachable();

  if (backendReachable) {
    console.log('[SyncService] Backend reachable — performing sync');

    // If we previously had dev seed data, purge it before syncing
    const hadSeedData = await AsyncStorage.getItem(SEED_FLAG_KEY);
    if (hadSeedData === 'true') {
      console.log('[SyncService] Purging dev seed data before first real sync');
      await purgeLocalData(database);
      await AsyncStorage.removeItem(SEED_FLAG_KEY);
    }

    try {
      // If the local DB has no appointments, force a full re-pull.
      // This recovers from corrupted lastPulledAt (e.g. previous sync
      // failure that advanced the timestamp without storing data).
      const localCount = await database
        .get('appointments')
        .query()
        .fetchCount();
      if (localCount === 0) {
        console.log('[SyncService] No local appointments — forcing full re-pull');
        await resetSyncState(database);
      }

      await performSync(database, api);
      const { useSyncStore } = await import('@/stores/syncStore');
      useSyncStore.getState().setSyncComplete(Date.now());
    } catch (error) {
      console.warn('[SyncService] Sync failed:', error);
      const { useSyncStore } = await import('@/stores/syncStore');
      useSyncStore.getState().setSyncError('Synchronisation échouée');
    }
  } else if (__DEV__) {
    console.log('[SyncService] Backend unreachable — running dev seed');
    await AsyncStorage.setItem(SEED_FLAG_KEY, 'true');
    const { runDevSeed } = await import('@/services/devSeed');
    await runDevSeed(database, userId);
  } else {
    console.log('[SyncService] Backend unreachable — offline mode');
  }
}

/**
 * Quick health check — pings /health with a short timeout.
 *
 * Uses raw axios (NOT the api client) to avoid the auth interceptor
 * which would fail if there's no token yet and trigger the 401 refresh loop.
 */
async function isBackendReachable(): Promise<boolean> {
  try {
    const healthUrl = API_BASE_URL.replace('/api/v1', '') + '/health';
    console.log('[SyncService] Health check:', healthUrl);
    const response = await axios.get(healthUrl, { timeout: 3000 });
    const ok = response.status === 200 && response.data?.status === 'ok';
    console.log('[SyncService] Health check result:', ok);
    return ok;
  } catch (error) {
    console.log('[SyncService] Backend unreachable:', (error as Error).message);
    return false;
  }
}

/**
 * Purges all WatermelonDB tables to clear dev seed data.
 * Called once when transitioning from dev seed to real backend.
 */
async function purgeLocalData(database: Database): Promise<void> {
  try {
    const tables = ['patients', 'appointments', 'transmissions', 'invoices', 'documents'];
    await database.write(async () => {
      for (const tableName of tables) {
        const collection = database.get(tableName);
        const allRecords = await collection.query().fetch();
        for (const record of allRecords) {
          await record.destroyPermanently();
        }
      }
    });
    console.log('[SyncService] Local data purged');
  } catch (error) {
    console.warn('[SyncService] Purge failed:', error);
  }
}

/**
 * Triggers a full sync cycle. Called from pull-to-refresh and
 * when the app returns to foreground.
 */
export async function triggerSync(database: Database): Promise<void> {
  const { useSyncStore } = await import('@/stores/syncStore');
  const store = useSyncStore.getState();

  if (store.syncStatus === 'syncing') {
    return; // Already syncing
  }

  store.setSyncing();
  try {
    await performSync(database, api);
    store.setSyncComplete(Date.now());
  } catch (error) {
    store.setSyncError('Synchronisation échouée');
    throw error;
  }
}
