import type { Database, Model } from '@nozbe/watermelondb';

/**
 * Audit actions tracked for HDS/RGPD compliance.
 * Every access to patient data must be logged.
 */
export type AuditAction =
  | 'view_patient'
  | 'view_transmission'
  | 'play_audio'
  | 'view_invoice'
  | 'send_invoice'
  | 'create_transmission'
  | 'scan_document'
  | 'mark_completed'
  | 'view_appointment'
  | 'app_unlock'
  | 'app_lock'
  | 'wipe_performed'
  | 'login'
  | 'logout';

/** Entity types that can be audited */
export type AuditEntityType =
  | 'patient'
  | 'transmission'
  | 'invoice'
  | 'document'
  | 'appointment'
  | 'system';

/** Structure of a buffered audit log entry */
interface BufferedAuditEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  userId: string;
  context?: Record<string, string>;
  timestamp: number;
}

/** Column name constant for the WatermelonDB audit_logs table */
const AUDIT_TABLE = 'audit_logs';

/**
 * Shape of the raw record for audit_logs in WatermelonDB.
 * WatermelonDB's RawRecord type only defines id/_status/_changed,
 * so we extend it with our custom columns for type-safe access.
 */
interface AuditRawRecord {
  id: string;
  _status: string;
  _changed: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  context_json: string | null;
  created_at: number;
  synced: boolean;
}

/**
 * Class-based audit logger for HDS/RGPD compliance.
 * Buffers entries in memory until WatermelonDB is initialized,
 * then flushes them to the database. Never throws errors to avoid
 * disrupting the application flow.
 */
class AuditLoggerImpl {
  private database: Database | null = null;
  private buffer: BufferedAuditEntry[] = [];

  /**
   * Initialize the audit logger with a WatermelonDB database reference.
   * This also flushes any buffered entries that were logged before init.
   */
  async init(database: Database): Promise<void> {
    this.database = database;
    await this.flushBuffer();
  }

  /**
   * Log an audit event. If the database is not yet initialized,
   * the entry is buffered in memory and flushed when init() is called.
   *
   * This method NEVER throws - audit logging must not break app flow.
   */
  async log(
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string,
    userId: string,
    context?: Record<string, string>,
  ): Promise<void> {
    try {
      const entry: BufferedAuditEntry = {
        action,
        entityType,
        entityId,
        userId,
        context,
        timestamp: Date.now(),
      };

      if (!this.database) {
        this.buffer.push(entry);
        return;
      }

      await this.writeEntry(entry);
    } catch {
      // Never throw from audit logging
    }
  }

  /**
   * Flushes all buffered audit entries to the database.
   * Called automatically when init() is invoked.
   */
  async flushBuffer(): Promise<void> {
    if (!this.database || this.buffer.length === 0) {
      return;
    }

    try {
      const entries = [...this.buffer];
      this.buffer = [];

      await this.database.write(async () => {
        const collection = this.database!.get(AUDIT_TABLE);
        for (const entry of entries) {
          // WatermelonDB's create callback provides a Model instance.
          // We use `any` here because we do not define a concrete Model
          // subclass for audit_logs -- we write to _raw fields directly.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await collection.create((record: any) => {
            record._raw.action = entry.action;
            record._raw.entity_type = entry.entityType;
            record._raw.entity_id = entry.entityId;
            record._raw.user_id = entry.userId;
            record._raw.context_json = entry.context ? JSON.stringify(entry.context) : null;
            record._raw.created_at = entry.timestamp;
            record._raw.synced = false;
          });
        }
      });
    } catch {
      // If flush fails, entries are lost. This is acceptable for a
      // local audit trail that supplements the server-side audit log.
    }
  }

  /**
   * Returns all audit log entries that have not yet been synced to the server.
   */
  async getUnsyncedLogs(): Promise<Array<{ id: string; action: string; entityType: string; entityId: string }>> {
    if (!this.database) {
      return [];
    }

    try {
      const collection = this.database.get(AUDIT_TABLE);
      const allRecords: Model[] = await collection.query().fetch();

      return allRecords
        .filter((record) => {
          const raw = record._raw as unknown as AuditRawRecord;
          return !raw.synced;
        })
        .map((record) => {
          const raw = record._raw as unknown as AuditRawRecord;
          return {
            id: record.id,
            action: String(raw.action ?? ''),
            entityType: String(raw.entity_type ?? ''),
            entityId: String(raw.entity_id ?? ''),
          };
        });
    } catch {
      return [];
    }
  }

  /**
   * Marks the specified audit log entries as synced.
   */
  async markSynced(ids: string[]): Promise<void> {
    if (!this.database || ids.length === 0) {
      return;
    }

    try {
      const collection = this.database.get(AUDIT_TABLE);
      await this.database.write(async () => {
        for (const id of ids) {
          try {
            const record = await collection.find(id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await record.update((r: any) => {
              r._raw.synced = true;
            });
          } catch {
            // Skip records that no longer exist
          }
        }
      });
    } catch {
      // Non-critical - synced flag is an optimization
    }
  }

  /**
   * Purges audit log entries older than the specified number of days
   * that have already been synced to the server.
   */
  async purgeOld(days: number): Promise<void> {
    if (!this.database) {
      return;
    }

    try {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const collection = this.database.get(AUDIT_TABLE);
      const allRecords: Model[] = await collection.query().fetch();

      const toDelete = allRecords.filter((record) => {
        const raw = record._raw as unknown as AuditRawRecord;
        const createdAt = Number(raw.created_at ?? 0);
        const synced = Boolean(raw.synced);
        return synced && createdAt < cutoff;
      });

      if (toDelete.length > 0) {
        await this.database.write(async () => {
          for (const record of toDelete) {
            await record.destroyPermanently();
          }
        });
      }
    } catch {
      // Non-critical - old logs will be cleaned up on next attempt
    }
  }

  /** Writes a single audit entry to the database */
  private async writeEntry(entry: BufferedAuditEntry): Promise<void> {
    if (!this.database) return;

    await this.database.write(async () => {
      const collection = this.database!.get(AUDIT_TABLE);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await collection.create((record: any) => {
        record._raw.action = entry.action;
        record._raw.entity_type = entry.entityType;
        record._raw.entity_id = entry.entityId;
        record._raw.user_id = entry.userId;
        record._raw.context_json = entry.context ? JSON.stringify(entry.context) : null;
        record._raw.created_at = entry.timestamp;
        record._raw.synced = false;
      });
    });
  }
}

/** Singleton audit logger instance */
export const AuditLogger = new AuditLoggerImpl();
