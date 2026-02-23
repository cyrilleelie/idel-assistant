/**
 * Appointment mapper: backend (snake_case) <-> frontend (camelCase)
 *
 * Backend: scheduled_at (ISO datetime), duration_minutes, idel_id, patient_id, care_type, status
 * Frontend: dateStr, startTime, endTime, nurseId, patientId, patient (display name), slotId
 */

import { timeToMinutes } from './dateTime';

function padTime(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutes(timeStr, minutes) {
  const total = timeToMinutes(timeStr) + minutes;
  return padTime(Math.floor(total / 60), total % 60);
}

/**
 * Convert a single backend appointment to frontend format.
 * @param {object} appt - Backend AppointmentResponse
 * @param {Map|object} patientsMap - Map of patientId -> { firstName, lastName }
 */
export function apptApiToFrontend(appt, patientsMap) {
  const dt = new Date(appt.scheduled_at);
  const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const startTime = padTime(dt.getHours(), dt.getMinutes());
  const endTime = addMinutes(startTime, appt.duration_minutes);

  const patient = patientsMap instanceof Map ? patientsMap.get(appt.patient_id) : patientsMap[appt.patient_id];
  const patientName = patient ? `${patient.firstName} ${patient.lastName.toUpperCase()}` : '(Patient inconnu)';

  return {
    id: appt.id,
    dateStr,
    startTime,
    endTime,
    nurseId: appt.idel_id,
    patientId: appt.patient_id,
    patient: patientName,
    slotId: null, // assigned separately via assignSlotIds
    // Preserve backend-only fields
    _apiCareType: appt.care_type || 'soins_infirmiers',
    _apiStatus: appt.status,
    _apiLocationType: appt.location_type || 'home',
  };
}

/**
 * Assign slotId to each appointment based on the active config for its date.
 * Mutates the appointments in place and returns them.
 * @param {Array} appts - Frontend-format appointments
 * @param {Function} getActiveConfigForDate - (Date) => config with .slots
 */
export function assignSlotIds(appts, getActiveConfigForDate) {
  for (const appt of appts) {
    const config = getActiveConfigForDate(new Date(appt.dateStr));
    const startMin = timeToMinutes(appt.startTime);
    const matched = config.slots.find((slot) => {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      return startMin >= slotStart && startMin < slotEnd;
    });
    appt.slotId = matched ? matched.id : null;
  }
  return appts;
}

/**
 * Convert frontend RDV creation data to backend AppointmentCreate payload.
 * @param {object} params - { dateStr, startTime, endTime, nurseId, patientId }
 */
export function frontendToApiCreate({ dateStr, startTime, endTime, nurseId, patientId }) {
  const scheduled_at = `${dateStr}T${startTime}:00`;
  const duration_minutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return {
    patient_id: patientId,
    scheduled_at,
    duration_minutes: duration_minutes > 0 ? duration_minutes : duration_minutes + 1440,
    care_type: 'soins_infirmiers',
    idel_id: nurseId,
  };
}
