/**
 * notificationService — Push notification management via expo-notifications.
 *
 * Handles:
 * - Permission request and token registration
 * - Notification channel configuration (Android)
 * - Foreground/tap notification listeners
 * - Routing based on notification type
 *
 * SECURITY: Notification payloads MUST NOT contain health data in visible fields.
 * Sensitive content is in data (not displayed on lock screen) and accessed after unlock.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configures the global notification handler and Android channel.
 * Call once at app startup.
 */
export async function configureNotifications(): Promise<void> {
  // Set how notifications are handled when the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'IDEL Assistant',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Requests notification permissions, retrieves the push token,
 * and registers it with the backend.
 *
 * Returns the token string on success, null on failure.
 * This function is resilient: if it fails, the app continues normally.
 *
 * NOTE: Push notifications do NOT work in Expo Go (requires EAS Build).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Physical device check
  if (!Device.isDevice) {
    console.warn('[Notifications] Push notifications require a physical device.');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted.');
      return null;
    }

    // Get the push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    let token: string;

    if (projectId) {
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      token = data;
    } else {
      // Fallback to device push token (FCM/APNs)
      const { data } = await Notifications.getDevicePushTokenAsync();
      token = data as string;
    }

    // Register token with the backend
    try {
      await api.post('/devices/register', {
        token,
        platform: Platform.OS,
        device_name: Device.deviceName ?? 'Unknown',
        app_version: Constants.expoConfig?.version ?? '1.0.0',
      });
    } catch {
      // Backend registration failure is non-blocking
      console.warn('[Notifications] Failed to register token with backend.');
    }

    return token;
  } catch (error) {
    console.warn('[Notifications] Registration failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------

/**
 * Sets up foreground and tap notification listeners.
 * Returns a cleanup function to remove the listeners.
 */
export function setupNotificationListeners(): () => void {
  // Listener 1 — Notification received while app is in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    async (notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      const type = data?.type as NotificationType | undefined;

      switch (type) {
        case 'appointment_cancelled': {
          // Show toast — the store import is dynamic to avoid circular deps
          try {
            const { useToastStore } = await import('@/stores/toastStore');
            useToastStore.getState().showToast(
              'Un RDV de votre tournee a ete annule',
              'info',
            );
            // Bump tournee refresh to reload the list
            const { useTourneeStore } = await import('@/stores/tourneeStore');
            useTourneeStore.getState().bumpRefreshKey();
          } catch {
            // Non-critical
          }
          break;
        }
        case 'new_transmission': {
          try {
            const { useToastStore } = await import('@/stores/toastStore');
            useToastStore.getState().showToast(
              'Nouveau message pour un de vos patients',
              'info',
            );
            const { useNotificationStore } = await import('@/stores/notificationStore');
            useNotificationStore.getState().incrementUnread();
          } catch {
            // Non-critical
          }
          break;
        }
        case 'sync_complete': {
          try {
            const { useToastStore } = await import('@/stores/toastStore');
            useToastStore.getState().showToast('Synchronisation terminee', 'info');
          } catch {
            // Non-critical
          }
          break;
        }
        case 'remote_wipe': {
          // IMMEDIATE: trigger secure wipe silently
          try {
            const { performSecureWipe } = await import('@/security/secureWipe');
            await performSecureWipe('remote_wipe_notification');
          } catch {
            // Critical failure — but we can't do much
          }
          break;
        }
      }
    },
  );

  // Listener 2 — Notification tapped (user taps on the notification)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data?.type as NotificationType | undefined;

      // SecurityGate handles biometric/PIN unlock before any navigation.
      // After unlock, navigate to the appropriate screen.
      switch (type) {
        case 'appointment_cancelled':
          router.navigate('/(tabs)/tournee');
          break;
        case 'new_transmission':
          if (typeof data?.patientId === 'string') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.navigate(`/patient/${data.patientId}/transmissions` as any);
          } else {
            router.navigate('/(tabs)/patients');
          }
          break;
        case 'sync_complete':
          router.navigate('/(tabs)/tournee');
          break;
        // remote_wipe: no navigation — app is being wiped
      }
    },
  );

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
