import { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Stack, useSegments, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SecurityGate } from '@/security/securityGate';
import { useAuthStore } from '@/stores/authStore';
import { useSecurityStore } from '@/stores/securityStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAppState } from '@/hooks/useAppState';
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
    <View style={styles.offlineBanner}>
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

  // Track app state transitions for auto-lock
  useAppState();

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
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(lock)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
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
    <SafeAreaProvider>
      <SecurityGate>
        <StatusBar style="dark" />
        <RootNavigator />
      </SecurityGate>
    </SafeAreaProvider>
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
