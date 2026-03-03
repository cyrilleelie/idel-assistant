import { useCallback } from 'react';
import { encryptFile, decryptFileToBase64 } from '@/security/encryption';

/**
 * Return type for the useSecureFile hook, providing encrypted file operations.
 */
interface SecureFileOperations {
  /** Decrypts a file and returns its content as a base64 string */
  readEncryptedFile: (path: string) => Promise<string>;
  /** Encrypts a source file and writes it to the destination directory. Returns the destination path. */
  writeEncryptedFile: (sourcePath: string, destDir: string) => Promise<string>;
}

/**
 * Hook that wraps security/encryption functions for convenient use in components.
 * Provides readEncryptedFile and writeEncryptedFile operations.
 *
 * Note: currently uses passthrough encryption (see security/encryption.ts).
 * When a real AES-256-GCM native module is added, this hook will automatically
 * use it through the encryption module.
 */
export function useSecureFile(): SecureFileOperations {
  const readEncryptedFile = useCallback(async (path: string): Promise<string> => {
    return decryptFileToBase64(path);
  }, []);

  const writeEncryptedFile = useCallback(
    async (sourcePath: string, destDir: string): Promise<string> => {
      // Extract filename from the source path
      const parts = sourcePath.split('/');
      const filename = parts[parts.length - 1] ?? `encrypted_${Date.now()}`;
      const destPath = `${destDir}/${filename}`;

      await encryptFile(sourcePath, destPath);
      return destPath;
    },
    [],
  );

  return { readEncryptedFile, writeEncryptedFile };
}
