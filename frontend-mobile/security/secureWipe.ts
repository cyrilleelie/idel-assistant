import { Directory, Paths } from 'expo-file-system';
import { AuditLogger } from '@/security/auditLogger';
import * as keyManager from '@/security/keyManager';
import { getDatabaseRef } from '@/contexts/DatabaseContext';

/**
 * Performs a secure wipe of all local data. This is used for:
 * - Remote wipe triggered by the server (device lost/stolen)
 * - Inactivity wipe (INACTIVITY_WIPE_DAYS exceeded)
 * - Manual logout (user-initiated)
 *
 * Each step is wrapped in try/catch to ensure maximum data removal
 * even if individual steps fail. This function NEVER throws.
 */
export async function performSecureWipe(reason: string): Promise<void> {
  // Step 1: Log the wipe event to audit trail (best effort)
  try {
    await AuditLogger.log('wipe_performed', 'system', 'device', 'system', {
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging failure must not prevent wipe
  }

  // Step 2: Reset WatermelonDB via unsafeResetDatabase()
  // This drops all rows from every table while keeping the database
  // instance and its adapter alive, so the app can immediately write
  // new data after the next user logs in.
  try {
    const db = getDatabaseRef();
    if (db) {
      await db.write(async () => {
        await db.unsafeResetDatabase();
      });
    }
  } catch {
    // Fallback: delete SQLite files on disk (instance may be broken)
    try {
      const sqliteDir = new Directory(Paths.document, 'SQLite');
      if (sqliteDir.exists) {
        sqliteDir.delete();
      }
    } catch {
      // Continue with remaining wipe steps
    }
  }

  // Step 3: Delete encrypted/cached files in known directories
  const directories = ['audio', 'scans', 'invoices', 'cache'];
  for (const dir of directories) {
    try {
      const dirObj = new Directory(Paths.document, dir);
      if (dirObj.exists) {
        dirObj.delete();
      }
    } catch {
      // Continue with next directory
    }
  }

  // Step 4: Delete all SecureStore keys (tokens, encryption keys, PIN data)
  try {
    await keyManager.deleteAllKeys();
  } catch {
    // Continue - partial key deletion is better than none
  }

  // Step 5: Reset Zustand stores
  // Import dynamically to avoid circular dependencies.
  // Each store's reset() clears its in-memory state.
  try {
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().reset();
  } catch {
    // Store may not be initialized
  }

  try {
    const { useSecurityStore } = await import('@/stores/securityStore');
    useSecurityStore.getState().reset();
  } catch {
    // Store may not be initialized
  }

  try {
    const { useSyncStore } = await import('@/stores/syncStore');
    useSyncStore.getState().reset();
  } catch {
    // Store may not be initialized
  }

  try {
    const { useTourneeStore } = await import('@/stores/tourneeStore');
    useTourneeStore.getState().reset();
  } catch {
    // Store may not be initialized
  }

  try {
    const { usePreparationStore } = await import('@/stores/preparationStore');
    usePreparationStore.getState().reset();
  } catch {
    // Store may not be initialized
  }
}
