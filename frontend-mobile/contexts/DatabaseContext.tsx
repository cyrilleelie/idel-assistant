import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Database } from '@nozbe/watermelondb';
import { initDatabase } from '@/db/database';
import { AuditLogger } from '@/security/auditLogger';

interface DatabaseContextValue {
  database: Database;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

/**
 * Module-level reference to the active database instance.
 * Used by secureWipe to call unsafeResetDatabase() without
 * needing React context access.
 */
let _databaseRef: Database | null = null;

/** Returns the current database instance (if initialized). */
export function getDatabaseRef(): Database | null {
  return _databaseRef;
}

/**
 * Provides a WatermelonDB database instance to the component tree.
 *
 * - Creates the database synchronously via initDatabase() on first render
 *   (SQLiteAdapter construction is synchronous in WatermelonDB)
 * - Initializes the AuditLogger with the database reference so buffered
 *   audit entries are flushed as soon as the DB is available
 * - In development mode, runs the dev seed (idempotent) to populate
 *   realistic data for local testing
 */
export function DatabaseProvider({ children }: { children: ReactNode }): React.JSX.Element {
  // initDatabase() is synchronous — safe to call outside useEffect
  const [database] = useState<Database>(() => initDatabase());

  // Keep module-level ref in sync
  _databaseRef = database;

  useEffect(() => {
    // Initialize audit logger so buffered entries are flushed to DB
    AuditLogger.init(database).catch(() => {
      // Non-critical: audit init failure must not break the app
    });
    // Dev seed is triggered from the tournee screen (needs userId from auth)
  }, [database]);

  return (
    <DatabaseContext.Provider value={{ database }}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Returns the WatermelonDB Database instance from the nearest DatabaseProvider.
 * Throws if called outside of a DatabaseProvider.
 */
export function useDatabase(): Database {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase() must be used within a <DatabaseProvider>');
  }
  return ctx.database;
}
