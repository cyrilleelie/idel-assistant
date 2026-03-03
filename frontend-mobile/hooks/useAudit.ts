import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AuditLogger, AuditAction, AuditEntityType } from '@/security/auditLogger';

/**
 * Return type for the useAudit hook.
 */
interface AuditOperations {
  /**
   * Logs an access/action to the audit trail. Auto-fills userId from authStore.
   * Never throws - audit logging failures are silently swallowed.
   */
  logAccess: (
    action: AuditAction,
    entityType: AuditEntityType,
    entityId?: string,
    context?: Record<string, string>,
  ) => void;
}

/**
 * Hook that wraps AuditLogger for convenient use in components.
 * Automatically injects the current user ID from the auth store.
 * All calls are fire-and-forget: audit failures never propagate to the caller.
 */
export function useAudit(): AuditOperations {
  const userId = useAuthStore((s) => s.user?.id);

  const logAccess = useCallback(
    (
      action: AuditAction,
      entityType: AuditEntityType,
      entityId?: string,
      context?: Record<string, string>,
    ): void => {
      try {
        AuditLogger.log(
          action,
          entityType,
          entityId ?? 'unknown',
          userId ?? 'unknown',
          context,
        );
      } catch {
        // Audit logging must never throw
      }
    },
    [userId],
  );

  return { logAccess };
}
