// WatermelonDB model for appointment records (mirrors backend Appointment entity)

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Appointment extends Model {
  static table = 'appointments' as const;

  @field('server_id') serverId!: string;
  @field('patient_id') patientId!: string;
  @field('user_id') userId!: string;
  @field('date') date!: string;
  @field('start_time') startTime!: string;
  @field('end_time') endTime!: string;
  @field('care_type_code') careTypeCode!: string;
  @field('care_type_label') careTypeLabel!: string;
  @field('status') status!: string;
  @field('location_type') locationType!: string;
  @field('notes') notes!: string | null;
  @field('sort_order') sortOrder!: number;
  @field('completed_at') completedAt!: number | null;
  @field('last_synced_at') lastSyncedAt!: number;

  /** Whether this appointment has been completed */
  get isCompleted(): boolean {
    return this.status === 'completed';
  }
}
