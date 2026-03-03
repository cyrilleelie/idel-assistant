/**
 * Pure formatting utilities for the IDEL mobile app.
 *
 * All functions are stateless and have no side effects.
 * No external dependencies.
 */

/**
 * Formats a patient's full name in IDEL convention: LASTNAME Firstname.
 *
 * @example formatPatientName('Marie', 'Dupont') → 'DUPONT Marie'
 */
export function formatPatientName(firstName: string, lastName: string): string {
  return `${lastName.toUpperCase()} ${firstName}`;
}

/**
 * Converts an internal location type code to a French display label.
 *
 * @example formatLocationType('home')     → 'Domicile'
 * @example formatLocationType('office')   → 'Cabinet'
 * @example formatLocationType('hospital') → 'EHPAD'
 */
export function formatLocationType(locationType: string): string {
  switch (locationType) {
    case 'home':
      return 'Domicile';
    case 'office':
      return 'Cabinet';
    case 'hospital':
      return 'EHPAD';
    default:
      return locationType;
  }
}

/**
 * Joins an array of care type labels with ' + ' separator.
 *
 * @example formatCareTypes(['BSI', 'Pansement']) → 'BSI + Pansement'
 * @example formatCareTypes(['AMI 1'])            → 'AMI 1'
 */
export function formatCareTypes(labels: string[]): string {
  return labels.join(' + ');
}

/**
 * Converts an appointment status code to a French display label.
 * Handles both 'canceled' (IDEL API) and 'cancelled' (alternative spelling).
 *
 * @example formatAppointmentStatus('scheduled') → 'Prévu'
 * @example formatAppointmentStatus('completed') → 'Réalisé'
 * @example formatAppointmentStatus('canceled')  → 'Annulé'
 * @example formatAppointmentStatus('cancelled') → 'Annulé'
 */
export function formatAppointmentStatus(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Prévu';
    case 'completed':
      return 'Réalisé';
    case 'canceled':
    case 'cancelled':
      return 'Annulé';
    default:
      return status;
  }
}

/**
 * Estimates the duration between two HH:MM time strings and returns a
 * human-readable label in French convention.
 *
 * Returns null if endTime is null or if the duration cannot be computed.
 *
 * @example estimateDuration('09:00', '09:30') → '30 min'
 * @example estimateDuration('09:00', '10:00') → '1h'
 * @example estimateDuration('09:00', '10:30') → '1h30'
 */
export function estimateDuration(startTime: string, endTime: string | null): string | null {
  if (!endTime) return null;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (
    startH === undefined ||
    startM === undefined ||
    endH === undefined ||
    endM === undefined
  ) {
    return null;
  }

  const totalMinutes = endH * 60 + endM - (startH * 60 + startM);

  if (totalMinutes <= 0) return null;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}
