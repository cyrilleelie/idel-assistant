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
 *
 * IMPORTANT: Push notifications do NOT work in Expo Go (requires EAS Build).
 * All functions use dynamic import() so that expo-notifications is never loaded at
 * module level — its side effects crash in Expo Go since SDK 53.
 */

import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/services/api';
import type { NotificationType } from '@/services/notificationTypes';

// Re-export types and constants from the standalone file (no side effects)
export type { NotificationPreferences, NotificationType } from '@/services/notificationTypes';
export { DEFAULT_PREFERENCES } from '@/services/notificationTypes';

/**
 * Detect Expo Go — expo-notifications side effects crash on import in Expo Go
 * since SDK 53, so we must never import the module at all in that environment.
 */
const isExpoGo = Constants.appOwnership === 'expo';

/** Lazy-load expo-notifications. Returns null in Expo Go (never imports the module). */
async function getNotifications() {
  if (isExpoGo) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configures the global notification handler and Android channel.
 * Call once at app startup.
 */
export async function configureNotifications(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

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
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  if (!Device.isDevice) {
    console.warn('[Notifications] Push notifications require a physical device.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted.');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    let token: string;

    if (projectId) {
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      token = data;
    } else {
      const { data } = await Notifications.getDevicePushTokenAsync();
      token = data as string;
    }

    try {
      await api.post('/devices/register', {
        token,
        platform: Platform.OS,
        device_name: Device.deviceName ?? 'Unknown',
        app_version: Constants.expoConfig?.version ?? '1.0.0',
      });
    } catch {
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
export async function setupNotificationListeners(): Promise<() => void> {
  const Notifications = await getNotifications();
  if (!Notifications) return () => {};

  const receivedSubscription = Notifications.addNotificationReceivedListener(
    async (notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      const type = data?.type as NotificationType | undefined;

      switch (type) {
        case 'appointment_cancelled': {
          try {
            const { useToastStore } = await import('@/stores/toastStore');
            useToastStore.getState().showToast(
              'Un RDV de votre tournee a ete annule',
              'info',
            );
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

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data?.type as NotificationType | undefined;

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
      }
    },
  );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
