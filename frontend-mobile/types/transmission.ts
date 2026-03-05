/**
 * types/transmission.ts — Plain object types and builder functions for
 * transmission views.
 *
 * Same pattern as types/patient.ts: decouple UI from WatermelonDB models,
 * access _raw directly to avoid decorator issues.
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type Transmission from '@/db/models/Transmission';
import { getTodayString, addDays, getRelativeDayLabel, formatDateFrench } from '@/utils/dateHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransmissionStatus =
  | 'draft'
  | 'pending_transcription'
  | 'pending_synthesis'
  | 'transcribed'
  | 'completed'
  | 'error'
  | 'validated';

export interface StructuredContent {
  synthese: string;
  soins: string;
  constantes: string;
  observations: string;
  actions: string;
  alertes?: string[];
}

export interface TransmissionView {
  id: string;
  serverId: string;
  patientId: string;
  appointmentId: string | null;
  authorUserId: string;
  authorName: string;
  contentText: string | null;
  contentStructured: StructuredContent | null;
  audioFilePath: string | null;
  status: TransmissionStatus;
  audioUploaded: boolean;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** Coerce LLM output (string, array, or object) to a flat string. */
function coerceToString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
      .join(', ');
  }
  return JSON.stringify(value);
}

/**
 * Build a TransmissionView from a WatermelonDB Transmission record.
 * Uses _raw to avoid decorator getter issues.
 */
export function buildTransmissionView(tx: Transmission): TransmissionView {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (tx as any)._raw;

  let contentStructured: StructuredContent | null = null;
  const structuredJson = raw.content_structured;
  if (structuredJson) {
    try {
      const parsed = JSON.parse(structuredJson);
      // LLM may return arrays/objects instead of strings — coerce to strings
      const iaAlerts = parsed.alertes ?? parsed.alerts;
      contentStructured = {
        synthese: coerceToString(parsed.synthese),
        soins: coerceToString(parsed.soins),
        constantes: coerceToString(parsed.constantes),
        observations: coerceToString(parsed.observations),
        actions: coerceToString(parsed.actions),
        alertes: Array.isArray(iaAlerts) ? iaAlerts.map(String) : undefined,
      };
    } catch {
      contentStructured = null;
    }
  }

  return {
    id: tx.id,
    serverId: String(raw.server_id ?? ''),
    patientId: String(raw.patient_id ?? ''),
    appointmentId: raw.appointment_id || null,
    authorUserId: String(raw.author_user_id ?? ''),
    authorName: String(raw.author_name ?? ''),
    contentText: raw.content_text || null,
    contentStructured,
    audioFilePath: raw.audio_file_path || null,
    status: (raw.status ?? 'draft') as TransmissionStatus,
    audioUploaded: Boolean(raw.audio_uploaded),
    createdAt: Number(raw.created_at ?? 0),
  };
}

/**
 * Build TransmissionViews from an array of Transmission records.
 */
export function buildTransmissionViews(txs: Transmission[]): TransmissionView[] {
  return txs.map(buildTransmissionView);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all transmissions for a patient, sorted by created_at DESC.
 */
export async function fetchPatientTransmissions(
  database: Database,
  patientId: string,
): Promise<TransmissionView[]> {
  const txs = await database
    .get<Transmission>('transmissions')
    .query(Q.where('patient_id', patientId))
    .fetch();

  const views = buildTransmissionViews(txs);
  views.sort((a, b) => b.createdAt - a.createdAt);
  return views;
}

// ---------------------------------------------------------------------------
// Grouping for SectionList
// ---------------------------------------------------------------------------

export interface TransmissionSection {
  title: string;
  data: TransmissionView[];
}

/**
 * Group transmissions by day for SectionList display.
 * Sections are ordered by date DESC (most recent first).
 * Titles use relative labels (Aujourd'hui, Hier) when applicable,
 * otherwise formatted French date.
 */
export function groupTransmissionsByDay(
  views: TransmissionView[],
): TransmissionSection[] {
  const byDate = new Map<string, TransmissionView[]>();

  for (const view of views) {
    const date = new Date(view.createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const existing = byDate.get(dateStr);
    if (existing) {
      existing.push(view);
    } else {
      byDate.set(dateStr, [view]);
    }
  }

  // Sort date keys DESC
  const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  return sortedDates.map((dateStr) => {
    const relativeLabel = getRelativeDayLabel(dateStr);
    const title = relativeLabel ?? formatDateFrench(dateStr);
    return {
      title,
      data: byDate.get(dateStr)!,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a human-readable label for a transmission status.
 */
export function formatTransmissionStatus(status: TransmissionStatus): string {
  switch (status) {
    case 'draft':
      return 'Brouillon';
    case 'pending_transcription':
      return 'En attente';
    case 'pending_synthesis':
      return 'Synthese...';
    case 'transcribed':
      return 'Transcrit';
    case 'completed':
      return 'Termine';
    case 'error':
      return 'Erreur';
    case 'validated':
      return 'Valide';
    default:
      return status;
  }
}

/**
 * Format a timestamp as HH:MM.
 */
export function formatTransmissionTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
