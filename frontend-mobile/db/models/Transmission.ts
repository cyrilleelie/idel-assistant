// WatermelonDB model for nursing transmission records (ciblage/releve)

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Transmission extends Model {
  static table = 'transmissions' as const;

  @field('server_id') serverId!: string;
  @field('patient_id') patientId!: string;
  @field('appointment_id') appointmentId!: string | null;
  @field('author_user_id') authorUserId!: string;
  @field('author_name') authorName!: string;
  @field('content_text') contentText!: string | null;
  @field('content_structured') contentStructured!: string | null;
  @field('audio_file_path') audioFilePath!: string | null;
  @field('status') status!: string;
  @field('audio_uploaded') audioUploaded!: boolean;
  @field('created_at') createdAt!: number;
  @field('last_synced_at') lastSyncedAt!: number;

  /** Whether audio recording is attached but not yet uploaded */
  get hasPendingAudio(): boolean {
    return this.audioFilePath !== null && !this.audioUploaded;
  }
}
