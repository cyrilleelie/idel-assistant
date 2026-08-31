/**
 * Notification types and constants — separated from notificationService.ts
 * so that stores can import them without triggering expo-notifications side effects.
 */

export interface NotificationPreferences {
  appointmentCancelled: boolean;
  newTransmission: boolean;
  syncConfirmation: boolean;
  silentHoursEnabled: boolean;
  silentHoursStart: string;
  silentHoursEnd: string;
}

export type NotificationType =
  | 'appointment_cancelled'
  | 'new_transmission'
  | 'sync_complete'
  | 'remote_wipe';

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  appointmentCancelled: true,
  newTransmission: true,
  syncConfirmation: false,
  silentHoursEnabled: true,
  silentHoursStart: '22:00',
  silentHoursEnd: '07:00',
};
