// WatermelonDB model for offline operation queue (retry logic for failed network ops)

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class OfflineQueueItem extends Model {
  static table = 'offline_queue' as const;

  @field('op_type') opType!: string;
  @field('payload') payload!: string;
  @field('retry_count') retryCount!: number;
  @field('max_retries') maxRetries!: number;
  @field('status') status!: string;
  @field('created_at') createdAt!: number;

  /** Whether this operation has exhausted all retry attempts */
  get isExhausted(): boolean {
    return this.retryCount >= this.maxRetries;
  }
}
