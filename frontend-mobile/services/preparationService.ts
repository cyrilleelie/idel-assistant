/**
 * preparationService.ts — Builds preparation data for the "Prepare My Day" screen.
 *
 * Offline-first: data is assembled from WatermelonDB. When the server
 * endpoint is available, its AI-enriched summaries are used instead.
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type Appointment from '@/db/models/Appointment';
import type Patient from '@/db/models/Patient';
import type Transmission from '@/db/models/Transmission';
import { buildTransmissionView } from '@/types/transmission';
import type { TransmissionView, StructuredContent } from '@/types/transmission';
import { formatPatientName } from '@/utils/formatters';
import { addDays } from '@/utils/dateHelpers';
import { api } from '@/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransmissionSummary {
  id: string;
  authorName: string;
  isCurrentUser: boolean;
  date: string;
  time: string;
  contentText: string | null;
  contentStructured: StructuredContent | null;
  hasAudio: boolean;
  status: string;
}

export interface AiSummary {
  text: string;
  alerts: string[];
  keyVitals: Record<string, string> | null;
}

export interface PatientPreparation {
  patientId: string;
  patientName: string;
  appointmentTime: string;
  appointmentId: string;
  careTypes: string[];
  careTypeLabels: string[];
  locationType: string;
  address: string;
  lastVisitByCurrentUser: string | null;
  transmissionsSinceLastVisit: TransmissionSummary[];
  aiSummary: AiSummary | null;
  hasNewInfo: boolean;
  hasAlerts: boolean;
}

export interface PreparationData {
  date: string;
  totalPatients: number;
  patientsWithNewInfo: number;
  patients: PatientPreparation[];
}

// ---------------------------------------------------------------------------
// Alert keywords
// ---------------------------------------------------------------------------

const ALERT_KEYWORDS = [
  'rougeur',
  'degradation',
  'dégradation',
  'fievre',
  'fièvre',
  'chute',
  'douleur',
  'aggravation',
  'infection',
  'hemorragie',
  'hémorragie',
  'oedeme',
  'oedème',
  'hypoglycemie',
  'hypoglycémie',
  'deshydratation',
  'déshydratation',
];

// ---------------------------------------------------------------------------
// Local builder
// ---------------------------------------------------------------------------

/**
 * Build preparation data entirely from local WatermelonDB.
 */
