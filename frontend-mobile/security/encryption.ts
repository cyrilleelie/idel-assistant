import { File, Paths } from 'expo-file-system';

/**
 * TEMPORARY PASSTHROUGH - File encryption wrapper.
 *
 * expo-crypto (SDK 55) provides hashing (SHA-256, etc.) and random bytes
 * generation, but does NOT provide symmetric AES encryption/decryption.
 *
 * The real implementation would:
 * 1. Use a native module (react-native-aes-crypto or similar) for AES-256-GCM
 * 2. Retrieve the FEK (File Encryption Key) from SecureStore via keyManager
 * 3. Generate a random 12-byte IV per file
 * 4. Encrypt file contents with AES-256-GCM(FEK, IV, plaintext)
 * 5. Store IV + ciphertext + auth tag in the destination file
 * 6. For decryption, read IV from file header, decrypt with FEK, verify auth tag
 *
 * For now, files are copied as-is. Security relies on:
 * - iOS: Data Protection (files encrypted at rest by the OS)
 * - Android: File-based encryption (FBE) on modern devices
 * - Both: App sandbox isolation
 *
 * TODO: Replace with real AES-256-GCM when a suitable native module is added.
 */

/**
 * "Encrypts" a file by copying it to the destination path.
 * In the real implementation, this would AES-256-GCM encrypt the file contents.
 */
export async function encryptFile(sourcePath: string, destPath: string): Promise<void> {
  const source = new File(sourcePath);
  const dest = new File(destPath);
  source.copy(dest);
}

/**
 * "Decrypts" a file by reading it and returning base64 content.
 * In the real implementation, this would decrypt AES-256-GCM ciphertext.
 */
export async function decryptFileToBase64(encryptedPath: string): Promise<string> {
  const file = new File(encryptedPath);
  const buffer = await file.arrayBuffer();
  // Convert ArrayBuffer to base64 string
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Deletes a file securely. Best-effort overwrite before deletion.
 * On mobile platforms, the OS file-based encryption handles secure deletion
 * when the encryption key is discarded. This is a defense-in-depth measure.
 */
export async function deleteFileSecurely(path: string): Promise<void> {
  try {
    const file = new File(path);
    if (!file.exists) {
      return;
    }

    // Best-effort overwrite: write zeros before deleting.
    // This is limited in effectiveness on flash storage (wear leveling)
    // but provides defense-in-depth.
    try {
      const info = Paths.info(path);
      const size = (info as { size?: number }).size ?? 0;
      if (size > 0 && size < 10 * 1024 * 1024) {
        // Only overwrite files under 10MB to avoid memory issues
        const zeros = 'A'.repeat(Math.min(size, 4096));
        file.write(zeros);
      }
    } catch {
      // Overwrite failure is non-critical, proceed with deletion
    }

    file.delete();
  } catch {
    // Best effort - never throw from secure delete
  }
}

/**
 * Returns whether real file encryption is available.
 * Currently false because expo-crypto does not support AES symmetric encryption.
 */
export function isEncryptionAvailable(): boolean {
  return false;
}
