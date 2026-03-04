/**
 * NewTransmissionScreen — Voice or text transmission creation.
 *
 * Query params:
 * - patientId: WatermelonDB local ID of the patient (required)
 * - appointmentId: WatermelonDB local ID of the linked appointment (optional)
 *
 * Flow:
 * 1. Resolves patient (+ optional appointment) from WatermelonDB
 * 2. Toggle between vocal (default) and text mode
 * 3. Vocal: VoiceRecorder → upload to backend → sync → back
 * 4. Text: TextComposer → create on backend → sync → back
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAudit } from '@/hooks/useAudit';
import { useScreenProtection } from '@/security/screenProtection';
import { api } from '@/services/api';
import * as keyManager from '@/security/keyManager';
import { API_BASE_URL } from '@/constants/config';
import { buildPatientView } from '@/types/patient';
import type { PatientView } from '@/types/patient';
import VoiceRecorder from '@/components/transmission/VoiceRecorder';
import type { VoiceRecordingResult } from '@/components/transmission/VoiceRecorder';
import TextComposer from '@/components/transmission/TextComposer';
import { Colors } from '@/constants/colors';
import type Patient from '@/db/models/Patient';

type InputMode = 'vocal' | 'text';

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

  // ── Load patient ────────────────────────────────────────────────────

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

  // ── Vocal complete → upload to backend → sync ──────────────────────

  const handleVocalComplete = useCallback(
    async (result: VoiceRecordingResult) => {
      if (!patientId || isSaving) return;
      setIsSaving(true);

      try {
        // Ensure URI has file:// scheme for native upload
        let fileUri = result.encryptedPath;
        if (!fileUri.startsWith('file://')) {
          fileUri = `file://${fileUri}`;
        }

        // Get auth token for the upload request
        const token = await keyManager.getToken('access');

        const uploadUrl = `${API_BASE_URL}/transmissions/upload-audio`;
        const params: Record<string, string> = {
          patient_id: patientId,
          duration_ms: String(result.durationMs),
        };
        if (appointmentId) {
          params.appointment_id = appointmentId;
        }

        console.log('[Transmission] Uploading audio:', { fileUri, uploadUrl, params });

        // Step 1: Upload audio using native uploadAsync from expo-file-system
        // This handles multipart encoding natively, avoiding React Native FormData issues
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

        // Step 2: Sync to pull the server-created record into WatermelonDB
        const { triggerSync } = await import('@/services/syncService');
        await triggerSync(database).catch(() => {});

        // Audit log
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
    },
    [patientId, appointmentId, database, logAccess, router, isSaving],
  );

  // ── Text submit → create on backend → sync ─────────────────────────

  const handleTextSubmit = useCallback(
    async (text: string) => {
      if (!patientId || isSaving) return;
      setIsSaving(true);

      try {
        // Step 1: Create on server
        await api.post('/transmissions', {
          patient_id: patientId,
          appointment_id: appointmentId || null,
          type: 'written',
          transcription: text,
        });

        // Step 2: Sync to pull the server-created record into WatermelonDB
        const { triggerSync } = await import('@/services/syncService');
        await triggerSync(database).catch(() => {});

        // Audit log
        logAccess('create_transmission', 'transmission', patientId);

        Alert.alert('Enregistre', 'Votre transmission a ete sauvegardee.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch {
        Alert.alert('Erreur', 'Impossible de sauvegarder la transmission.');
      } finally {
        setIsSaving(false);
      }
    },
    [patientId, appointmentId, database, logAccess, router, isSaving],
  );

  // ── Cancel → go back ───────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Transmission',
          headerStyle: styles.headerBar,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: Colors.text,
        }}
      />

      <View style={styles.container}>
        {/* Patient info bar */}
        {patient && (
          <View style={styles.patientBar}>
            <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.patientName}>{patient.displayName}</Text>
          </View>
        )}

        {/* Mode toggle */}
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

        {/* Content area */}
        <View style={styles.content}>
          {mode === 'vocal' ? (
            <VoiceRecorder
              onRecordingComplete={handleVocalComplete}
              onCancel={handleCancel}
            />
          ) : (
            <TextComposer onSubmit={handleTextSubmit} onCancel={handleCancel} />
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: Colors.surface,
  },
  headerTitle: {
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
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  modeBtnTextActive: {
    color: Colors.primary,
  },
  // Content
  content: {
    flex: 1,
  },
});
