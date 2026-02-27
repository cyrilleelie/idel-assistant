/**
 * Prescription mapper: backend API (snake_case) <-> frontend care plan (camelCase)
 *
 * Nouveau modèle :
 * - Un CareProtocol (plan de soins) est un conteneur léger (label, dates, statut).
 * - Chaque "soin" est désormais une Prescription DB liée via care_protocol_id.
 *
 * Structure frontend d'un plan de soins :
 *   {
 *     id: 'rx_<uuid>',          // identifiant local dérivé du UUID backend
 *     _apiId: '<uuid>',          // UUID backend du CareProtocol
 *     label: '',
 *     startDate: '',
 *     endDate: '',
 *     status: 'active',
 *     soins: [                   // ordonnances liées chargées séparément
 *       {
 *         id: 'soin_<uuid>',       // identifiant local
 *         _prescriptionId: '<uuid>' | null, // UUID backend de la Prescription
 *         label: '',
 *         care_label_code: null,
 *         startDate: '',
 *         endDate: '',
 *         durationMinutes: 30,
 *         frequency: 'daily',
 *         customFrequency: '',
 *         notes: '',
 *         actCodes: [],
 *         prescriber_name: null,
 *         prescription_date: null,
 *         document_filename: null,  // fichier déjà uploadé
 *         _pendingFile: null,       // File JS en attente d'upload
 *       }
 *     ],
 *     careSchedule: { startTime: '', endTime: '' },
 *   }
 */

function timeStringToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Convertit un CareProtocol API (backend) vers le format frontend.
 * Les soins sont vides ici — ils sont chargés séparément via prescriptionApiToSoin().
 */
export function protocolApiToFrontend(p, prescriptions = []) {
  // Calcule l'heure de début depuis la première prescription active
  const firstPrescr = prescriptions[0];
  const startTime = firstPrescr?.preferred_time
    ? String(firstPrescr.preferred_time).slice(0, 5)
    : '';
  const firstDuration = firstPrescr?.duration_minutes || 30;
  const endTime = startTime
    ? minutesToTimeString(timeStringToMinutes(startTime) + firstDuration)
    : '';

  return {
    id: 'rx_' + p.id,
    _apiId: p.id,
    label: p.label || '',
    startDate: p.start_date || '',
    endDate: p.end_date || '',
    status: p.status || 'active',
    soins: prescriptions.map(prescriptionApiToSoin),
    careSchedule: { startTime, endTime },
  };
}

/**
 * Convertit une Prescription API (backend) vers le format soin frontend.
 */
export function prescriptionApiToSoin(p) {
  return {
    id: 'soin_' + p.id,
    _prescriptionId: p.id,
    label: p.label || '',
    care_label_code: p.care_label_code || null,
    startDate: p.start_date || '',
    endDate: p.end_date || '',
    durationMinutes: p.duration_minutes || 30,
    frequency: p.frequency_display || 'daily',
    customFrequency: p.custom_frequency || '',
    notes: p.notes || '',
    actCodes: p.act_codes || [],
    prescriber_name: p.prescriber_name || '',
    prescriber_rpps: p.prescriber_rpps || '',
    prescription_date: p.prescription_date || '',
    care_description: p.care_description || '',
    document_filename: p.document_filename || null,
    document_url: p.document_url || null,
    document_type: p.document_type || null,
    _pendingFile: null,
  };
}

/**
 * Convertit un soin frontend vers le payload de création de Prescription (POST /prescriptions/).
 */
export function soinToApiCreate(soin, careProtocolId, patientId) {
  return {
    patient_id: patientId,
    care_protocol_id: careProtocolId,
    label: soin.label || '',
    care_label_code: soin.care_label_code || null,
    duration_minutes: Number(soin.durationMinutes) || 30,
    frequency_display: soin.frequency || 'daily',
    custom_frequency: soin.customFrequency || '',
    preferred_time: null, // géré au niveau du plan via careSchedule
    preferred_slot: '',
    recurrence_rule: '',
    prescriber_name: soin.prescriber_name || null,
    prescriber_rpps: soin.prescriber_rpps || null,
    prescription_date: soin.prescription_date || null,
    start_date: soin.startDate || null,
    end_date: soin.endDate || null,
    care_description: soin.care_description || null,
    act_codes: soin.actCodes || [],
    notes: soin.notes || null,
  };
}

/**
 * Convertit un soin frontend vers le payload de mise à jour de Prescription (PUT /prescriptions/{id}).
 */
export function soinToApiUpdate(soin) {
  return {
    label: soin.label || '',
    care_label_code: soin.care_label_code || null,
    duration_minutes: Number(soin.durationMinutes) || 30,
    frequency_display: soin.frequency || 'daily',
    custom_frequency: soin.customFrequency || '',
    prescriber_name: soin.prescriber_name || null,
    prescriber_rpps: soin.prescriber_rpps || null,
    prescription_date: soin.prescription_date || null,
    start_date: soin.startDate || null,
    end_date: soin.endDate || null,
    care_description: soin.care_description || null,
    act_codes: soin.actCodes || [],
    notes: soin.notes || null,
  };
}

/**
 * Convertit un plan de soins frontend vers le payload de création du CareProtocol
 * (POST /care-protocols/).
 */
export function protocolFrontendToApiCreate(rx, patientId) {
  const startDates = (rx.soins || []).map(s => s.startDate).filter(Boolean).sort();
  const endDates = (rx.soins || []).map(s => s.endDate).filter(Boolean).sort();

  return {
    patient_id: patientId,
    label: rx.label || (rx.soins || []).map(s => s.label?.trim()).filter(Boolean).join(', ') || '',
    start_date: rx.startDate || startDates[0] || null,
    end_date: rx.endDate || endDates[endDates.length - 1] || null,
  };
}

/**
 * Convertit un plan de soins frontend vers le payload de mise à jour du CareProtocol
 * (PATCH /care-protocols/{id}).
 */
export function protocolFrontendToApiUpdate(rx) {
  const startDates = (rx.soins || []).map(s => s.startDate).filter(Boolean).sort();
  const endDates = (rx.soins || []).map(s => s.endDate).filter(Boolean).sort();

  const update = {};
  const label = rx.label || (rx.soins || []).map(s => s.label?.trim()).filter(Boolean).join(', ') || '';
  if (label) update.label = label;
  const start = rx.startDate || startDates[0];
  if (start) update.start_date = start;
  const end = rx.endDate || endDates[endDates.length - 1];
  if (end !== undefined) update.end_date = end || null;
  return update;
}

// --- Backward-compat exports (used in cotation tab) ---
export { protocolFrontendToApiCreate as prescriptionFrontendToApiCreate };
export { protocolFrontendToApiUpdate as prescriptionFrontendToApiUpdate };
