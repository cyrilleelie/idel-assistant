/**
 * Prescription mapper: backend CareProtocol (snake_case) <-> frontend care plan (camelCase)
 *
 * New format: a care plan contains 1-5 "soins", each with its own label, dates,
 * frequency, notes, and documents. The backend stores soins as JSON in the `notes` field.
 *
 * Backend fields: id, patient_id, cabinet_id, care_type, label, frequency_display,
 *   custom_frequency, duration_minutes, recurrence_rule, start_date, end_date,
 *   preferred_time, preferred_slot, status, notes, created_at, updated_at
 *
 * Frontend fields: id (local rx_*), _apiId (backend UUID),
 *   soins: [{ id, label, startDate, endDate, frequency, customFrequency, notes, documents }],
 *   careSchedule: { startTime, endTime }
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
 * Backend CareProtocolResponse → frontend care plan object
 * Retrocompatible: old prescriptions (notes = plain text) become a plan with 1 soin.
 */
export function protocolApiToFrontend(p) {
  // preferred_time comes as "HH:MM:SS" or "HH:MM" — normalize to "HH:MM"
  const startTime = p.preferred_time ? String(p.preferred_time).slice(0, 5) : '';
  const startMinutes = timeStringToMinutes(startTime);
  const endTime = startTime && p.duration_minutes
    ? minutesToTimeString(startMinutes + p.duration_minutes)
    : '';

  // Try to parse notes as JSON { soins: [...] } (new format)
  let soins = null;
  if (p.notes) {
    try {
      const parsed = JSON.parse(p.notes);
      if (parsed && Array.isArray(parsed.soins)) {
        soins = parsed.soins;
      }
    } catch {
      // Not JSON — old format, will be converted below
    }
  }

  if (soins) {
    // New format: soins array from JSON notes
    return {
      id: 'rx_' + p.id,
      _apiId: p.id,
      soins: soins.map(s => ({
        id: s.id || ('soin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
        label: s.label || '',
        startDate: s.startDate || '',
        endDate: s.endDate || '',
        frequency: s.frequency || 'daily',
        customFrequency: s.customFrequency || '',
        notes: s.notes || '',
        documents: s.documents || [],
      })),
      careSchedule: { startTime, endTime },
    };
  }

  // Retrocompatibility: old format → plan with 1 soin
  return {
    id: 'rx_' + p.id,
    _apiId: p.id,
    soins: [{
      id: 'soin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      label: p.label || '',
      startDate: p.start_date || '',
      endDate: p.end_date || '',
      frequency: p.frequency_display || 'daily',
      customFrequency: p.custom_frequency || '',
      notes: p.notes || '',
      documents: [],
    }],
    careSchedule: { startTime, endTime },
  };
}

/**
 * Frontend care plan → backend CareProtocolCreate payload
 */
export function prescriptionFrontendToApiCreate(rx, patientId) {
  const soins = rx.soins || [];
  const startMinutes = timeStringToMinutes(rx.careSchedule?.startTime);
  const endMinutes = timeStringToMinutes(rx.careSchedule?.endTime);
  const duration = endMinutes > startMinutes ? endMinutes - startMinutes : 30;

  const preferredTime = rx.careSchedule?.startTime
    ? rx.careSchedule.startTime + ':00'
    : null;

  // label = concatenation of soin names
  const label = soins.map(s => s.label?.trim()).filter(Boolean).join(', ') || '';

  // start_date = min of all soins startDate
  const startDates = soins.map(s => s.startDate).filter(Boolean).sort();
  const start_date = startDates[0] || '';

  // end_date = max of all soins endDate
  const endDates = soins.map(s => s.endDate).filter(Boolean).sort();
  const end_date = endDates[endDates.length - 1] || null;

  // frequency_display = first soin's frequency, or 'custom' if heterogeneous
  const frequencies = [...new Set(soins.map(s => s.frequency).filter(Boolean))];
  const frequency_display = frequencies.length === 1 ? frequencies[0] : 'custom';

  // Serialize soins array into notes as JSON
  const notes = JSON.stringify({
    soins: soins.map(s => ({
      id: s.id,
      label: s.label || '',
      startDate: s.startDate || '',
      endDate: s.endDate || '',
      frequency: s.frequency || 'daily',
      customFrequency: s.customFrequency || '',
      notes: s.notes || '',
      documents: s.documents || [],
    })),
  });

  return {
    patient_id: patientId,
    care_type: 'soins_infirmiers',
    label,
    frequency_display,
    custom_frequency: soins[0]?.customFrequency || '',
    duration_minutes: duration,
    start_date,
    end_date,
    preferred_time: preferredTime,
    notes,
  };
}

/**
 * Frontend care plan → backend CareProtocolUpdate payload (partial)
 */
export function prescriptionFrontendToApiUpdate(rx) {
  const soins = rx.soins || [];
  const startMinutes = timeStringToMinutes(rx.careSchedule?.startTime);
  const endMinutes = timeStringToMinutes(rx.careSchedule?.endTime);
  const duration = endMinutes > startMinutes ? endMinutes - startMinutes : 30;

  const preferredTime = rx.careSchedule?.startTime
    ? rx.careSchedule.startTime + ':00'
    : null;

  const label = soins.map(s => s.label?.trim()).filter(Boolean).join(', ') || '';

  const startDates = soins.map(s => s.startDate).filter(Boolean).sort();
  const start_date = startDates[0] || '';

  const endDates = soins.map(s => s.endDate).filter(Boolean).sort();
  const end_date = endDates[endDates.length - 1] || null;

  const frequencies = [...new Set(soins.map(s => s.frequency).filter(Boolean))];
  const frequency_display = frequencies.length === 1 ? frequencies[0] : 'custom';

  const notes = JSON.stringify({
    soins: soins.map(s => ({
      id: s.id,
      label: s.label || '',
      startDate: s.startDate || '',
      endDate: s.endDate || '',
      frequency: s.frequency || 'daily',
      customFrequency: s.customFrequency || '',
      notes: s.notes || '',
      documents: s.documents || [],
    })),
  });

  return {
    label,
    frequency_display,
    custom_frequency: soins[0]?.customFrequency || '',
    duration_minutes: duration,
    start_date,
    end_date,
    preferred_time: preferredTime,
    notes,
  };
}
