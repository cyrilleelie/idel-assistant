// WatermelonDB model for invoice records (NGAP billing)

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Invoice extends Model {
  static table = 'invoices' as const;

  @field('server_id') serverId!: string;
  @field('appointment_id') appointmentId!: string;
  @field('patient_id') patientId!: string;
  @field('invoice_number') invoiceNumber!: string;
  @field('total_amount') totalAmount!: number;
  @field('amount_amo') amountAmo!: number;
  @field('amount_amc') amountAmc!: number;
  @field('amount_patient') amountPatient!: number;
  @field('status') status!: string;
  @field('pdf_local_path') pdfLocalPath!: string | null;
  @field('vitale_status') vitaleStatus!: string;
  @field('created_at') createdAt!: number;
  @field('last_synced_at') lastSyncedAt!: number;

  /** Whether invoice needs validation before transmission */
  get needsValidation(): boolean {
    return this.status === 'draft' || this.status === 'needs_review';
  }
}
