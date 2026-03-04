// Initialize WatermelonDB with the best available adapter:
// - SQLiteAdapter when native modules are linked (EAS Build / bare workflow)
// - LokiJSAdapter (in-memory) as fallback for Expo Go development

import { Database } from '@nozbe/watermelondb';
import { NativeModules } from 'react-native';

import { schema } from '@/db/schema';
import { migrations } from '@/db/migrations';
import Patient from '@/db/models/Patient';
import Appointment from '@/db/models/Appointment';
import Transmission from '@/db/models/Transmission';
import Invoice from '@/db/models/Invoice';
import Document from '@/db/models/Document';
import AuditLog from '@/db/models/AuditLog';
import OfflineQueueItem from '@/db/models/OfflineQueueItem';
import UserCache from '@/db/models/UserCache';

const MODEL_CLASSES = [
  Patient,
  Appointment,
  Transmission,
  Invoice,
  Document,
  AuditLog,
  OfflineQueueItem,
  UserCache,
];

/** True when WatermelonDB native SQLite bridge is available (EAS Build / bare) */
export const hasNativeSQLite = !!NativeModules.WMDatabaseBridge;

/**
 * Create and return a WatermelonDB Database instance.
 *
 * Automatically picks the right adapter:
 * - **SQLiteAdapter** when native bridge is linked (EAS Build, bare workflow).
 *   Data persists on disk. Supports SQLCipher encryption.
 * - **LokiJSAdapter** when running inside Expo Go (no native modules).
 *   Data is in-memory only — lost on reload. Sufficient for dev/testing.
 *
 * @param _encryptionKey - Reserved for SQLCipher (bare workflow only).
 */
export function initDatabase(_encryptionKey?: string): Database {
  if (hasNativeSQLite) {
    // Production path — persistent SQLite
    const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default;
    const adapter = new SQLiteAdapter({
      schema,
      migrations,
      dbName: 'idel',
      jsi: false,
    });
    return new Database({ adapter, modelClasses: MODEL_CLASSES });
  }

  // Fallback — in-memory LokiJS (Expo Go)
  console.warn(
    '[WatermelonDB] Native SQLite bridge not available — using in-memory LokiJS adapter.\n' +
    'Data will NOT persist across reloads. Use EAS Build for production.',
  );
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
  const adapter = new LokiJSAdapter({
    schema,
    dbName: 'idel',
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses: MODEL_CLASSES });
}
