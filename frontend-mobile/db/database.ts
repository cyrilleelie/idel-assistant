// Initialize WatermelonDB with SQLite adapter for offline-first data persistence
// SQLCipher encryption requires bare workflow (not available in Expo Go)

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from '@/db/schema';
import Patient from '@/db/models/Patient';
import Appointment from '@/db/models/Appointment';
import Transmission from '@/db/models/Transmission';
import Invoice from '@/db/models/Invoice';
import Document from '@/db/models/Document';
import AuditLog from '@/db/models/AuditLog';
import OfflineQueueItem from '@/db/models/OfflineQueueItem';
import UserCache from '@/db/models/UserCache';

/**
 * Create and return a WatermelonDB Database instance.
 *
 * @param _encryptionKey - Reserved for SQLCipher (bare workflow only).
 *   Accepted but NOT used in Expo Go builds. When migrating to bare
 *   workflow, pass this key to the SQLiteAdapter for at-rest encryption.
 */
export function initDatabase(_encryptionKey?: string): Database {
  // TODO: Pass encryptionKey to SQLCipher when migrating to bare workflow
  const adapter = new SQLiteAdapter({
    schema,
    dbName: 'idel',
    jsi: false, // JSI not available in Expo Go
  });

  return new Database({
    adapter,
    modelClasses: [
      Patient,
      Appointment,
      Transmission,
      Invoice,
      Document,
      AuditLog,
      OfflineQueueItem,
      UserCache,
    ],
  });
}
