/**
 * speechRecognitionService.ts — On-device speech-to-text via expo-speech-recognition.
 *
 * Uses the native SFSpeechRecognizer (iOS) / SpeechRecognizer (Android) APIs
 * with `requiresOnDeviceRecognition: true` so audio never leaves the device.
 *
 * This module is a drop-in alternative to the audio recording + server STT pipeline.
 * To revert, set VOCAL_TRANSMISSION_MODE = 'recording' in constants/config.ts.
 *
 * IMPORTANT: expo-speech-recognition requires a development build (EAS Build).
 * In Expo Go, all functions gracefully degrade to no-ops.
 */

import { Platform } from 'react-native';
import { useCallback } from 'react';

const LANG = 'fr-FR';

// ---------------------------------------------------------------------------
// Safe native module access — expo-speech-recognition crashes in Expo Go
// ---------------------------------------------------------------------------

let SpeechModule: any = null;
let _useSpeechRecognitionEvent: any = null;
let NATIVE_AVAILABLE = false;

try {
  const mod = require('expo-speech-recognition');
  SpeechModule = mod.ExpoSpeechRecognitionModule;
  _useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
  NATIVE_AVAILABLE = !!SpeechModule;
} catch {
  // Native module not available (Expo Go)
  console.warn('[SpeechRecognition] Native module not available — running in Expo Go?');
}

/** Whether the native speech recognition module is available. */
export const isSpeechRecognitionAvailable = NATIVE_AVAILABLE;

/** Check and request speech recognition permission. */
export async function requestSpeechPermission(): Promise<boolean> {
  if (!NATIVE_AVAILABLE) return false;
  try {
    const { granted } = await SpeechModule.requestPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/** Check if on-device recognition is available for French. */
export async function isOnDeviceAvailable(): Promise<boolean> {
  if (!NATIVE_AVAILABLE) return false;
  try {
    const result = await SpeechModule.getSupportedLocales({});
    // installedLocales = on-device models already downloaded
    const installed = result.installedLocales ?? result.locales ?? [];
    return installed.some(
      (l: string) => l.startsWith('fr') || l.toLowerCase().includes('fr'),
    );
  } catch {
    return false;
  }
}

/** Trigger download of the offline French model on Android. No-op on iOS. */
export async function ensureOfflineModel(): Promise<void> {
  if (!NATIVE_AVAILABLE || Platform.OS !== 'android') return;

  const available = await isOnDeviceAvailable();
  if (available) return;

  try {
    await SpeechModule.androidTriggerOfflineModelDownload({
      locale: LANG,
    });
  } catch {
    // User may dismiss the dialog — non-fatal
  }
}

/** Start live speech recognition. Returns nothing — results come via events. */
export async function startListening(onDevice: boolean): Promise<void> {
  if (!NATIVE_AVAILABLE) {
    throw new Error('Speech recognition not available in Expo Go. Use a development build.');
  }
  SpeechModule.start({
    lang: LANG,
    interimResults: true,
    requiresOnDeviceRecognition: onDevice,
    continuous: true,
  });
}

/** Stop speech recognition. */
export function stopListening(): void {
  if (!NATIVE_AVAILABLE) return;
  SpeechModule.stop();
}

/** Abort speech recognition (discard results). */
export function abortListening(): void {
  if (!NATIVE_AVAILABLE) return;
  SpeechModule.abort();
}

/**
 * Re-export the event hook for use in components.
 * In Expo Go (no native module), this is a no-op hook that never fires.
 */
export function useSpeechRecognitionEvent(event: string, handler: (...args: any[]) => void): void {
  if (NATIVE_AVAILABLE && _useSpeechRecognitionEvent) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    _useSpeechRecognitionEvent(event, handler);
  }
}
