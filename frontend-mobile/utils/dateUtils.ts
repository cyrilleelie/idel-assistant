/**
 * dateUtils.ts — Re-export barrel for date/time helpers.
 *
 * AppointmentCard and other components import from '@/utils/dateUtils'.
 * This file re-exports everything from dateHelpers.ts and formatters.ts
 * so those import paths resolve correctly.
 */

export {
  getTodayString,
  addDays,
  formatDateFrench,
  getRelativeDayLabel,
  isWithinOfflineWindow,
  formatTime,
  formatTimeRange,
} from '@/utils/dateHelpers';

export {
  formatPatientName,
  formatLocationType,
  formatCareTypes,
  formatAppointmentStatus,
  estimateDuration,
} from '@/utils/formatters';
