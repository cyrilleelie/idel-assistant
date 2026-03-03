// WatermelonDB model for local audit log entries (HDS compliance)

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class AuditLog extends Model {
  static table = 'audit_logs' as const;

  @field('user_id') userId!: string;
  @field('action') action!: string;
  @field('entity_type') entityType!: string;
  @field('entity_id') entityId!: string;
  @field('context') context!: string | null;
  @field('synced') synced!: boolean;
  @field('created_at') createdAt!: number;
}
