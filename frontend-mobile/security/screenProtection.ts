import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

/**
 * Enables screen protection (prevents screenshots and screen recording).
 * This is a RGPD/HDS compliance measure to protect patient data
 * displayed on screen from unauthorized capture.
 */
export async function enableScreenProtection(): Promise<void> {
  try {
    await ScreenCapture.preventScreenCaptureAsync();
  } catch {
    // Silently fail - screen protection is best-effort
    // Not all platforms/devices support this feature
  }
}

/**
 * Disables screen protection (allows screenshots and screen recording).
 */
export async function disableScreenProtection(): Promise<void> {
  try {
    await ScreenCapture.allowScreenCaptureAsync();
  } catch {
    // Silently fail
  }
}

/**
 * React hook that enables screen protection on mount and
 * disables it on unmount. Use in screens that display sensitive
 * patient data (transmissions, invoices, patient details).
 *
 * Usage:
 *   function PatientDetailScreen() {
 *     useScreenProtection();
 *     return <View>...</View>;
 *   }
 */
export function useScreenProtection(): void {
  useEffect(() => {
    enableScreenProtection();
    return () => {
      disableScreenProtection();
    };
  }, []);
}
