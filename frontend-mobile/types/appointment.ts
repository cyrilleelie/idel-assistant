/**
 * View-layer types for the Tournee (daily round) feature.
 *
 * These are plain TypeScript interfaces derived from WatermelonDB models.
 * They are designed for rendering — they include computed fields (isCompleted,
 * isCanceled, isNext) and a nested PatientSummary instead of a raw patient ID.
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type Appointment from '@/db/models/Appointment';
import type Patient from '@/db/models/Patient';
import { formatPatientName } from '@/utils/formatters';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * A fully-resolved appointment ready for display in the Tournee screen.
 * All computed booleans are derived from the status field.
 */
export interface AppointmentView {
  /** WatermelonDB local ID (used for local updates) */
  id: string;
  /** Server-side UUID (used for API calls) */
  serverId: string;
  /** Calendar date — 'YYYY-MM-DD' */
  date: string;
  /** Scheduled start time — 'HH:MM' */
  startTime: string;
  /** Scheduled end time — 'HH:MM' */
  endTime: string;
  /** Position in the daily round (lower = earlier) */
  sortOrder: number;
  /** NGAP act code (e.g., 'BSI', 'AMI 1') */
  careTypeCode: string;
  /** Human-readable care type label */
  careTypeLabel: string;
  /** Visit location: 'home' | 'office' | 'hospital' */
  locationType: string;
  /** Free-text clinical notes, or null */
  notes: string | null;
  /** Lifecycle status: 'scheduled' | 'completed' | 'canceled' */
  status: string;
  /** Unix timestamp (ms) when marked completed, or null */
  completedAt: number | null;
  /** True when status === 'completed' */
  isCompleted: boolean;
  /** True when status is 'canceled' OR 'cancelled' */
  isCanceled: boolean;
  /**
   * True for the first appointment that is neither completed nor canceled.
   * Set by buildAppointmentViews — only one item per list can be isNext.
   */
  isNext: boolean;
  /** Resolved patient data */
  patient: PatientSummary;
}

/**
 * Lightweight patient representation embedded in AppointmentView.
 * Avoids loading the full Patient model for every render.
 */
export interface PatientSummary {
  /** WatermelonDB local ID */
  id: string;
  /** Server-side UUID */
  serverId: string;
  /** Formatted display name: 'LASTNAME Firstname' */
  displayName: string;
  firstName: string;
  lastName: string;
  /** Primary phone number, or null */
  phone: string | null;
  /** Full address string */
  address: string;
  /** GPS latitude, or null if not geocoded */
  lat: number | null;
  /** GPS longitude, or null if not geocoded */
  lon: number | null;
  /** Whether the patient has a long-term condition (ALD) */
  isAld: boolean;
  /** Whether the patient has an active BSI plan */
  hasActiveBsi: boolean;
  /** BSI level label, or null */
  bsiLevel: string | null;
}

/**
 * Aggregated statistics for a daily round.
 * Computed from a list of AppointmentViews via computeTourneeStats().
 */
export interface TourneeStats {
  total: number;
  completed: number;
  canceled: number;
  remaining: number;
  /** Integer percentage 0–100 based on completed / (total - canceled) */
  progressPercent: number;
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

/** Sentinel PatientSummary used when a patient record is not found locally. */
const UNKNOWN_PATIENT: PatientSummary = {
  id: '',
  serverId: '',
  displayName: 'Patient inconnu',
  firstName: '',
  lastName: '',
  phone: null,
  address: '',
  lat: null,
  lon: null,
  isAld: false,
  hasActiveBsi: false,
  bsiLevel: null,
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a list of AppointmentViews from WatermelonDB Appointment records.
 *
 * - Batch-fetches all required Patient records in a single query to avoid
 *   N+1 database calls.
 * - Maps each Appointment + Patient pair to a flat AppointmentView.
 * - Determines the `isNext` flag: the first appointment (by sortOrder) that
 *   is neither completed nor canceled.
 * - Appointments are returned sorted ascending by sortOrder.
 *
 * @param appointments - Array of WatermelonDB Appointment model instances
 * @param database     - Active WatermelonDB Database (used for patient query)
 */
export async function buildAppointmentViews(
  appointments: Appointment[],
  database: Database,
): Promise<AppointmentView[]> {
  if (appointments.length === 0) return [];

  // Collect unique patient IDs from the appointment list
  const patientIds = [...new Set(appointments.map((a) => a.patientId))];

  // Single batch query — avoids N+1 trips to SQLite
  const patientRecords = await database
    .get<Patient>('patients')
    .query(Q.where('id', Q.oneOf(patientIds)))
    .fetch();

  // Index patients by their local WatermelonDB ID for O(1) lookup
  const patientById = new Map<string, Patient>();
  for (const patient of patientRecords) {
    patientById.set(patient.id, patient);
  }

  // Sort appointments by sortOrder ascending
  const sorted = [...appointments].sort((a, b) => a.sortOrder - b.sortOrder);

  // Build views with isNext = false initially
  let nextAssigned = false;

  const views: AppointmentView[] = sorted.map((appt) => {
    const patient = patientById.get(appt.patientId);
    const isCanceled = appt.status === 'canceled' || appt.status === 'cancelled';
    const isCompleted = appt.status === 'completed';

    // isNext: first non-completed, non-canceled appointment in sort order
    let isNext = false;
    if (!nextAssigned && !isCompleted && !isCanceled) {
      isNext = true;
      nextAssigned = true;
    }

    const patientSummary: PatientSummary = patient
      ? {
          id: patient.id,
          serverId: patient.serverId,
          displayName: formatPatientName(patient.firstName, patient.lastName),
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: patient.phone,
          address: patient.address,
          lat: patient.lat,
          lon: patient.lon,
          isAld: Boolean(patient.isAld),
          hasActiveBsi: Boolean(patient.hasActiveBsi),
          bsiLevel: patient.bsiLevel,
        }
      : { ...UNKNOWN_PATIENT };

    return {
      id: appt.id,
      serverId: appt.serverId,
      date: appt.date,
      startTime: appt.startTime,
      endTime: appt.endTime,
      sortOrder: appt.sortOrder,
      careTypeCode: appt.careTypeCode,
      careTypeLabel: appt.careTypeLabel,
      locationType: appt.locationType,
      notes: appt.notes,
      status: appt.status,
      completedAt: appt.completedAt,
      isCompleted,
      isCanceled,
      isNext,
      patient: patientSummary,
    };
  });

  return views;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Computes summary statistics for a daily round from its AppointmentViews.
 *
 * Progress percentage is based on completed / actionable (non-canceled) total.
 * Returns 0 if all appointments are canceled.
 */
export function computeTourneeStats(views: AppointmentView[]): TourneeStats {
  const total = views.length;
  const completed = views.filter((v) => v.isCompleted).length;
  const canceled = views.filter((v) => v.isCanceled).length;
  const remaining = total - completed - canceled;

  const actionable = total - canceled;
  const progressPercent = actionable > 0 ? Math.round((completed / actionable) * 100) : 0;

  return { total, completed, canceled, remaining, progressPercent };
}
