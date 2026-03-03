/**
 * scanService.ts — Document capture, processing, and storage.
 *
 * Handles image capture from camera or gallery, image processing
 * (resize/compress), and saving documents to WatermelonDB.
 *
 * Expo Go limitations:
 * - expo-camera requires native modules not available in Expo Go
 * - expo-image-picker gallery mode works in Expo Go
 * - Detection via Constants.appOwnership
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import type { Database } from '@nozbe/watermelondb';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentMetadata {
  fileType: string;
  prescriberName?: string;
  documentDate?: string;
  note?: string;
}

export interface CaptureResult {
  uri: string;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Expo Go detection
// ---------------------------------------------------------------------------

/**
 * Returns true if running inside Expo Go (no native modules available).
 */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/**
 * Capture an image from the device camera.
 * Returns null if cancelled or if running in Expo Go.
 *
 * In Expo Go, expo-camera's native bridge is not available.
 * The caller should show a fallback message and offer gallery instead.
 */
export async function captureFromCamera(): Promise<CaptureResult | null> {
  if (isExpoGo()) {
    return null;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  };
}

/**
 * Pick an image from the device gallery.
 * Works in both Expo Go and native builds.
 */
export async function captureFromGallery(): Promise<CaptureResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  };
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

/**
 * Resize and compress an image for storage.
 * Target: max 1200px wide, 70% JPEG quality.
 */
export async function processImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * Save a captured document image to the app's document directory
 * and create a Document record in WatermelonDB.
 *
 * @returns The local WatermelonDB ID of the created document.
 */
export async function saveDocument(
  database: Database,
  patientId: string,
  imageUri: string,
  metadata: DocumentMetadata,
): Promise<string> {
  // Copy image to app documents directory
  const timestamp = Date.now();
  const filename = `doc_${timestamp}.jpg`;
  const destDir = Paths.document;
  const destPath = `${destDir}/${filename}`;

  const source = new File(imageUri);
  const dest = new File(destPath);
  source.copy(dest);

  // Create WatermelonDB record
  const now = Date.now();
  let documentId = '';

  await database.write(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await database.get('documents').create((record: any) => {
      record._raw.server_id = '';
      record._raw.patient_id = patientId;
      record._raw.prescription_id = null;
      record._raw.file_type = metadata.fileType;
      record._raw.local_file_path = destPath;
      record._raw.uploaded = false;
      record._raw.prescriber_name = metadata.prescriberName ?? null;
      record._raw.document_date = metadata.documentDate ?? null;
      record._raw.note = metadata.note ?? null;
      record._raw.created_at = now;
      record._raw.last_synced_at = 0;
    });
    documentId = (doc as { id: string }).id;
  });

  return documentId;
}

/**
 * Delete a document record and its local file.
 */
export async function deleteDocument(
  database: Database,
  documentId: string,
): Promise<void> {
  await database.write(async () => {
    const doc = await database.get('documents').find(documentId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localPath = (doc as any)._raw.local_file_path;

    // Delete local file if it exists
    if (localPath) {
      try {
        const file = new File(localPath);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // File deletion failure is non-critical
      }
    }

    await doc.destroyPermanently();
  });
}
