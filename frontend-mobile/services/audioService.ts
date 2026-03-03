/**
 * audioService.ts — Audio recording, encryption, and playback for transmissions.
 *
 * Uses expo-av for recording (AAC .m4a, 16kHz, mono, 64kbps) and playback.
 * Files are encrypted via security/encryption.ts after recording.
 * Decrypted to temp files for playback, then securely deleted.
 */

import { Audio } from 'expo-av';
import { Directory, File, Paths } from 'expo-file-system';
import { encryptFile, decryptFileToBase64, deleteFileSecurely } from '@/security/encryption';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max recording duration in milliseconds (5 minutes) */
const MAX_RECORDING_MS = 5 * 60 * 1000;

/** Metering update interval in milliseconds */
const METERING_INTERVAL_MS = 200;

/** Recording preset: AAC .m4a, 16kHz, mono, 64kbps */
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  web: {
    mimeType: 'audio/mp4',
    bitsPerSecond: 64000,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordingResult {
  /** Temporary file URI (pre-encryption) */
  tempUri: string;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface PlaybackHandle {
  /** The expo-av Sound instance */
  sound: Audio.Sound;
  /** Path to the temporary decrypted file (to clean up after) */
  tempPath: string;
}

// ---------------------------------------------------------------------------
// Audio session
// ---------------------------------------------------------------------------

/**
 * Configure the audio session for recording.
 * Must be called before starting a recording.
 */
export async function configureAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
}

/**
 * Reset the audio session to playback mode (after recording is done).
 */
export async function resetAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Request microphone permission. Returns true if granted.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Start a new audio recording.
 *
 * @param onMetering - Optional callback invoked every 200ms with the current
 *                     metering level (dB, typically -160 to 0).
 * @returns The Recording instance (call stopRecording to finish).
 */
export async function startRecording(
  onMetering?: (db: number) => void,
): Promise<Audio.Recording> {
  await configureAudioSession();

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(RECORDING_OPTIONS);

  if (onMetering) {
    recording.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording && status.metering !== undefined) {
        onMetering(status.metering);
      }
    });
    recording.setProgressUpdateInterval(METERING_INTERVAL_MS);
  }

  await recording.startAsync();
  return recording;
}

/**
 * Stop an active recording and return the result.
 */
export async function stopRecording(recording: Audio.Recording): Promise<RecordingResult> {
  await recording.stopAndUnloadAsync();
  await resetAudioSession();

  const status = await recording.getStatusAsync();
  const uri = recording.getURI();

  if (!uri) {
    throw new Error('Recording URI is null after stop');
  }

  return {
    tempUri: uri,
    durationMs: status.durationMillis ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/**
 * Generate a unique ID for audio files.
 */
function generateAudioId(): string {
  return `audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Encrypt a recording and store it in the app's document directory.
 * Deletes the temporary recording file after encryption.
 *
 * @returns The path to the encrypted file.
 */
export async function encryptRecording(tempUri: string): Promise<string> {
  // Ensure the audio directory exists
  const audioDir = new Directory(Paths.document, 'audio');
  if (!audioDir.exists) {
    audioDir.create();
  }

  const encryptedPath = `${audioDir.uri}/${generateAudioId()}.m4a.enc`;
  await encryptFile(tempUri, encryptedPath);
  await deleteFileSecurely(tempUri);

  return encryptedPath;
}

/**
 * Delete an encrypted recording file.
 */
export async function deleteRecording(encryptedPath: string): Promise<void> {
  await deleteFileSecurely(encryptedPath);
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

/**
 * Play an encrypted audio file.
 * Decrypts to a temp file, creates a Sound, and returns the handle.
 * Call stopPlayback() when done to clean up.
 */
export async function playEncryptedAudio(encryptedPath: string): Promise<PlaybackHandle> {
  await resetAudioSession();

  const base64 = await decryptFileToBase64(encryptedPath);
  const tempFile = new File(Paths.cache, `playback_${Date.now()}.m4a`);

  // Convert base64 back to binary and write
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  tempFile.write(bytes);

  const { sound } = await Audio.Sound.createAsync({ uri: tempFile.uri });
  return { sound, tempPath: tempFile.uri };
}

/**
 * Stop playback and clean up temporary files.
 */
export async function stopPlayback(handle: PlaybackHandle): Promise<void> {
  try {
    await handle.sound.stopAsync();
  } catch {
    // Already stopped
  }
  try {
    await handle.sound.unloadAsync();
  } catch {
    // Already unloaded
  }
  if (handle.tempPath) {
    await deleteFileSecurely(handle.tempPath);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a duration in milliseconds as "MM:SS".
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Max recording duration exported for UI components */
export { MAX_RECORDING_MS };
