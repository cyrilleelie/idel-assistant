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
 * 3. Vocal: VoiceRecorder → encrypt → save DB → enqueue upload → back
 * 4. Text: TextComposer → save DB → enqueue sync → back
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuthStore } from '@/stores/authStore';
import { useAudit } from '@/hooks/useAudit';
import { useScreenProtection } from '@/security/screenProtection';
import { globalQueue } from '@/services/globalQueue';
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
  const user = useAuthStore((s) => s.user);
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

  // ── Vocal complete → save ───────────────────────────────────────────

  const handleVocalComplete = useCallback(
    async (result: VoiceRecordingResult) => {
      if (!patientId || isSaving) return;
      setIsSaving(true);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await database.write(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await database.get('transmissions').create((record: any) => {
            record._raw.server_id = '';
            record._raw.patient_id = patientId;
            record._raw.appointment_id = appointmentId || null;
            record._raw.author_user_id = user?.id ?? 'unknown';
            record._raw.author_name = user
              ? `${user.firstName} ${user.lastName}`
              : 'Utilisateur';
            record._raw.content_text = null;
            record._raw.content_structured = null;
            record._raw.audio_file_path = result.encryptedPath;
            record._raw.status = 'pending_transcription';
            record._raw.audio_uploaded = 0;
            record._raw.created_at = Date.now();
            record._raw.last_synced_at = 0;
          });
        });

        // Enqueue audio upload (fire-and-forget)
        globalQueue
          .enqueue('POST', '/api/v1/transmissions/upload-audio', {
            patientId,
            appointmentId: appointmentId || null,
            audioPath: result.encryptedPath,
            durationMs: result.durationMs,
          })
          .catch(() => {});

        // Audit log
        logAccess('create_transmission', 'transmission', patientId);

        Alert.alert('Enregistre', 'Votre transmission vocale a ete sauvegardee.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch {
        Alert.alert('Erreur', 'Impossible de sauvegarder la transmission.');
      } finally {
        setIsSaving(false);
      }
    },
    [patientId, appointmentId, database, user, logAccess, router, isSaving],
  );

  // ── Text submit → save ──────────────────────────────────────────────

  const handleTextSubmit = useCallback(
    async (text: string) => {
      if (!patientId || isSaving) return;
      setIsSaving(true);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await database.write(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await database.get('transmissions').create((record: any) => {
            record._raw.server_id = '';
            record._raw.patient_id = patientId;
            record._raw.appointment_id = appointmentId || null;
            record._raw.author_user_id = user?.id ?? 'unknown';
            record._raw.author_name = user
              ? `${user.firstName} ${user.lastName}`
              : 'Utilisateur';
            record._raw.content_text = text;
            record._raw.content_structured = null;
            record._raw.audio_file_path = null;
            record._raw.status = 'draft';
            record._raw.audio_uploaded = 0;
            record._raw.created_at = Date.now();
            record._raw.last_synced_at = 0;
          });
        });

        // Enqueue sync (fire-and-forget)
        globalQueue
          .enqueue('POST', '/api/v1/transmissions', {
            patientId,
            appointmentId: appointmentId || null,
            contentText: text,
          })
          .catch(() => {});

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
    [patientId, appointmentId, database, user, logAccess, router, isSaving],
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
