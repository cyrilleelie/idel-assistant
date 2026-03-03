import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { SECURE_STORE_KEYS } from '@/constants/securityConfig';

/**
 * Manages encryption keys and authentication tokens in expo-secure-store.
 * Keys are stored with WHEN_UNLOCKED_THIS_DEVICE_ONLY on iOS for maximum
 * hardware-backed security. On Android, SecureStore uses the Android Keystore.
 */

type TokenType = 'access' | 'refresh';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = Platform.OS === 'ios'
  ? { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
  : {};

// Helper to safely get a value from SecureStore (returns null on error)
async function safeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
  } catch {
    return null;
  }
}

// Helper to safely set a value in SecureStore
async function safeSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
}

// Helper to safely delete a value from SecureStore
async function safeDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  } catch {
    // Ignore errors when deleting non-existent keys
  }
}

/**
 * Generates DEK (Database Encryption Key) and FEK (File Encryption Key)
 * if they do not already exist. Each key is 32 random bytes stored as hex.
 */
export async function generateAndStoreKeys(): Promise<void> {
  const existingDek = await safeGet(SECURE_STORE_KEYS.DEK);
  if (existingDek) {
    // Keys already exist, do nothing
    return;
  }

  const dekBytes = await Crypto.getRandomBytesAsync(32);
  const fekBytes = await Crypto.getRandomBytesAsync(32);

  const dekHex = bytesToHex(dekBytes);
  const fekHex = bytesToHex(fekBytes);

  await safeSet(SECURE_STORE_KEYS.DEK, dekHex);
  await safeSet(SECURE_STORE_KEYS.FEK, fekHex);
}

/** Returns the Database Encryption Key as a hex string, or null if not generated */
export async function getDatabaseKey(): Promise<string | null> {
  return safeGet(SECURE_STORE_KEYS.DEK);
}

/** Returns the File Encryption Key as a hex string, or null if not generated */
export async function getFileKey(): Promise<string | null> {
  return safeGet(SECURE_STORE_KEYS.FEK);
}

/** Checks whether encryption keys have been generated */
export async function hasKeys(): Promise<boolean> {
  const dek = await safeGet(SECURE_STORE_KEYS.DEK);
  return dek !== null;
}

/** Stores an authentication token (access or refresh) */
export async function storeToken(type: TokenType, token: string): Promise<void> {
  const key = type === 'access' ? SECURE_STORE_KEYS.ACCESS_TOKEN : SECURE_STORE_KEYS.REFRESH_TOKEN;
  await safeSet(key, token);
}

/** Retrieves an authentication token, or null if not stored */
export async function getToken(type: TokenType): Promise<string | null> {
  const key = type === 'access' ? SECURE_STORE_KEYS.ACCESS_TOKEN : SECURE_STORE_KEYS.REFRESH_TOKEN;
  return safeGet(key);
}

/** Deletes both access and refresh tokens */
export async function deleteTokens(): Promise<void> {
  await safeDelete(SECURE_STORE_KEYS.ACCESS_TOKEN);
  await safeDelete(SECURE_STORE_KEYS.REFRESH_TOKEN);
}

/** Stores PIN hash and salt for local authentication */
export async function storePinData(hash: string, salt: string): Promise<void> {
  await safeSet(SECURE_STORE_KEYS.PIN_HASH, hash);
  await safeSet(SECURE_STORE_KEYS.PIN_SALT, salt);
}

/** Returns the stored PIN hash, or null */
export async function getPinHash(): Promise<string | null> {
  return safeGet(SECURE_STORE_KEYS.PIN_HASH);
}

/** Returns the stored PIN salt, or null */
export async function getPinSalt(): Promise<string | null> {
  return safeGet(SECURE_STORE_KEYS.PIN_SALT);
}

/** Returns the current number of failed PIN attempts */
export async function getPinAttempts(): Promise<number> {
  const val = await safeGet(SECURE_STORE_KEYS.PIN_ATTEMPTS);
  return val ? parseInt(val, 10) : 0;
}

/** Sets the number of failed PIN attempts */
export async function setPinAttempts(n: number): Promise<void> {
  await safeSet(SECURE_STORE_KEYS.PIN_ATTEMPTS, String(n));
}

/** Returns the last activity timestamp (ms since epoch), or null */
export async function getLastActivity(): Promise<number | null> {
  const val = await safeGet(SECURE_STORE_KEYS.LAST_ACTIVITY);
  return val ? parseInt(val, 10) : null;
}

/** Stores the last activity timestamp (ms since epoch) */
export async function setLastActivity(timestamp: number): Promise<void> {
  await safeSet(SECURE_STORE_KEYS.LAST_ACTIVITY, String(timestamp));
}

/** Returns whether biometric authentication is enabled */
export async function getBiometricEnabled(): Promise<boolean> {
  const val = await safeGet(SECURE_STORE_KEYS.BIOMETRIC_ENABLED);
  return val === 'true';
}

/** Enables or disables biometric authentication */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await safeSet(SECURE_STORE_KEYS.BIOMETRIC_ENABLED, String(enabled));
}

/** Deletes ALL keys and tokens from SecureStore (used for secure wipe) */
export async function deleteAllKeys(): Promise<void> {
  const allKeys = Object.values(SECURE_STORE_KEYS);
  await Promise.all(allKeys.map((key) => safeDelete(key)));
}

/** Converts a Uint8Array to a lowercase hex string */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
