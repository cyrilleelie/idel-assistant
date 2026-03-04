/**
 * VoiceRecorder — Push-to-talk recording component for vocal transmissions.
 *
 * 4 states: idle → recording → processing → preview
 * - idle: large mic button, "Appuyez pour dicter"
 * - recording: pulsing red button, timer MM:SS, animated metering bar, auto-stop at 5min
 * - processing: loading spinner "Securisation de l'enregistrement..."
 * - preview: duration, playback bar, Refaire / Valider buttons
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  requestMicrophonePermission,
  startRecording,
  stopRecording,
  encryptRecording,
  deleteRecording,
  formatDuration,
  MAX_RECORDING_MS,
} from '@/services/audioService';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import AudioPlaybackBar from './AudioPlaybackBar';
import { Colors } from '@/constants/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceRecordingResult {
  encryptedPath: string;
  durationMs: number;
}

interface VoiceRecorderProps {
  onRecordingComplete: (result: VoiceRecordingResult) => void;
  onCancel: () => void;
}

type RecorderState = 'idle' | 'recording' | 'processing' | 'preview';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoiceRecorder({
  onRecordingComplete,
  onCancel,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [encryptedPath, setEncryptedPath] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showRetakeModal, setShowRetakeModal] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Metering animation
  const meteringAnim = useRef(new Animated.Value(0)).current;
  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Request permission on mount
  useEffect(() => {
    requestMicrophonePermission().then(setHasPermission);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        stopRecording(recordingRef.current).catch(() => {});
      }
    };
  }, []);

  // Start pulse animation when recording
  useEffect(() => {
    if (state === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [state, pulseAnim]);

  // ── Start recording ─────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (hasPermission === false) {
      Alert.alert(
        'Permission requise',
        'Autorisez l\'acces au microphone dans les reglages.',
      );
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const recording = await startRecording((db: number) => {
        // Normalize metering: db is typically -160 to 0
        const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
        Animated.timing(meteringAnim, {
          toValue: normalized,
          duration: 150,
          useNativeDriver: false,
        }).start();
      });

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setState('recording');
      setDurationMs(0);

      // Start timer
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDurationMs(elapsed);

        // Auto-stop at 5 minutes
        if (elapsed >= MAX_RECORDING_MS) {
          handleStop();
        }
      }, 200);
    } catch {
      Alert.alert('Erreur', 'Impossible de demarrer l\'enregistrement.');
    }
  }, [hasPermission, meteringAnim]);

  // ── Stop recording ──────────────────────────────────────────────────

  const handleStop = useCallback(async () => {
    if (!recordingRef.current) return;

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState('processing');

    try {
      const result = await stopRecording(recordingRef.current);
      recordingRef.current = null;
      setDurationMs(result.durationMs);

      // Encrypt the recording
      const encrypted = await encryptRecording(result.tempUri);
      setEncryptedPath(encrypted);
      setState('preview');
    } catch {
      setState('idle');
      Alert.alert('Erreur', 'Erreur lors de l\'enregistrement.');
    }
  }, []);

  // ── Retake ──────────────────────────────────────────────────────────

  const handleRetakeConfirm = useCallback(async () => {
    setShowRetakeModal(false);
    if (encryptedPath) {
      await deleteRecording(encryptedPath);
      setEncryptedPath(null);
    }
    setDurationMs(0);
    setState('idle');
  }, [encryptedPath]);

  // ── Validate ────────────────────────────────────────────────────────

  const handleValidate = useCallback(() => {
    if (!encryptedPath) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRecordingComplete({
      encryptedPath,
      durationMs,
    });
  }, [encryptedPath, durationMs, onRecordingComplete]);

  // ── Render ──────────────────────────────────────────────────────────

  // Permission denied
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="mic-off-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.permissionText}>
            Acces au microphone requis pour dicter vos transmissions.
          </Text>
          <Pressable
            onPress={() => requestMicrophonePermission().then(setHasPermission)}
            style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
          >
            <Text style={styles.retryBtnText}>Reessayer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // IDLE state
  if (state === 'idle') {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [styles.micButton, pressed && styles.micButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Demarrer l'enregistrement"
          >
            <Ionicons name="mic-outline" size={48} color={Colors.textTertiary} />
          </Pressable>
          <Text style={styles.idleText}>Appuyez pour dicter</Text>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // RECORDING state
  if (state === 'recording') {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleStop}
              style={styles.recordingButton}
              accessibilityRole="button"
              accessibilityLabel="Arreter l'enregistrement"
            >
              <Ionicons name="stop" size={32} color={Colors.white} />
            </Pressable>
          </Animated.View>

          <Text style={styles.timerText}>{formatDuration(durationMs)}</Text>

          {/* Metering bar */}
          <View style={styles.meteringContainer}>
            <Animated.View
              style={[
                styles.meteringBar,
                {
                  width: meteringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['5%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <Text style={styles.recordingHint}>
            Dictez vos observations... (max 5 min)
          </Text>
        </View>
      </View>
    );
  }

  // PROCESSING state
  if (state === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.processingText}>
            Securisation de l'enregistrement...
          </Text>
        </View>
      </View>
    );
  }

  // PREVIEW state
  if (state === 'preview' && encryptedPath) {
    return (
      <View style={styles.container}>
        <View style={styles.previewContent}>
          <Text style={styles.previewTitle}>Enregistrement termine</Text>
          <Text style={styles.previewDuration}>
            Duree : {formatDuration(durationMs)}
          </Text>

          <AudioPlaybackBar
            encryptedPath={encryptedPath}
            durationMs={durationMs}
          />

          <View style={styles.previewActions}>
            <Pressable
              onPress={() => setShowRetakeModal(true)}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.retakeBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Ionicons name="refresh-outline" size={18} color={Colors.text} />
              <Text style={styles.retakeBtnText}>Refaire</Text>
            </Pressable>

            <Pressable
              onPress={handleValidate}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.validateBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Ionicons name="checkmark" size={18} color={Colors.white} />
              <Text style={styles.validateBtnText}>Valider</Text>
            </Pressable>
          </View>
        </View>

        <ConfirmationModal
          visible={showRetakeModal}
          title="Refaire l'enregistrement"
          message="L'enregistrement actuel sera supprime. Continuer ?"
          confirmLabel="Refaire"
          cancelLabel="Garder"
          onConfirm={handleRetakeConfirm}
          onCancel={() => setShowRetakeModal(false)}
          variant="danger"
        />
      </View>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  // Idle
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  micButtonPressed: {
    opacity: 0.7,
    backgroundColor: Colors.primaryUltraLight,
  },
  idleText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  cancelText: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: 8,
  },
  // Recording
  recordingButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  meteringContainer: {
    width: '80%',
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  meteringBar: {
    height: '100%',
    backgroundColor: Colors.danger,
    borderRadius: 3,
  },
  recordingHint: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  // Processing
  processingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  // Preview
  previewContent: {
    flex: 1,
    padding: 24,
    gap: 16,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  previewDuration: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  retakeBtn: {
    backgroundColor: Colors.borderLight,
  },
  validateBtn: {
    backgroundColor: Colors.primary,
  },
  retakeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  validateBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  // Permission denied
  permissionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnPressed: {
    opacity: 0.85,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
});
