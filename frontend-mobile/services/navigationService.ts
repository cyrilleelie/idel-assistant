/**
 * navigationService.ts — Utilities for launching external GPS apps and the phone dialer.
 *
 * openNavigation() selects a deep-link URL based on the user's GPS app preference
 * and falls back to the OS-default mapping app when the preferred app is not available.
 *
 * openPhoneDialer() launches the native phone app with the given number.
 *
 * Uses expo-linking for URL handling (consistent across Expo Go and bare workflow).
 */

import * as Linking from 'expo-linking';
import { Platform, Alert } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** GPS application preference stored in settingsStore. */
export type GpsApp = 'system' | 'google_maps' | 'waze' | 'apple_maps';

export interface NavigationTarget {
  lat?: number | null;
  lon?: number | null;
  address: string;
  preference: GpsApp;
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/**
 * Builds a Google Maps deep-link URL.
 * Prefers coordinates when available; falls back to address string.
 */
function buildGoogleMapsUrl(lat: number | null | undefined, lon: number | null | undefined, address: string): string {
  if (lat != null && lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * Builds a Waze deep-link URL.
 * Waze requires lat/lon; falls back to Google Maps when no coordinates are available.
 */
function buildWazeUrl(lat: number | null | undefined, lon: number | null | undefined, address: string): string {
  if (lat != null && lon != null) {
    return `waze://?ll=${lat},${lon}&navigate=yes`;
  }
  // Waze does not support address-only deep-links — fall back to Google Maps
  return buildGoogleMapsUrl(undefined, undefined, address);
}

/**
 * Builds an Apple Maps deep-link URL (iOS only).
 * Uses coordinates when available; falls back to address.
 */
function buildAppleMapsUrl(lat: number | null | undefined, lon: number | null | undefined, address: string): string {
  if (lat != null && lon != null) {
    return `maps://?daddr=${lat},${lon}&dirflg=d`;
  }
  return `maps://?q=${encodeURIComponent(address)}`;
}

/**
 * Builds the default platform navigation URL.
 * iOS → Apple Maps. Android → geo: intent (opens default mapping app).
 */
function buildSystemUrl(lat: number | null | undefined, lon: number | null | undefined, address: string): string {
  if (Platform.OS === 'ios') {
    return buildAppleMapsUrl(lat, lon, address);
  }
  // Android geo intent — handled by the OS default mapping app
  if (lat != null && lon != null) {
    return `geo:${lat},${lon}?q=${lat},${lon}`;
  }
  return `geo:0,0?q=${encodeURIComponent(address)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Opens the preferred GPS application to navigate to the given target.
 *
 * Strategy:
 * 1. Build URL for the preferred GPS app
 * 2. Try Linking.canOpenURL → Linking.openURL
 * 3. If not available, fall back to the system default mapping app
 * 4. If the fallback also fails, show an Alert to the user
 *
 * @param target - Navigation target with optional coordinates, address, and GPS preference
 */
export async function openNavigation(target: NavigationTarget): Promise<void> {
  const { lat, lon, address, preference } = target;

  let primaryUrl: string;

  switch (preference) {
    case 'google_maps':
      primaryUrl = buildGoogleMapsUrl(lat, lon, address);
      break;
    case 'waze':
      primaryUrl = buildWazeUrl(lat, lon, address);
      break;
    case 'apple_maps':
      primaryUrl = buildAppleMapsUrl(lat, lon, address);
      break;
    case 'system':
    default:
      primaryUrl = buildSystemUrl(lat, lon, address);
      break;
  }

  try {
    const canOpenPrimary = await Linking.canOpenURL(primaryUrl);
    if (canOpenPrimary) {
      await Linking.openURL(primaryUrl);
      return;
    }

    // Preferred app not installed — try system fallback
    const fallbackUrl = buildSystemUrl(lat, lon, address);
    const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
    if (canOpenFallback) {
      await Linking.openURL(fallbackUrl);
      return;
    }

    // No navigation app available
    Alert.alert(
      'Navigation impossible',
      "Aucune application de navigation n'est disponible sur cet appareil.",
      [{ text: 'OK' }],
    );
  } catch {
    // Navigation errors must not crash the app
    Alert.alert(
      'Erreur de navigation',
      "Impossible d'ouvrir l'application de navigation.",
      [{ text: 'OK' }],
    );
  }
}

/**
 * Opens the native phone dialer with the given phone number pre-filled.
 * Strips whitespace from the number before building the tel: URI.
 *
 * @param phoneNumber - Phone number string (spaces allowed, will be stripped)
 */
export async function openPhoneDialer(phoneNumber: string): Promise<void> {
  try {
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    const url = `tel:${cleanNumber}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  } catch {
    // Phone dialer errors must not crash the app
  }
}
