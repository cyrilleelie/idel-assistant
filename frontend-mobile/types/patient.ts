/**
 * types/patient.ts — Plain object types and builder functions for patient
 * and document views.
 *
 * These plain objects decouple UI components from WatermelonDB Model instances,
 * making components easier to test and avoiding accessing model getters outside
 * a database context.
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type Patient from '@/db/models/Patient';
import type Document from '@/db/models/Document';
import { formatPatientName } from '@/utils/formatters';

// ---------------------------------------------------------------------------
// Patient view
// ---------------------------------------------------------------------------

export interface PatientView {
  id: string;
  serverId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  address: string;
  lat: number | null;
  lon: number | null;
  birthDate: string | null;
  status: string;
  isAld: boolean;
  hasActiveBsi: boolean;
  bsiLevel: string | null;
  bsiEndDate: string | null;
  notes: string | null;
  email: string | null;
}

/**
 * Build a PatientView from a WatermelonDB Patient record.
 * Uses _raw to avoid any decorator getter issues.
 */
export function buildPatientView(patient: Patient): PatientView {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (patient as any)._raw;
  const firstName = String(raw.first_name ?? '');
  const lastName = String(raw.last_name ?? '');
  return {
    id: patient.id,
    serverId: String(raw.server_id ?? ''),
    firstName,
    lastName,
    displayName: formatPatientName(firstName, lastName),
    phone: raw.phone ?? null,
    address: String(raw.address ?? ''),
    lat: raw.lat ?? null,
    lon: raw.lon ?? null,
    birthDate: raw.birth_date ?? null,
    status: String(raw.status ?? 'active'),
    isAld: Boolean(raw.is_ald),
    hasActiveBsi: Boolean(raw.has_active_bsi),
    bsiLevel: raw.bsi_level ?? null,
    bsiEndDate: raw.bsi_end_date ?? null,
    notes: raw.notes ?? null,
    email: raw.email ?? null,
  };
}

/**
 * Build PatientViews from an array of Patient records.
 */
export function buildPatientViews(patients: Patient[]): PatientView[] {
  return patients.map(buildPatientView);
}

// ---------------------------------------------------------------------------
// Document view
// ---------------------------------------------------------------------------

export interface DocumentView {
  id: string;
  serverId: string;
  patientId: string;
  fileType: string;
  localFilePath: string | null;
  uploaded: boolean;
  prescriberName: string | null;
  documentDate: string | null;
  note: string | null;
  createdAt: number;
}

/**
 * Build a DocumentView from a WatermelonDB Document record.
 */
export function buildDocumentView(doc: Document): DocumentView {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (doc as any)._raw;
  return {
    id: doc.id,
    serverId: String(raw.server_id ?? ''),
    patientId: String(raw.patient_id ?? ''),
    fileType: String(raw.file_type ?? 'other'),
    localFilePath: raw.local_file_path || null,
    uploaded: Boolean(raw.uploaded),
    prescriberName: raw.prescriber_name ?? null,
    documentDate: raw.document_date ?? null,
    note: raw.note ?? null,
    createdAt: Number(raw.created_at ?? 0),
  };
}

/**
 * Build DocumentViews from an array of Document records.
 */
export function buildDocumentViews(docs: Document[]): DocumentView[] {
  return docs.map(buildDocumentView);
}

/**
 * Fetch all documents for a patient, sorted by document_date DESC.
 */
export async function fetchPatientDocuments(
  database: Database,
  patientId: string,
): Promise<DocumentView[]> {
  const docs = await database
    .get<Document>('documents')
    .query(Q.where('patient_id', patientId))
    .fetch();

  const views = buildDocumentViews(docs);
  // Sort by documentDate DESC (most recent first), then by createdAt DESC
  views.sort((a, b) => {
    if (a.documentDate && b.documentDate) {
      return b.documentDate.localeCompare(a.documentDate);
    }
    return b.createdAt - a.createdAt;
  });
  return views;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate a patient's age from their birth date string.
 * Returns null if birthDate is null or invalid.
 */
export function formatPatientAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} ans`;
}

/**
 * Get a human-readable label for a document file type.
 */
export function formatFileType(fileType: string): string {
  switch (fileType) {
    case 'prescription':
      return 'Ordonnance';
    case 'lab_result':
      return 'Résultat labo';
    case 'photo':
      return 'Photo';
    case 'scan':
      return 'Scan';
    default:
      return 'Document';
  }
}
