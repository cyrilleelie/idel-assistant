/**
 * NewTransmissionScreen — Voice or text transmission creation.
 *
 * Query params:
 * - patientId: WatermelonDB local ID of the patient (required)
 * - appointmentId: WatermelonDB local ID of the linked appointment (optional)
 *
 * Two vocal modes (controlled by VOCAL_TRANSMISSION_MODE in config.ts):
 * - 'dictation': On-device speech recognition → text sent to backend (no audio upload)
 * - 'recording': Legacy audio recording → upload → server-side STT
 *
 * To revert to the old audio pipeline, change VOCAL_TRANSMISSION_MODE to 'recording'.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  StyleSheet,
  TextInput,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAudit } from '@/hooks/useAudit';
import { useScreenProtection } from '@/security/screenProtection';
import { api } from '@/services/api';
import * as keyManager from '@/security/keyManager';
import { API_BASE_URL, VOCAL_TRANSMISSION_MODE } from '@/constants/config';
import { buildPatientView } from '@/types/patient';
import type { PatientView } from '@/types/patient';
import {
  requestMicrophonePermission,
  startRecording,
  stopRecording,
  encryptRecording,
  deleteRecording,
  formatDuration,
  MAX_RECORDING_MS,
} from '@/services/audioService';
import {
  isSpeechRecognitionAvailable,
  requestSpeechPermission,
  isOnDeviceAvailable,
  ensureOfflineModel,
  startListening,
  stopListening,
  abortListening,
  useSpeechRecognitionEvent,
} from '@/services/speechRecognitionService';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import AudioPlaybackBar from '@/components/transmission/AudioPlaybackBar';
import { Colors } from '@/constants/colors';
import type Patient from '@/db/models/Patient';

// Dictation mode requires both the config flag AND the native module at runtime.
// In Expo Go the native module is absent, so we fall back to recording mode automatically.
const USE_DICTATION = VOCAL_TRANSMISSION_MODE === 'dictation' && isSpeechRecognitionAvailable;

type InputMode = 'vocal' | 'text';
type RecorderState = 'idle' | 'recording' | 'processing' | 'preview';

// Number of waveform bars to display
const WAVE_BAR_COUNT = 24;

export default function NewTransmissionScreen() {
  const { patientId, appointmentId } = useLocalSearchParams<{
    patientId?: string;
    appointmentId?: string;
  }>();
  const router = useRouter();
  const database = useDatabase();
  const { logAccess } = useAudit();

  useScreenProtection();

  const [mode, setMode] = useState<InputMode>('vocal');
  const [patient, setPatient] = useState<PatientView | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Text mode state
  const [textContent, setTextContent] = useState('');

  // Voice recorder state
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [encryptedPath, setEncryptedPath] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showRetakeModal, setShowRetakeModal] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Waveform animation values
  const waveAnims = useRef(
    Array.from({ length: WAVE_BAR_COUNT }, () => new Animated.Value(0.15))
  ).current;

  // Pulse animation for recording button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Pulsing text animation
  const textOpacityAnim = useRef(new Animated.Value(1)).current;
  const textPulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ======= DICTATION MODE STATE =======
  const [dictationText, setDictationText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [onDeviceReady, setOnDeviceReady] = useState<boolean | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);

  // Dictation event listeners (hooks are always called, but only effective in dictation mode)
  useSpeechRecognitionEvent('result', (event) => {
    if (!USE_DICTATION) return;
    const transcript = event.results?.[0]?.transcript ?? '';
    if (event.isFinal) {
      setDictationText((prev) => {
        const separator = prev.length > 0 ? ' ' : '';
        return prev + separator + transcript;
      });
      setInterimText('');
    } else {
      setInterimText(transcript);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (!USE_DICTATION) return;
    setIsDictating(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!USE_DICTATION) return;
    console.warn('[Dictation] Error:', event.error, event.message);
    setIsDictating(false);
    // "no-speech" is normal when user pauses — don't show as error
    if (event.error !== 'no-speech') {
      setDictationError(event.message || 'Erreur de reconnaissance vocale.');
    }
  });

  // Request permission on mount (dictation or recording)
  useEffect(() => {
    if (USE_DICTATION) {
      requestSpeechPermission().then((granted) => {
        setHasPermission(granted);
        if (granted) {
          isOnDeviceAvailable().then(setOnDeviceReady);
          ensureOfflineModel();
        }
      });
    } else {
      requestMicrophonePermission().then(setHasPermission);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (USE_DICTATION) {
        abortListening();
      } else if (recordingRef.current) {
        stopRecording(recordingRef.current).catch(() => {});
      }
    };
  }, []);

  // Start pulse animations when recording
  useEffect(() => {
    if (recorderState === 'recording') {
      // Button pulse
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
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

      // Text pulse
      textPulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(textOpacityAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(textOpacityAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      textPulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
      textPulseLoop.current?.stop();
      textOpacityAnim.setValue(1);
    }
  }, [recorderState, pulseAnim, textOpacityAnim]);

  // -- Load patient --

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    database
      .get<Patient>('patients')
      .find(patientId)
      .then((pat) => {
        if (!cancelled) setPatient(buildPatientView(pat));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [patientId, database]);

  // -- Timer display --

  const minutes = useMemo(() => {
    const totalSeconds = Math.floor(durationMs / 1000);
    return String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  }, [durationMs]);

  const seconds = useMemo(() => {
    const totalSeconds = Math.floor(durationMs / 1000);
    return String(totalSeconds % 60).padStart(2, '0');
  }, [durationMs]);

  // -- Voice recording handlers --

  const handleStartRecording = useCallback(async () => {
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
        // Animate waveform bars with metering
        const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
        waveAnims.forEach((anim, i) => {
          const randomVariation = 0.15 + normalized * (0.3 + Math.random() * 0.55);
          Animated.timing(anim, {
            toValue: randomVariation,
            duration: 120,
            useNativeDriver: false,
          }).start();
        });
      });

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setRecorderState('recording');
      setDurationMs(0);

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDurationMs(elapsed);

        if (elapsed >= MAX_RECORDING_MS) {
          handleStopRecording();
        }
      }, 200);
    } catch {
      Alert.alert('Erreur', 'Impossible de demarrer l\'enregistrement.');
    }
  }, [hasPermission, waveAnims]);

  const handleStopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setRecorderState('processing');

    try {
      const result = await stopRecording(recordingRef.current);
      recordingRef.current = null;
      setDurationMs(result.durationMs);

      const encrypted = await encryptRecording(result.tempUri);
      setEncryptedPath(encrypted);
      setRecorderState('preview');
    } catch {
      setRecorderState('idle');
      Alert.alert('Erreur', 'Erreur lors de l\'enregistrement.');
    }
  }, []);

  const handleRetakeConfirm = useCallback(async () => {
    setShowRetakeModal(false);
    if (encryptedPath) {
      await deleteRecording(encryptedPath);
      setEncryptedPath(null);
    }
    setDurationMs(0);
    setRecorderState('idle');
  }, [encryptedPath]);

  // -- Vocal complete: upload to backend --

  const handleVocalComplete = useCallback(async () => {
    if (!patientId || !encryptedPath || isSaving) return;
    setIsSaving(true);

    try {
      let fileUri = encryptedPath;
      if (!fileUri.startsWith('file://')) {
        fileUri = `file://${fileUri}`;
      }

      const token = await keyManager.getToken('access');

      const uploadUrl = `${API_BASE_URL}/transmissions/upload-audio`;
      const params: Record<string, string> = {
        patient_id: patientId,
        duration_ms: String(durationMs),
      };
      if (appointmentId) {
        params.appointment_id = appointmentId;
      }

      console.log('[Transmission] Uploading audio:', { fileUri, uploadUrl, params });

      const uploadResp = await uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'audio/mp4',
        parameters: params,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      console.log('[Transmission] Upload response:', uploadResp.status, uploadResp.body);

      if (uploadResp.status < 200 || uploadResp.status >= 300) {
        throw new Error(`Upload failed (${uploadResp.status}): ${uploadResp.body}`);
      }

      const { triggerSync } = await import('@/services/syncService');
      await triggerSync(database).catch(() => {});

      logAccess('create_transmission', 'transmission', patientId);

      Alert.alert('Enregistre', 'Votre transmission vocale a ete envoyee. La transcription sera disponible dans quelques instants.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error('[Transmission] Upload error:', err);
      const detail = (err as Error).message || 'Erreur inconnue';
      Alert.alert('Erreur', `Impossible d'envoyer la transmission vocale.\n\n${detail}`);
    } finally {
      setIsSaving(false);
    }
  }, [patientId, encryptedPath, appointmentId, database, logAccess, router, isSaving, durationMs]);

  // -- Text submit --

  const handleTextSubmit = useCallback(async () => {
    if (!patientId || isSaving || !textContent.trim()) return;
    setIsSaving(true);

    try {
      await api.post('/transmissions', {
        patient_id: patientId,
        appointment_id: appointmentId || null,
        type: 'written',
        transcription: textContent.trim(),
      });

      const { triggerSync } = await import('@/services/syncService');
      await triggerSync(database).catch(() => {});

      logAccess('create_transmission', 'transmission', patientId);

      Alert.alert('Enregistre', 'Votre transmission a ete sauvegardee.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder la transmission.');
    } finally {
      setIsSaving(false);
    }
  }, [patientId, appointmentId, database, logAccess, router, isSaving, textContent]);

  // -- Dictation handlers --

  const handleStartDictation = useCallback(async () => {
    if (hasPermission === false) {
      Alert.alert(
        'Permission requise',
        'Autorisez la reconnaissance vocale dans les réglages.',
      );
      return;
    }

    try {
      setDictationError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await startListening(onDeviceReady === true);
      setIsDictating(true);
    } catch {
      setDictationError('Impossible de démarrer la dictée.');
    }
  }, [hasPermission, onDeviceReady]);

  const handleStopDictation = useCallback(() => {
    stopListening();
    setIsDictating(false);
  }, []);

  const handleClearDictation = useCallback(() => {
    setDictationText('');
    setInterimText('');
    setDictationError(null);
  }, []);

  const handleDictationSubmit = useCallback(async () => {
    if (!patientId || isSaving || !dictationText.trim()) return;
    setIsSaving(true);

    try {
      await api.post('/transmissions', {
        patient_id: patientId,
        appointment_id: appointmentId || null,
        type: 'written',
        transcription: dictationText.trim(),
      });

      const { triggerSync } = await import('@/services/syncService');
      await triggerSync(database).catch(() => {});

      logAccess('create_transmission', 'transmission', patientId);

      Alert.alert('Enregistré', 'Votre transmission vocale a été sauvegardée.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder la transmission.');
    } finally {
      setIsSaving(false);
    }
  }, [patientId, appointmentId, database, logAccess, router, isSaving, dictationText]);

  // -- Cancel --

  const handleCancel = useCallback(() => {
    if (USE_DICTATION && isDictating) {
      abortListening();
      setIsDictating(false);
    }
    router.back();
  }, [router, isDictating]);

  // -- Render --

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: styles.headerBar,
          headerLeft: () => (
            <Pressable onPress={handleCancel} hitSlop={8} style={styles.headerCloseBtn}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          ),
          headerTitle: () => (
            <Text style={styles.headerTitleText}>Nouvelle Transmission</Text>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Patient info bar */}
        {patient && (
          <View style={styles.patientBar}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>
                {patient.displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.patientName}>{patient.displayName}</Text>
          </View>
        )}

        {/* Mode toggle */}
        <View style={styles.modeToggleContainer}>
          <View style={styles.modeToggle}>
            <Pressable
              onPress={() => setMode('vocal')}
              style={[styles.modeBtn, mode === 'vocal' && styles.modeBtnActive]}
            >
              <Ionicons
                name="mic-outline"
                size={18}
                color={mode === 'vocal' ? Colors.primary : Colors.textTertiary}
              />
              <Text
                style={[styles.modeBtnText, mode === 'vocal' && styles.modeBtnTextActive]}
              >
                Vocal
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('text')}
              style={[styles.modeBtn, mode === 'text' && styles.modeBtnActive]}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={mode === 'text' ? Colors.primary : Colors.textTertiary}
              />
              <Text
                style={[styles.modeBtnText, mode === 'text' && styles.modeBtnTextActive]}
              >
                Ecrit
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Content area */}
        {mode === 'vocal' ? (
          <View style={styles.vocalContent}>
            {/* Permission denied */}
            {hasPermission === false && (
              <View style={styles.centered}>
                <Ionicons name="mic-off-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.permissionText}>
                  {USE_DICTATION
                    ? 'Accès à la reconnaissance vocale requis pour dicter vos transmissions.'
                    : 'Accès au microphone requis pour dicter vos transmissions.'}
                </Text>
                <Pressable
                  onPress={() =>
                    USE_DICTATION
                      ? requestSpeechPermission().then(setHasPermission)
                      : requestMicrophonePermission().then(setHasPermission)
                  }
                  style={({ pressed }) => [styles.retryPermBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.retryPermBtnText}>Réessayer</Text>
                </Pressable>
              </View>
            )}

            {/* ========== DICTATION MODE ========== */}
            {USE_DICTATION && hasPermission !== false && (
              <>
                <ScrollView
                  style={styles.dictationScrollView}
                  contentContainerStyle={styles.dictationScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* On-device badge */}
                  {onDeviceReady !== null && (
                    <View style={styles.dictationBadgeRow}>
                      <View style={[
                        styles.dictationBadge,
                        onDeviceReady ? styles.dictationBadgeLocal : styles.dictationBadgeCloud,
                      ]}>
                        <Ionicons
                          name={onDeviceReady ? 'phone-portrait-outline' : 'cloud-outline'}
                          size={14}
                          color={onDeviceReady ? Colors.success : Colors.warning}
                        />
                        <Text style={[
                          styles.dictationBadgeText,
                          { color: onDeviceReady ? Colors.success : Colors.warning },
                        ]}>
                          {onDeviceReady ? 'Reconnaissance locale' : 'Reconnaissance en ligne'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Transcript area */}
                  <View style={styles.dictationTextBox}>
                    {dictationText || interimText ? (
                      <Text style={styles.dictationTranscript}>
                        {dictationText}
                        {interimText ? (
                          <Text style={styles.dictationInterim}>
                            {dictationText ? ' ' : ''}{interimText}
                          </Text>
                        ) : null}
                      </Text>
                    ) : (
                      <Text style={styles.dictationPlaceholder}>
                        {isDictating
                          ? 'Parlez maintenant...'
                          : 'Appuyez sur le micro pour commencer la dictée'}
                      </Text>
                    )}
                  </View>

                  {/* Error message */}
                  {dictationError && (
                    <View style={styles.dictationErrorBox}>
                      <Ionicons name="warning-outline" size={16} color={Colors.error} />
                      <Text style={styles.dictationErrorText}>{dictationError}</Text>
                    </View>
                  )}
                </ScrollView>

                {/* Dictation mic button */}
                <View style={styles.dictationControls}>
                  {dictationText.length > 0 && !isDictating && (
                    <Pressable
                      onPress={handleClearDictation}
                      style={({ pressed }) => [styles.dictationClearBtn, pressed && { opacity: 0.7 }]}
                      accessibilityLabel="Effacer la dictée"
                    >
                      <Ionicons name="trash-outline" size={20} color={Colors.error} />
                    </Pressable>
                  )}

                  <Pressable
                    onPress={isDictating ? handleStopDictation : handleStartDictation}
                    style={({ pressed }) => [
                      styles.dictationMicBtn,
                      isDictating && styles.dictationMicBtnActive,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={isDictating ? 'Arrêter la dictée' : 'Démarrer la dictée'}
                  >
                    <Ionicons
                      name={isDictating ? 'stop' : 'mic'}
                      size={32}
                      color={Colors.white}
                    />
                  </Pressable>

                  {isDictating && (
                    <View style={styles.dictationLiveIndicator}>
                      <View style={styles.dictationLiveDot} />
                      <Text style={styles.dictationLiveText}>Écoute...</Text>
                    </View>
                  )}
                </View>

                {/* Bottom actions for dictation */}
                <View style={styles.bottomActions}>
                  <Pressable
                    onPress={handleCancel}
                    style={({ pressed }) => [styles.bottomBtn, styles.bottomBtnCancel, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.bottomBtnCancelText}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDictationSubmit}
                    disabled={isSaving || !dictationText.trim()}
                    style={({ pressed }) => [
                      styles.bottomBtn,
                      styles.bottomBtnPrimary,
                      (!dictationText.trim() || isSaving) && styles.bottomBtnDisabled,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color={Colors.white} />
                        <Text style={styles.bottomBtnPrimaryText}>Envoyer</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {/* ========== RECORDING MODE (legacy) ========== */}
            {!USE_DICTATION && hasPermission !== false && (
              <>
                {/* IDLE state */}
                {recorderState === 'idle' && (
                  <View style={styles.centered}>
                    <View style={styles.timerRow}>
                      <View style={styles.timerBox}>
                        <Text style={styles.timerValue}>00</Text>
                      </View>
                      <Text style={styles.timerColon}>:</Text>
                      <View style={[styles.timerBox, styles.timerBoxAccent]}>
                        <Text style={[styles.timerValue, styles.timerValueAccent]}>00</Text>
                      </View>
                    </View>

                    <View style={styles.waveformContainer}>
                      {waveAnims.map((_, i) => (
                        <View key={i} style={[styles.waveBar, styles.waveBarIdle]} />
                      ))}
                    </View>

                    <Pressable
                      onPress={handleStartRecording}
                      style={({ pressed }) => [styles.micButton, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Démarrer l'enregistrement"
                    >
                      <Ionicons name="mic" size={48} color={Colors.white} />
                    </Pressable>

                    <Text style={styles.idleHint}>Appuyez pour commencer</Text>
                  </View>
                )}

                {/* RECORDING state */}
                {recorderState === 'recording' && (
                  <View style={styles.centered}>
                    <View style={styles.timerRow}>
                      <View style={styles.timerBox}>
                        <Text style={styles.timerValue}>{minutes}</Text>
                      </View>
                      <Text style={styles.timerColon}>:</Text>
                      <View style={[styles.timerBox, styles.timerBoxAccent]}>
                        <Text style={[styles.timerValue, styles.timerValueAccent]}>{seconds}</Text>
                      </View>
                    </View>

                    <View style={styles.waveformContainer}>
                      {waveAnims.map((anim, i) => (
                        <Animated.View
                          key={i}
                          style={[
                            styles.waveBar,
                            {
                              height: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [4, 48],
                              }),
                            },
                          ]}
                        />
                      ))}
                    </View>

                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <Pressable
                        onPress={handleStopRecording}
                        style={styles.recordingButton}
                        accessibilityRole="button"
                        accessibilityLabel="Arrêter l'enregistrement"
                      >
                        <Ionicons name="mic" size={48} color={Colors.white} />
                      </Pressable>
                    </Animated.View>

                    <Animated.Text style={[styles.recordingHint, { opacity: textOpacityAnim }]}>
                      Enregistrement en cours...
                    </Animated.Text>
                  </View>
                )}

                {/* PROCESSING state */}
                {recorderState === 'processing' && (
                  <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.processingText}>
                      Sécurisation de l'enregistrement...
                    </Text>
                  </View>
                )}

                {/* PREVIEW state */}
                {recorderState === 'preview' && encryptedPath && (
                  <View style={styles.previewContent}>
                    <View style={styles.previewHeader}>
                      <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                      <Text style={styles.previewTitle}>Enregistrement terminé</Text>
                      <Text style={styles.previewDuration}>
                        Durée : {formatDuration(durationMs)}
                      </Text>
                    </View>

                    <AudioPlaybackBar
                      encryptedPath={encryptedPath}
                      durationMs={durationMs}
                    />

                    <ConfirmationModal
                      visible={showRetakeModal}
                      title="Refaire l'enregistrement"
                      message="L'enregistrement actuel sera supprimé. Continuer ?"
                      confirmLabel="Refaire"
                      cancelLabel="Garder"
                      onConfirm={handleRetakeConfirm}
                      onCancel={() => setShowRetakeModal(false)}
                      variant="danger"
                    />
                  </View>
                )}

                {/* Bottom action buttons for recording idle/recording */}
                {(recorderState === 'idle' || recorderState === 'recording') && (
                  <View style={styles.bottomActions}>
                    <Pressable
                      onPress={handleCancel}
                      style={({ pressed }) => [styles.bottomBtn, styles.bottomBtnCancel, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.bottomBtnCancelText}>Annuler</Text>
                    </Pressable>
                    {recorderState === 'recording' && (
                      <Pressable
                        onPress={handleStopRecording}
                        style={({ pressed }) => [styles.bottomBtn, styles.bottomBtnPrimary, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.bottomBtnPrimaryText}>Terminer</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Bottom action buttons for preview */}
                {recorderState === 'preview' && (
                  <View style={styles.bottomActions}>
                    <Pressable
                      onPress={() => setShowRetakeModal(true)}
                      style={({ pressed }) => [styles.bottomBtn, styles.bottomBtnCancel, pressed && { opacity: 0.85 }]}
                    >
                      <Ionicons name="refresh-outline" size={18} color={Colors.text} />
                      <Text style={styles.bottomBtnCancelText}>Refaire</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleVocalComplete}
                      disabled={isSaving}
                      style={({ pressed }) => [styles.bottomBtn, styles.bottomBtnPrimary, pressed && { opacity: 0.85 }]}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={18} color={Colors.white} />
                          <Text style={styles.bottomBtnPrimaryText}>Envoyer</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          /* TEXT mode */
          <View style={styles.textContent}>
            <ScrollView style={styles.textScrollView} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.textArea}
                value={textContent}
                onChangeText={setTextContent}
                placeholder="Saisissez votre transmission..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                textAlignVertical="top"
                autoFocus
              />
            </ScrollView>
            <View style={styles.bottomActions}>
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [styles.bottomBtn, styles.bottomBtnCancel, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.bottomBtnCancelText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleTextSubmit}
                disabled={isSaving || !textContent.trim()}
                style={({ pressed }) => [
                  styles.bottomBtn,
                  styles.bottomBtnPrimary,
                  (!textContent.trim() || isSaving) && styles.bottomBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.bottomBtnPrimaryText}>Envoyer</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: Colors.surface,
  },
  headerCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Patient info bar
  patientBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  patientAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  // Mode toggle
  modeToggleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  modeBtnTextActive: {
    color: Colors.primary,
  },
  // Vocal content
  vocalContent: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 24,
  },
  // Timer
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBoxAccent: {
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 1.5,
    borderColor: `${Colors.primary}30`,
  },
  timerValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  timerValueAccent: {
    color: Colors.primary,
  },
  timerColon: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textTertiary,
  },
  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 56,
    paddingHorizontal: 24,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  waveBarIdle: {
    height: 6,
    opacity: 0.3,
  },
  // Mic button (idle)
  micButton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  idleHint: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  // Recording button
  recordingButton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  recordingHint: {
    fontSize: 15,
    color: Colors.error,
    fontWeight: '600',
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
    gap: 20,
    justifyContent: 'center',
  },
  previewHeader: {
    alignItems: 'center',
    gap: 8,
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
  // Permission
  permissionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryPermBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryPermBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  // Bottom action buttons
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  bottomBtnCancel: {
    backgroundColor: Colors.borderLight,
  },
  bottomBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  bottomBtnDisabled: {
    opacity: 0.5,
  },
  bottomBtnCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  bottomBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  // Dictation mode
  dictationScrollView: {
    flex: 1,
  },
  dictationScrollContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  dictationBadgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dictationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dictationBadgeLocal: {
    backgroundColor: `${Colors.success}15`,
  },
  dictationBadgeCloud: {
    backgroundColor: `${Colors.warning}15`,
  },
  dictationBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dictationTextBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    minHeight: 180,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dictationTranscript: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  dictationInterim: {
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  dictationPlaceholder: {
    fontSize: 16,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  dictationErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: `${Colors.error}10`,
    borderRadius: 10,
  },
  dictationErrorText: {
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  dictationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  dictationMicBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  dictationMicBtnActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  dictationClearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.error}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dictationLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dictationLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  dictationLiveText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  // Text mode
  textContent: {
    flex: 1,
  },
  textScrollView: {
    flex: 1,
  },
  textArea: {
    flex: 1,
    minHeight: 200,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    padding: 16,
    textAlignVertical: 'top',
  },
});
