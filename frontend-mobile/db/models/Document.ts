// WatermelonDB model for document records (prescriptions, photos, scans)

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Document extends Model {
  static table = 'documents' as const;

  @field('server_id') serverId!: string;
  @field('patient_id') patientId!: string;
  @field('prescription_id') prescriptionId!: string | null;
  @field('file_type') fileType!: string;
  @field('local_file_path') localFilePath!: string;
  @field('uploaded') uploaded!: boolean;
  @field('prescriber_name') prescriberName!: string | null;
  @field('document_date') documentDate!: string | null;
  @field('note') note!: string | null;
  @field('created_at') createdAt!: number;
  @field('last_synced_at') lastSyncedAt!: number;

  /** Whether the local file needs to be uploaded to the server */
  get needsUpload(): boolean {
    return !this.uploaded;
  }
}
