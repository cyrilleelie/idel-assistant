// WatermelonDB model for cached user profile (available offline)

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class UserCache extends Model {
  static table = 'user_cache' as const;

  @field('server_id') serverId!: string;
  @field('email') email!: string;
  @field('first_name') firstName!: string;
  @field('last_name') lastName!: string;
  @field('rpps') rpps!: string;
  @field('cabinet_id') cabinetId!: string;
  @field('cabinet_name') cabinetName!: string;

  /** Full display name for UI */
  get displayName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
