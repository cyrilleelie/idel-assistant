import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as keyManager from '@/security/keyManager';

/** Result of checking biometric hardware availability */
export interface BiometricAvailability {
  isAvailable: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

/** Result of a biometric authentication attempt */
export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

/**
 * Checks whether biometric hardware is present and enrolled on the device.
 * Returns availability status and supported authentication types
 * (fingerprint, facial recognition, iris).
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { isAvailable: false, supportedTypes: [] };
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    return { isAvailable: false, supportedTypes: [] };
  }

  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return {
    isAvailable: supportedTypes.length > 0,
    supportedTypes,
  };
}

/**
 * Prompts the user for biometric authentication (fingerprint or face).
 * Shows a French-language prompt.
 */
export async function authenticateWithBiometrics(
  reason?: string,
): Promise<BiometricAuthResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason ?? "Veuillez vous authentifier pour accéder à l'application",
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
      fallbackLabel: 'Utiliser le code PIN',
    });

    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error ?? 'Authentification biométrique échouée',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur biométrique inconnue',
    };
  }
}

/**
 * Hashes a PIN with a random 16-byte salt using SHA-256 and stores
 * both the hash and salt in SecureStore via keyManager.
 */
export async function storePinHash(pin: string): Promise<void> {
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + pin,
  );

  await keyManager.storePinData(hash, salt);
}

/**
 * Verifies a PIN against the stored hash.
 * Retrieves the salt, recomputes the hash, and compares.
 */
export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = await keyManager.getPinHash();
  const storedSalt = await keyManager.getPinSalt();

  if (!storedHash || !storedSalt) {
    return false;
  }

  const computedHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    storedSalt + pin,
  );

  return computedHash === storedHash;
}

/** Checks whether a PIN has been configured */
export async function isPinConfigured(): Promise<boolean> {
  const hash = await keyManager.getPinHash();
  return hash !== null;
}

/** Returns the current number of failed PIN attempts */
export async function getPinAttempts(): Promise<number> {
  return keyManager.getPinAttempts();
}

/** Increments the failed PIN attempts counter */
export async function incrementPinAttempts(): Promise<number> {
  const current = await keyManager.getPinAttempts();
  const next = current + 1;
  await keyManager.setPinAttempts(next);
  return next;
}

/** Resets the failed PIN attempts counter to zero */
export async function resetPinAttempts(): Promise<void> {
  await keyManager.setPinAttempts(0);
}

/** Returns whether biometric authentication is enabled by the user */
export async function isBiometricEnabled(): Promise<boolean> {
  return keyManager.getBiometricEnabled();
}

/** Enables or disables biometric authentication */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await keyManager.setBiometricEnabled(enabled);
}
