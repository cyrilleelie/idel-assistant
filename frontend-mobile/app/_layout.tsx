import { useEffect, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Stack, useSegments, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SecurityGate } from '@/security/securityGate';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { useAuthStore } from '@/stores/authStore';
import { useSecurityStore } from '@/stores/securityStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAppState } from '@/hooks/useAppState';
import {
  configureNotifications,
  registerForPushNotifications,
  setupNotificationListeners,
} from '@/services/notificationService';
import Toast from '@/components/ui/Toast';
import { Colors } from '@/constants/colors';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before we decide where to navigate
SplashScreen.preventAutoHideAsync();

/**
 * Offline banner displayed when the device has no internet connection.
 * Positioned at the very top of the layout tree so it appears above all screens.
 */
function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.offlineBanner} accessibilityRole="alert">
      <Text style={styles.offlineBannerText}>Mode hors-ligne</Text>
    </View>
  );
}

/**
 * Root navigation controller. Handles auth-based redirects:
 * - Not authenticated -> (auth)/login
 * - Authenticated but locked -> (lock)/unlock
 * - Authenticated and unlocked -> (tabs)
 */
function RootNavigator() {
  const segments = useSegments();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLocked = useSecurityStore((s) => s.isLocked);
  const setRegistered = useNotificationStore((s) => s.setRegistered);
  const loadPreferences = useNotificationStore((s) => s.loadPreferences);

  // Track app state transitions for auto-lock
  useAppState();

  // Notification initialization — only when authenticated and unlocked
  const notifInitializedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || isLocked || notifInitializedRef.current) return;
    notifInitializedRef.current = true;

    // Configure notifications (handler + Android channel)
    configureNotifications().catch(() => {
      // Non-critical — app continues without notifications
    });

    // Register for push notifications
    registerForPushNotifications()
      .then((token) => {
        if (token) {
          setRegistered(token);
        }
      })
      .catch(() => {
        // Non-critical
      });

    // Load notification preferences from backend/cache
    loadPreferences().catch(() => {
      // Non-critical — defaults are already set
    });

    // Set up notification listeners
    const cleanup = setupNotificationListeners();

    return () => {
      cleanup();
    };
  }, [isAuthenticated, isLocked, setRegistered, loadPreferences]);

  // Reset notification init flag on logout so it re-initializes on next login
  useEffect(() => {
    if (!isAuthenticated) {
      notifInitializedRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Determine which route group the user is currently in
    const inAuthGroup = segments[0] === '(auth)';
    const inLockGroup = segments[0] === '(lock)';

    if (!isAuthenticated) {
      // Not authenticated: redirect to login if not already there
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (isLocked) {
      // Authenticated but locked: redirect to unlock screen
      if (!inLockGroup) {
        router.replace('/(lock)/unlock');
      }
    } else {
      // Authenticated and unlocked: redirect to main tabs if in auth or lock group
      if (inAuthGroup || inLockGroup) {
        router.replace('/(tabs)/tournee');
      }
    }
  }, [isAuthenticated, isLocked, segments, router]);

  useEffect(() => {
    // Hide splash screen once we have determined the initial route
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(lock)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/change-pin" options={{ presentation: 'card' }} />
        <Stack.Screen name="appointment/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="patient/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="transmission/new" options={{ presentation: 'card' }} />
        <Stack.Screen name="transmission/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="invoice/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

/**
 * Root layout wrapping everything in SecurityGate and SafeAreaProvider.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SecurityGate>
          <DatabaseProvider>
            <StatusBar style="dark" />
            <RootNavigator />
            <Toast />
          </DatabaseProvider>
        </SecurityGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: Colors.warning,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBannerText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
