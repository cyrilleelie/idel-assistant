/**
 * TransmissionDetailScreen — Full view of a single transmission.
 *
 * Shows:
 * - Patient name, date/time, author, status badge
 * - Structured content (Synthese IA) if available
 * - Content text (full transcription)
 * - Audio playback bar if audio file exists
 * - Actions: Corriger (if transcribed + current user), Valider
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuthStore } from '@/stores/authStore';
import { useAudit } from '@/hooks/useAudit';
import { useScreenProtection } from '@/security/screenProtection';
import { globalQueue } from '@/services/globalQueue';
import {
  buildTransmissionView,
  formatTransmissionStatus,
  formatTransmissionTime,
  type TransmissionView,
} from '@/types/transmission';
import { buildPatientView, type PatientView } from '@/types/patient';
import AudioPlaybackBar from '@/components/transmission/AudioPlaybackBar';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { Colors } from '@/constants/colors';
import type Transmission from '@/db/models/Transmission';
import type Patient from '@/db/models/Patient';

export default function TransmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const database = useDatabase();
  const userId = useAuthStore((s) => s.user?.id);
  const { logAccess } = useAudit();

  useScreenProtection();

  const [transmission, setTransmission] = useState<TransmissionView | null>(null);
  const [patient, setPatient] = useState<PatientView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showValidateModal, setShowValidateModal] = useState(false);

  // ── Load transmission + patient ───────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const tx = await database.get<Transmission>('transmissions').find(id!);
        if (cancelled) return;
        const txView = buildTransmissionView(tx);
        setTransmission(txView);

        // Load patient
        if (txView.patientId) {
          try {
            const pat = await database.get<Patient>('patients').find(txView.patientId);
            if (!cancelled) setPatient(buildPatientView(pat));
          } catch {
            // Patient not found
          }
        }
      } catch {
        // Transmission not found
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    logAccess('view_transmission', 'transmission', id);

    return () => {
      cancelled = true;
    };
  }, [id, database, logAccess]);

  // ── Validate ──────────────────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    if (!transmission || !id) return;
    setShowValidateModal(false);

    try {
      const tx = await database.get<Transmission>('transmissions').find(id);
      await database.write(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.update((record: any) => {
          record._raw.status = 'validated';
        });
      });

      // Enqueue sync
      globalQueue
        .enqueue('PATCH', `/api/v1/transmissions/${transmission.serverId}`, {
          status: 'validated',
        })
        .catch(() => {});

      // Update local state
      setTransmission((prev) => (prev ? { ...prev, status: 'validated' } : prev));

      Alert.alert('Valide', 'La transmission a ete validee.');
    } catch {
      Alert.alert('Erreur', 'Impossible de valider la transmission.');
    }
  }, [id, transmission, database]);

  // ── Edit ──────────────────────────────────────────────────────────────

  const handleEdit = useCallback(() => {
    if (!id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/transmission/${id}/edit` as any);
  }, [id, router]);

  // ── Play audio ────────────────────────────────────────────────────────

  const handlePlayAudio = useCallback(() => {
    if (!id) return;
    logAccess('play_audio', 'transmission', id);
  }, [id, logAccess]);

  // ── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingScreen message="Chargement..." />;
  }

  if (!transmission) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.notFoundText}>Transmission introuvable</Text>
      </View>
    );
  }

  const isCurrentUser = transmission.authorUserId === userId;
  const canEdit = transmission.status === 'transcribed' && isCurrentUser;
  const canValidate = transmission.status === 'transcribed' && isCurrentUser;
  const { contentStructured, contentText, audioFilePath } = transmission;

  // Format date
  const dateObj = new Date(transmission.createdAt);
  const dateStr = dateObj.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Patient + meta */}
      {patient && (
        <Text style={styles.patientName}>{patient.displayName}</Text>
      )}
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.metaText}>
          {dateStr} a {formatTransmissionTime(transmission.createdAt)}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.metaText}>
          {transmission.authorName}
          {isCurrentUser && ' (vous)'}
        </Text>
        <View style={[styles.statusBadge, statusBadgeColor(transmission.status)]}>
          <Text style={styles.statusText}>
            {formatTransmissionStatus(transmission.status)}
          </Text>
        </View>
      </View>

      {/* Audio playback */}
      {audioFilePath && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Enregistrement audio</Text>
          <AudioPlaybackBar
            encryptedPath={audioFilePath}
            durationMs={0}
            onPlaybackEnd={handlePlayAudio}
          />
        </View>
      )}

      {/* Structured content (AI synthesis) */}
      {contentStructured && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Synthese IA</Text>
          <View style={styles.structuredCard}>
            <StructuredField label="Synthese" value={contentStructured.synthese} />
            <StructuredField label="Soins realises" value={contentStructured.soins} />
            <StructuredField label="Constantes" value={contentStructured.constantes} />
            <StructuredField label="Observations" value={contentStructured.observations} />
            <StructuredField label="Actions a suivre" value={contentStructured.actions} />
          </View>
        </View>
      )}

      {/* Text content */}
      {contentText && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Transcription</Text>
          <View style={styles.textCard}>
            <Text style={styles.textContent}>{contentText}</Text>
          </View>
        </View>
      )}

      {/* Pending transcription message */}
      {transmission.status === 'pending_transcription' && (
        <View style={styles.section}>
          <View style={styles.pendingCard}>
            <Ionicons name="hourglass-outline" size={24} color={Colors.warning} />
            <Text style={styles.pendingText}>
              Transcription en cours de traitement. Le contenu apparaitra ici une fois le traitement termine.
            </Text>
          </View>
        </View>
      )}

      {/* Actions */}
      {(canEdit || canValidate) && (
        <View style={styles.actionsRow}>
          {canEdit && (
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.editBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Ionicons name="pencil-outline" size={18} color={Colors.text} />
              <Text style={styles.editBtnText}>Corriger</Text>
            </Pressable>
          )}
          {canValidate && (
            <Pressable
              onPress={() => setShowValidateModal(true)}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.validateBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
              <Text style={styles.validateBtnText}>Valider</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.bottomSpacer} />

      <ConfirmationModal
        visible={showValidateModal}
        title="Valider la transmission"
        message="Une fois validee, la transmission ne pourra plus etre modifiee. Confirmer ?"
        confirmLabel="Valider"
        cancelLabel="Annuler"
        onConfirm={handleValidate}
        onCancel={() => setShowValidateModal(false)}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StructuredField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.structuredField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function statusBadgeColor(status: string) {
  switch (status) {
    case 'validated':
      return { backgroundColor: Colors.successLight };
    case 'transcribed':
      return { backgroundColor: Colors.primaryUltraLight };
    case 'pending_transcription':
      return { backgroundColor: Colors.warningLight };
    case 'draft':
      return { backgroundColor: Colors.borderLight };
    default:
      return { backgroundColor: Colors.borderLight };
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: Colors.background,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  // Patient + meta
  patientName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  // Sections
  section: {
    marginTop: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Structured content
  structuredCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  structuredField: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  fieldValue: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  // Text content
  textCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  textContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
  // Pending
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 14,
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
    lineHeight: 19,
  },
  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
  editBtn: {
    backgroundColor: Colors.borderLight,
  },
  validateBtn: {
    backgroundColor: Colors.success,
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  validateBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