export async function buildPreparationFromLocal(
  database: Database,
  date: string,
  currentUserId: string,
): Promise<PreparationData> {
  // 1. Query appointments for the date (exclude cancelled)
  const appointments = await database
    .get<Appointment>('appointments')
    .query(
      Q.and(
        Q.where('date', date),
        Q.where('status', Q.notEq('canceled')),
        Q.where('status', Q.notEq('cancelled')),
      ),
    )
    .fetch();

  if (appointments.length === 0) {
    return { date, totalPatients: 0, patientsWithNewInfo: 0, patients: [] };
  }

  // Sort by start_time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sorted = [...appointments].sort((a, b) => {
    const rawA = (a as any)._raw;
    const rawB = (b as any)._raw;
    return String(rawA.start_time ?? '').localeCompare(String(rawB.start_time ?? ''));
  });

  // 2. Collect unique patient IDs and resolve patients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patientIds = [...new Set(sorted.map((a) => String((a as any)._raw.patient_id ?? '')))];

  const patientRecords = await database
    .get<Patient>('patients')
    .query(Q.where('id', Q.oneOf(patientIds)))
    .fetch();

  const patientById = new Map<string, Patient>();
  for (const p of patientRecords) {
    patientById.set(p.id, p);
  }

  // 3. For each patient, find last visit by current user before this date
  const lastVisitMap = new Map<string, string | null>();
  for (const pid of patientIds) {
    const lastVisits = await database
      .get<Appointment>('appointments')
      .query(
        Q.and(
          Q.where('patient_id', pid),
          Q.where('status', 'completed'),
          Q.where('date', Q.lt(date)),
        ),
        Q.sortBy('date', Q.desc),
        Q.take(1),
      )
      .fetch();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lastVisitMap.set(pid, lastVisits.length > 0 ? String((lastVisits[0] as any)._raw.date ?? null) : null);
  }

  // 4. For each patient, fetch transmissions since last visit
  const transmissionMap = new Map<string, TransmissionView[]>();
  for (const pid of patientIds) {
    const lastVisit = lastVisitMap.get(pid);
    const sinceDate = lastVisit ?? addDays(date, -7);
    const sinceTimestamp = new Date(`${sinceDate}T00:00:00`).getTime();

    const txRecords = await database
      .get<Transmission>('transmissions')
      .query(
        Q.and(
          Q.where('patient_id', pid),
          Q.where('created_at', Q.gt(sinceTimestamp)),
        ),
      )
      .fetch();

    const views = txRecords.map(buildTransmissionView);
    views.sort((a, b) => b.createdAt - a.createdAt);
    transmissionMap.set(pid, views);
  }

  // 5. Build PatientPreparation for each appointment
  // Group appointments by patient to merge care types
  const patientApptMap = new Map<string, typeof sorted>();
  for (const appt of sorted) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pid = String((appt as any)._raw.patient_id ?? '');
    const existing = patientApptMap.get(pid);
    if (existing) {
      existing.push(appt);
    } else {
      patientApptMap.set(pid, [appt]);
    }
  }

  const patients: PatientPreparation[] = [];

  for (const pid of patientIds) {
    const patient = patientById.get(pid);
    if (!patient) continue;

    const appts = patientApptMap.get(pid) ?? [];
    if (appts.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstAppt = (appts[0] as any)._raw;
    const careTypes = appts.map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return String((a as any)._raw.care_type_code ?? '');
    });
    const careTypeLabels = appts.map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return String((a as any)._raw.care_type_label ?? '');
    });

    const transmissions = transmissionMap.get(pid) ?? [];
    const lastVisit = lastVisitMap.get(pid);

    // Build summaries
    const txSummaries: TransmissionSummary[] = transmissions.map((tx) => {
      const txDate = new Date(tx.createdAt);
      const year = txDate.getFullYear();
      const month = String(txDate.getMonth() + 1).padStart(2, '0');
      const day = String(txDate.getDate()).padStart(2, '0');
      const hours = String(txDate.getHours()).padStart(2, '0');
      const minutes = String(txDate.getMinutes()).padStart(2, '0');

      return {
        id: tx.id,
        authorName: tx.authorName,
        isCurrentUser: tx.authorUserId === currentUserId,
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`,
        contentText: tx.contentText,
        contentStructured: tx.contentStructured,
        hasAudio: tx.audioFilePath != null,
        status: tx.status,
      };
    });

    // Build AI summary from structured content
    const aiSummary = buildLocalAiSummary(transmissions);
    const hasNewInfo = transmissions.length > 0;
    const hasAlerts = aiSummary != null && aiSummary.alerts.length > 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patientRaw = (patient as any)._raw;

    patients.push({
      patientId: pid,
      patientName: formatPatientName(
        String(patientRaw.first_name ?? ''),
        String(patientRaw.last_name ?? ''),
      ),
      appointmentTime: String(firstAppt.start_time ?? ''),
      appointmentId: appts[0].id,
      careTypes,
      careTypeLabels,
      locationType: String(firstAppt.location_type ?? 'home'),
      address: String(patientRaw.address ?? ''),
      lastVisitByCurrentUser: lastVisit ?? null,
      transmissionsSinceLastVisit: txSummaries,
      aiSummary,
      hasNewInfo,
      hasAlerts,
    });
  }

  // Sort by appointment time (chronological order of the day)
  patients.sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));

  const patientsWithNewInfo = patients.filter((p) => p.hasNewInfo).length;

  return {
    date,
    totalPatients: patients.length,
    patientsWithNewInfo,
    patients,
  };
}

// ---------------------------------------------------------------------------
// Local AI summary builder
// ---------------------------------------------------------------------------

/**
 * Build a simplified AI summary from local transmission data.
 * Aggregates structured content syntheses and detects alert keywords.
 */
function buildLocalAiSummary(transmissions: TransmissionView[]): AiSummary | null {
  if (transmissions.length === 0) return null;

  const syntheses: string[] = [];
  const alerts: string[] = [];
  let lastVitals: Record<string, string> | null = null;

  for (const tx of transmissions) {
    if (tx.contentStructured) {
      if (tx.contentStructured.synthese) {
        syntheses.push(tx.contentStructured.synthese);
      }
      // Extract vitals from most recent transmission
      if (!lastVitals && tx.contentStructured.constantes) {
        lastVitals = parseVitals(tx.contentStructured.constantes);
      }
      // Check all structured fields for alert keywords
      const allText = [
        tx.contentStructured.synthese,
        tx.contentStructured.observations,
        tx.contentStructured.actions,
      ].filter(Boolean).join(' ');
      extractAlerts(allText, alerts);
    } else if (tx.contentText) {
      // No structured content — use raw text
      syntheses.push(tx.contentText.slice(0, 200));
      extractAlerts(tx.contentText, alerts);
    }
  }

  if (syntheses.length === 0 && alerts.length === 0) return null;

  const text = syntheses.length > 0
    ? syntheses.slice(0, 3).join(' ')
    : 'Transmissions disponibles sans synthese structuree.';

  return {
    text,
    alerts: [...new Set(alerts)],
    keyVitals: lastVitals,
  };
}

/**
 * Parse a free-text vitals string into key-value pairs.
 * e.g. "TA : 12/8. Temperature : 36.8°C." → { ta: "12/8", temperature: "36.8°C" }
 */
function parseVitals(constantes: string): Record<string, string> | null {
  const result: Record<string, string> = {};

  // Match patterns like "TA : 12/8" or "Temperature : 36.8°C"
  const taMatch = constantes.match(/TA\s*:\s*([\d/]+)/i);
  if (taMatch) result.ta = taMatch[1];

  const tempMatch = constantes.match(/Temp[eé]rature?\s*:\s*([\d.,]+\s*°?C?)/i);
  if (tempMatch) result.temperature = tempMatch[1];

  const glycMatch = constantes.match(/Glyc[eé]mie[^:]*:\s*([\d.,]+\s*g\/L)/i);
  if (glycMatch) result.glycemie = glycMatch[1];

  const poulsMatch = constantes.match(/Pouls\s*:\s*([\d]+\s*bpm)/i);
  if (poulsMatch) result.pouls = poulsMatch[1];

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract alert phrases from text based on keywords.
 */
function extractAlerts(text: string, alerts: string[]): void {
  const lower = text.toLowerCase();
  for (const keyword of ALERT_KEYWORDS) {
    if (lower.includes(keyword)) {
      // Extract the sentence containing the keyword
      const sentences = text.split(/[.!?]+/).filter(Boolean);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          const trimmed = sentence.trim();
          if (trimmed.length > 0 && !alerts.includes(trimmed)) {
            alerts.push(trimmed);
          }
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// TTS text preprocessing — expand medical abbreviations for natural speech
// ---------------------------------------------------------------------------

const TTS_REPLACEMENTS: [RegExp, string][] = [
  // Blood pressure: "12/8" → "12 sur 8"
  [/(\d+)\/(\d+)/g, '$1 sur $2'],
  // Temperature: "36.8°C" → "36 virgule 8 degrés"
  [/(\d+)[.,](\d+)\s*°\s*C/gi, '$1 virgule $2 degrés'],
  // Units: "g/L" → "grammes par litre"
  [/g\/L/gi, 'grammes par litre'],
  [/bpm/gi, 'battements par minute'],
  [/UI/g, 'unités internationales'],
  [/ml/gi, 'millilitres'],
  [/mg/gi, 'milligrammes'],
  // Medical abbreviations
  [/\bTA\b/g, 'tension artérielle'],
  [/\bT°\b/g, 'température'],
  [/\bAMI\b/g, 'A.M.I.'],
  [/\bAMX\b/g, 'A.M.X.'],
  [/\bBSI\b/g, 'B.S.I.'],
  [/\bBSB\b/g, 'B.S.B.'],
  [/\bHbA1c\b/gi, 'hémoglobine glyquée'],
  [/\bRAS\b/g, 'rien à signaler'],
  [/\bRDV\b/gi, 'rendez-vous'],
  [/\bserum phy\b/gi, 'sérum physiologique'],
  // Punctuation helpers — ensure natural pauses
  [/\s*:\s*/g, ', '],
  [/\.\s*\./g, '.'],
];

/**
 * Preprocess text for TTS: expand abbreviations, fix pronunciation.
 */
function preprocessForTTS(text: string): string {
  let result = text;
  for (const [pattern, replacement] of TTS_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Daily synthesis — structured sections for sequential TTS playback
// ---------------------------------------------------------------------------

/**
 * A section of the daily synthesis, spoken as a separate TTS utterance
 * with a pause between sections for natural pacing.
 */
export interface SynthesisSection {
  /** Label for display (e.g., patient name, "Introduction") */
  label: string;
  /** The text to speak, preprocessed for TTS */
  text: string;
}

/**
 * Build synthesis sections for sequential TTS playback.
 * Each section is spoken separately with pauses between them.
 */
export function buildDailySynthesisSections(data: PreparationData): SynthesisSection[] {
  if (data.totalPatients === 0) {
    return [{ label: 'Résumé', text: 'Aucun rendez-vous prévu.' }];
  }

  const sections: SynthesisSection[] = [];

  // --- Introduction ---
  const introLines: string[] = [];
  introLines.push(
    `Vous avez ${data.totalPatients} patient${data.totalPatients > 1 ? 's' : ''} prévus.`,
  );
  if (data.patientsWithNewInfo > 0) {
    introLines.push(
      `${data.patientsWithNewInfo} avec de nouvelles informations depuis votre dernière visite.`,
    );
  }

  // Collect all alerts
  const allAlerts: string[] = [];
  for (const p of data.patients) {
    if (p.aiSummary && p.aiSummary.alerts.length > 0) {
      for (const alert of p.aiSummary.alerts) {
        allAlerts.push(`${p.patientName}, ${alert}`);
      }
    }
  }
  if (allAlerts.length > 0) {
    introLines.push(
      `Attention, ${allAlerts.length} alerte${allAlerts.length > 1 ? 's' : ''}. ` +
      allAlerts.join('. ') + '.',
    );
  }

  sections.push({ label: 'Introduction', text: preprocessForTTS(introLines.join(' ')) });

  // --- Per-patient sections ---
  for (const p of data.patients) {
    const lines: string[] = [];
    const timeFormatted = p.appointmentTime.replace(':', ' heures ');

    lines.push(`À ${timeFormatted}, ${p.patientName}. ${p.careTypes.join(' plus ')}.`);

    if (p.hasNewInfo && p.transmissionsSinceLastVisit.length > 0) {
      const txCount = p.transmissionsSinceLastVisit.length;
      lines.push(
        `${txCount} transmission${txCount > 1 ? 's' : ''} depuis votre dernière visite.`,
      );

      for (const tx of p.transmissionsSinceLastVisit) {
        if (tx.contentStructured) {
          const sc = tx.contentStructured;
          if (sc.synthese) lines.push(sc.synthese);
          if (sc.soins) lines.push(`Soins réalisés, ${sc.soins}.`);
          if (sc.constantes) lines.push(`Constantes, ${sc.constantes}.`);
          if (sc.observations) lines.push(sc.observations);
          if (sc.actions) lines.push(`À faire, ${sc.actions}.`);
        } else if (tx.contentText) {
          lines.push(tx.contentText);
        }
      }

      if (p.aiSummary && p.aiSummary.alerts.length > 0) {
        for (const alert of p.aiSummary.alerts) {
          lines.push(`Point de vigilance, ${alert}.`);
        }
      }

      if (p.aiSummary?.keyVitals) {
        const v = p.aiSummary.keyVitals;
        const vParts: string[] = [];
        if (v.ta) vParts.push(`tension ${v.ta}`);
        if (v.temperature) vParts.push(`température ${v.temperature}`);
        if (v.glycemie) vParts.push(`glycémie ${v.glycemie}`);
        if (v.pouls) vParts.push(`pouls ${v.pouls}`);
        if (vParts.length > 0) lines.push(`Dernières constantes, ${vParts.join(', ')}.`);
      }
    } else {
      lines.push('Aucune nouvelle transmission.');
    }

    sections.push({
      label: p.patientName,
      text: preprocessForTTS(lines.join(' ')),
    });
  }

  sections.push({ label: 'Fin', text: 'Fin du résumé.' });
  return sections;
}

/**
 * Build the full synthesis as a single string (for display).
 */
export function buildDailySynthesisText(data: PreparationData): string {
  return buildDailySynthesisSections(data).map((s) => s.text).join(' ');
}

// ---------------------------------------------------------------------------
// Server fetch (optional enrichment)
// ---------------------------------------------------------------------------

/**
 * Try to fetch preparation data from the backend.
 * Returns null if the endpoint is unavailable or the request fails.
 */
export async function fetchPreparationFromServer(
  date: string,
): Promise<PreparationData | null> {
  try {
    const response = await api.get<{
      date: string;
      patients: Array<{
        patient_id: string;
        patient_name: string;
        appointment_time: string;
        appointment_id: string;
        care_types: string[];
        care_type_labels: string[];
        location_type: string;
        address: string;
        last_visit_by_current_user: string | null;
        transmissions_since_last_visit: Array<{
          id: string;
          author: string;
          is_current_user: boolean;
          date: string;
          time: string;
          content_text: string | null;
          content_structured: StructuredContent | null;
          has_audio: boolean;
          status: string;
        }>;
        ai_summary: {
          text: string;
          alerts: string[];
          key_vitals: Record<string, string> | null;
        } | null;
      }>;
    }>(`/tournees/${date}/preparation`);

    const data = response.data;
    const patients: PatientPreparation[] = data.patients.map((p) => {
      const hasNewInfo = p.transmissions_since_last_visit.length > 0;
      const hasAlerts = p.ai_summary != null && p.ai_summary.alerts.length > 0;

      return {
        patientId: p.patient_id,
        patientName: p.patient_name,
        appointmentTime: p.appointment_time,
        appointmentId: p.appointment_id,
        careTypes: p.care_types,
        careTypeLabels: p.care_type_labels ?? [],
        locationType: p.location_type,
        address: p.address,
        lastVisitByCurrentUser: p.last_visit_by_current_user,
        transmissionsSinceLastVisit: p.transmissions_since_last_visit.map((tx) => ({
          id: tx.id,
          authorName: tx.author,
          isCurrentUser: tx.is_current_user,
          date: tx.date,
          time: tx.time,
          contentText: tx.content_text,
          contentStructured: tx.content_structured,
          hasAudio: tx.has_audio,
          status: tx.status,
        })),
        aiSummary: p.ai_summary
          ? { text: p.ai_summary.text, alerts: p.ai_summary.alerts, keyVitals: p.ai_summary.key_vitals }
          : null,
        hasNewInfo,
        hasAlerts,
      };
    });

    return {
      date: data.date,
      totalPatients: patients.length,
      patientsWithNewInfo: patients.filter((p) => p.hasNewInfo).length,
      patients,
    };
  } catch {
    return null;
  }
}
