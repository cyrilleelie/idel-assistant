/**
 * PatientDetailScreen — Full patient detail screen.
 *
 * Shows:
 * - PatientHeader (avatar, name, age, badges, action buttons)
 * - PatientInfoSection (collapsible: address, phone, email, birthdate, BSI, notes)
 * - Recent documents (3 most recent + "Voir tout" link)
 * - Recent appointments (3 most recent)
 * - "Scanner une ordonnance" button
 * - PdfViewer (print patient summary)
 *
 * Security:
 * - Screen protection enabled (prevents screenshots)
 * - Audit log view_patient on mount
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAudit } from '@/hooks/useAudit';
import { useScreenProtection } from '@/security/screenProtection';
import { openNavigation, openPhoneDialer } from '@/services/navigationService';
import { buildPatientView, fetchPatientDocuments } from '@/types/patient';
import type { PatientView, DocumentView } from '@/types/patient';
import { buildAppointmentViews } from '@/types/appointment';
import type { AppointmentView } from '@/types/appointment';
import { fetchPatientTransmissions } from '@/types/transmission';
import type { TransmissionView } from '@/types/transmission';
import { formatTransmissionTime, formatTransmissionStatus } from '@/types/transmission';
import PatientHeader from '@/components/patient/PatientHeader';
import PatientInfoSection from '@/components/patient/PatientInfoSection';
import DocumentCard from '@/components/patient/DocumentCard';
import PdfViewer from '@/components/patient/PdfViewer';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { Colors } from '@/constants/colors';
import type Patient from '@/db/models/Patient';
import type Appointment from '@/db/models/Appointment';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const database = useDatabase();
  const gpsAppPreference = useSettingsStore((s) => s.gpsAppPreference);
  const { logAccess } = useAudit();

  // Screen protection — prevents screenshots of patient data
  useScreenProtection();

  const [patient, setPatient] = useState<PatientView | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentView[]>([]);
  const [recentAppts, setRecentAppts] = useState<AppointmentView[]>([]);
  const [recentTxs, setRecentTxs] = useState<TransmissionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load patient + recent data ──────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        // Load patient
        const pat = await database.get<Patient>('patients').find(id);
        if (cancelled) return;
        const patView = buildPatientView(pat);
        setPatient(patView);

        // Load recent documents (first 3)
        const docs = await fetchPatientDocuments(database, id);
        if (!cancelled) {
          setRecentDocs(docs.slice(0, 3));
        }

        // Load recent appointments (first 3)
        const appts = await database
          .get<Appointment>('appointments')
          .query(Q.where('patient_id', id))
          .fetch();
        if (!cancelled) {
          const views = await buildAppointmentViews(appts, database);
          // Sort by date DESC, startTime DESC
          views.sort((a, b) => {
            const dateCmp = b.date.localeCompare(a.date);
            if (dateCmp !== 0) return dateCmp;
            return b.startTime.localeCompare(a.startTime);
          });
          setRecentAppts(views.slice(0, 3));
        }

        // Load recent transmissions (first 3)
        const txs = await fetchPatientTransmissions(database, id);
        if (!cancelled) {
          setRecentTxs(txs.slice(0, 3));
        }
      } catch {
        // Record not found
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    // Audit log (fire-and-forget)
    logAccess('view_patient', 'patient', id);

    return () => {
      cancelled = true;
    };
  }, [id, database, logAccess]);

  // ── Callbacks ───────────────────────────────────────────────────────────

  const handleCall = useCallback(() => {
    if (!patient?.phone) return;
    openPhoneDialer(patient.phone);
  }, [patient]);

  const handleNavigate = useCallback(() => {
    if (!patient) return;
    openNavigation({
      lat: patient.lat,
      lon: patient.lon,
      address: patient.address,
      preference: gpsAppPreference,
    });
  }, [patient, gpsAppPreference]);

  const handleEmail = useCallback(() => {
    if (!patient?.email) return;
    Linking.openURL(`mailto:${patient.email}`).catch(() => {});
  }, [patient]);

  const handleViewAllDocs = useCallback(() => {
    if (!id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/patient/${id}/documents` as any);
  }, [id, router]);

  const handleScan = useCallback(() => {
    if (!id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/patient/${id}/scan` as any);
  }, [id, router]);

  const handleViewAllTransmissions = useCallback(() => {
    if (!id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/patient/${id}/transmissions` as any);
  }, [id, router]);

  const handleAddTransmission = useCallback(() => {
    if (!id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/transmission/new?patientId=${id}` as any);
  }, [id, router]);

  const handleDocPress = useCallback((_doc: DocumentView) => {
    // TODO (M4): Open document viewer
  }, []);

  // ── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingScreen message="Chargement du patient..." />;
  }

  if (!patient) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="person-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.notFoundText}>Patient introuvable</Text>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with avatar, name, badges, action buttons */}
      <PatientHeader
        patient={patient}
        onCall={handleCall}
        onNavigate={handleNavigate}
        onEmail={handleEmail}
      />

      {/* Collapsible info section */}
      <PatientInfoSection
        patient={patient}
        onAddressPress={handleNavigate}
        onPhonePress={handleCall}
        onEmailPress={handleEmail}
      />

      {/* Recent documents */}
      <SectionHeader
        icon="document-text-outline"
        title="Documents recents"
        actionLabel={recentDocs.length > 0 ? 'Voir tout' : undefined}
        onAction={handleViewAllDocs}
      />
      {recentDocs.length > 0 ? (
        <View style={styles.docsContainer}>
          {recentDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onPress={handleDocPress}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Aucun document</Text>
      )}

      {/* Recent appointments */}
      <SectionHeader
        icon="calendar-outline"
        title="Derniers rendez-vous"
      />
      {recentAppts.length > 0 ? (
        <View style={styles.apptsContainer}>
          {recentAppts.map((appt) => (
            <ApptRow key={appt.id} appointment={appt} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Aucun rendez-vous</Text>
      )}

      {/* Recent transmissions */}
      <SectionHeader
        icon="chatbubble-ellipses-outline"
        title="Transmissions recentes"
        actionLabel={recentTxs.length > 0 ? 'Voir tout' : undefined}
        onAction={handleViewAllTransmissions}
      />
      {recentTxs.length > 0 ? (
        <View style={styles.txContainer}>
          {recentTxs.map((tx) => (
            <TxRow key={tx.id} transmission={tx} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Aucune transmission</Text>
      )}

      {/* Action buttons */}
      <Pressable
        onPress={handleAddTransmission}
        style={({ pressed }) => [styles.scanBtn, pressed && styles.scanBtnPressed]}
        accessibilityRole="button"
      >
        <Ionicons name="mic-outline" size={20} color={Colors.primary} />
        <Text style={styles.scanBtnText}>Ajouter une transmission</Text>
      </Pressable>

      {/* Scan button */}
      <Pressable
        onPress={handleScan}
        style={({ pressed }) => [styles.scanBtn, pressed && styles.scanBtnPressed]}
        accessibilityRole="button"
      >
        <Ionicons name="scan-outline" size={20} color={Colors.primary} />
        <Text style={styles.scanBtnText}>Scanner une ordonnance</Text>
      </Pressable>

      {/* PDF export */}
      <PdfViewer patient={patient} />

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color={Colors.textSecondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel != null && onAction != null && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ApptRow({ appointment }: { appointment: AppointmentView }) {
  const statusColor =
    appointment.status === 'completed'
      ? Colors.success
      : appointment.status === 'canceled'
        ? Colors.textTertiary
        : Colors.text;

  return (
    <View style={styles.apptRow}>
      <View style={[styles.apptDot, { backgroundColor: statusColor }]} />
      <View style={styles.apptInfo}>
        <Text style={styles.apptDate}>
          {appointment.date} — {appointment.startTime}
        </Text>
        <Text style={styles.apptType}>{appointment.careTypeLabel}</Text>
      </View>
      <Text style={[styles.apptStatus, { color: statusColor }]}>
        {appointment.status === 'completed'
          ? 'Realise'
          : appointment.status === 'canceled'
            ? 'Annule'
            : 'Prevu'}
      </Text>
    </View>
  );
}

function TxRow({ transmission }: { transmission: TransmissionView }) {
  const statusColor =
    transmission.status === 'validated'
      ? Colors.success
      : transmission.status === 'transcribed'
        ? Colors.primary
        : transmission.status === 'pending_transcription'
          ? Colors.warning
          : Colors.textTertiary;

  const isVocal = transmission.audioFilePath != null;

  return (
    <View style={styles.apptRow}>
      <Ionicons
        name={isVocal ? 'mic-outline' : 'create-outline'}
        size={14}
        color={statusColor}
        style={{ marginRight: 8 }}
      />
      <View style={styles.apptInfo}>
        <Text style={styles.apptDate}>
          {formatTransmissionTime(transmission.createdAt)} — {transmission.authorName}
        </Text>
        <Text style={styles.apptType} numberOfLines={1}>
          {transmission.contentStructured?.synthese ??
            transmission.contentText ??
            'En attente de transcription'}
        </Text>
      </View>
      <Text style={[styles.apptStatus, { color: statusColor }]}>
        {formatTransmissionStatus(transmission.status)}
      </Text>
    </View>
  );
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

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Documents
  docsContainer: {
    marginHorizontal: -16,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 8,
  },

  // Transmissions
  txContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },

  // Appointments
  apptsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  apptDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  apptInfo: {
    flex: 1,
  },
  apptDate: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  apptType: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  apptStatus: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Scan button
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryUltraLight,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  scanBtnPressed: {
    opacity: 0.8,
  },
  scanBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },

  bottomSpacer: {
    height: 40,
  },
});
