// WatermelonDB model for patient records (mirrors backend Patient entity)

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Patient extends Model {
  static table = 'patients' as const;

  @field('server_id') serverId!: string;
  @field('first_name') firstName!: string;
  @field('last_name') lastName!: string;
  @field('phone') phone!: string | null;
  @field('address') address!: string;
  @field('lat') lat!: number | null;
  @field('lon') lon!: number | null;
  @field('birth_date') birthDate!: string | null;
  @field('status') status!: string;
  @field('is_ald') isAld!: boolean;
  @field('has_active_bsi') hasActiveBsi!: boolean;
  @field('bsi_level') bsiLevel!: string | null;
  @field('bsi_end_date') bsiEndDate!: string | null;
  @field('notes') notes!: string | null;
  @field('email') email!: string | null;
  @field('last_synced_at') lastSyncedAt!: number;

  /** Full display name for UI lists */
  get displayName(): string {
    return `${this.lastName.toUpperCase()} ${this.firstName}`;
  }
}
