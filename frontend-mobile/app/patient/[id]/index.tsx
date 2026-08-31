/**
 * PatientDetailScreen — Redesigned full patient detail screen.
 *
 * Shows:
 * - Custom header: back arrow + "Fiche Patient" + menu
 * - Patient profile: avatar, name, ACTIF badge, birth date, age, ID
 * - Quick action cards (phone, next RDV, address)
 * - Tab navigation: Informations | Dossier | Ordonnances | Transmissions
 * - Tab content depending on active tab
 * - FAB button: "Scanner"
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
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAudit } from '@/hooks/useAudit';
import { useScreenProtection } from '@/security/screenProtection';
import { openNavigation, openPhoneDialer } from '@/services/navigationService';
import { buildPatientView, fetchPatientDocuments, formatPatientAge } from '@/types/patient';
import type { PatientView, DocumentView } from '@/types/patient';
import { buildAppointmentViews } from '@/types/appointment';
import type { AppointmentView } from '@/types/appointment';
import { fetchPatientTransmissions } from '@/types/transmission';
import type { TransmissionView } from '@/types/transmission';
import { formatTransmissionTime, formatTransmissionStatus } from '@/types/transmission';
import { formatDateFrench } from '@/utils/dateHelpers';
import PatientInfoSection from '@/components/patient/PatientInfoSection';
import DocumentCard from '@/components/patient/DocumentCard';
import PdfViewer from '@/components/patient/PdfViewer';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { Colors } from '@/constants/colors';
import type Patient from '@/db/models/Patient';
import type Appointment from '@/db/models/Appointment';

type TabKey = 'info' | 'dossier' | 'ordonnances' | 'transmissions';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'info', label: 'Informations' },
  { key: 'dossier', label: 'Dossier' },
  { key: 'ordonnances', label: 'Ordonnances' },
  { key: 'transmissions', label: 'Transmissions' },
];

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const database = useDatabase();
  const gpsAppPreference = useSettingsStore((s) => s.gpsAppPreference);
  const { logAccess } = useAudit();

  // Screen protection -- prevents screenshots of patient data
  useScreenProtection();

  const [patient, setPatient] = useState<PatientView | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentView[]>([]);
  const [recentAppts, setRecentAppts] = useState<AppointmentView[]>([]);
  const [recentTxs, setRecentTxs] = useState<TransmissionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  // -- Load patient + recent data -------------------------------------------

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

  // -- Callbacks ------------------------------------------------------------

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
    ExpoLinking.openURL(`mailto:${patient.email}`).catch(() => {});
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

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // -- Loading --------------------------------------------------------------

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

  const age = formatPatientAge(patient.birthDate);
  const isActive = patient.status === 'active';
  const initials = `${patient.firstName.charAt(0).toUpperCase()}${patient.lastName.charAt(0).toUpperCase()}`;

  // Find next upcoming appointment
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nextAppt = recentAppts.find(
    (a) => a.date >= todayStr && a.status !== 'canceled',
  );

  // -- Render ---------------------------------------------------------------

  return (
    <View style={styles.rootContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Custom header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Fiche Patient</Text>
          <Pressable style={styles.headerBtn} hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.text} />
          </Pressable>
        </View>

        {/* Patient profile section */}
        <View style={styles.profileSection}>
          {/* Avatar */}
          <View style={styles.avatarOuter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          {/* Name + status badge */}
          <View style={styles.nameRow}>
            <Text style={styles.patientName}>{patient.displayName}</Text>
            <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                {isActive ? 'ACTIF' : 'INACTIF'}
              </Text>
            </View>
          </View>

          {/* Birth date + age */}
          {patient.birthDate != null && (
            <Text style={styles.birthDate}>
              {formatDateFrench(patient.birthDate)}{age ? ` - ${age}` : ''}
            </Text>
          )}

          {/* ID */}
          {patient.serverId != null && patient.serverId.length > 0 && (
            <Text style={styles.idNumber}>
              ID: {patient.serverId.substring(0, 8).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Quick action cards */}
        <View style={styles.quickActions}>
          {/* Phone card */}
          <Pressable
            style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
            onPress={handleCall}
            disabled={!patient.phone}
            accessibilityRole="button"
            accessibilityLabel="Appeler le patient"
          >
            <Ionicons name="call-outline" size={20} color={Colors.primary} />
            <Text style={styles.quickCardLabel} numberOfLines={1}>
              {patient.phone ?? 'Non renseigne'}
            </Text>
          </Pressable>

          {/* Next RDV card */}
          <View style={styles.quickCard}>
            <Ionicons name="calendar-outline" size={20} color="#D97706" />
            <Text style={[styles.quickCardLabel, { color: '#D97706' }]} numberOfLines={1}>
              {nextAppt
                ? `${nextAppt.date.split('-').reverse().join('/')} ${nextAppt.startTime}`
                : 'Aucun RDV'}
            </Text>
          </View>

          {/* Address card */}
          <Pressable
            style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
            onPress={handleNavigate}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir la navigation GPS"
          >
            <Ionicons name="location-outline" size={20} color={Colors.primary} />
            <Text style={styles.quickCardLabel} numberOfLines={2}>
              {patient.address || 'Non renseigne'}
            </Text>
          </Pressable>
        </View>

        {/* Tab navigation */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActiveTab = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, isActiveTab && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActiveTab }}
              >
                <Text style={[styles.tabText, isActiveTab && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tab content */}
        {activeTab === 'info' && (
          <InformationsTab
            patient={patient}
            onAddressPress={handleNavigate}
            onPhonePress={handleCall}
            onEmailPress={handleEmail}
          />
        )}

        {activeTab === 'dossier' && (
          <DossierTab
            recentDocs={recentDocs}
            recentAppts={recentAppts}
            onDocPress={handleDocPress}
            onViewAllDocs={handleViewAllDocs}
          />
        )}

        {activeTab === 'ordonnances' && (
          <OrdonnancesTab
            recentDocs={recentDocs}
            onDocPress={handleDocPress}
            onViewAllDocs={handleViewAllDocs}
          />
        )}

        {activeTab === 'transmissions' && (
          <TransmissionsTab
            recentTxs={recentTxs}
            onViewAll={handleViewAllTransmissions}
            onAdd={handleAddTransmission}
          />
        )}

        {/* PDF export (kept from original) */}
        <PdfViewer patient={patient} />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FAB - Scanner button */}
      <Pressable
        onPress={handleScan}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Scanner une ordonnance"
      >
        <Ionicons name="camera-outline" size={22} color={Colors.white} />
        <Text style={styles.fabText}>Scanner</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab: Informations
// ---------------------------------------------------------------------------

function InformationsTab({
  patient,
  onAddressPress,
  onPhonePress,
  onEmailPress,
}: {
  patient: PatientView;
  onAddressPress: () => void;
  onPhonePress: () => void;
  onEmailPress: () => void;
}) {
  // Parse allergies from notes (look for comma-separated items after "Allergies:" or similar)
  // For now, use placeholder data since PatientView doesn't have a dedicated allergies field
  const allergies = extractAllergies(patient.notes);

  return (
    <View style={styles.tabContent}>
      {/* Allergies & Alertes */}
      {allergies.length > 0 && (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>ALLERGIES & ALERTES</Text>
          <View style={styles.allergyRow}>
            {allergies.map((allergy, index) => (
              <View key={index} style={styles.allergyBadge}>
                <Text style={styles.allergyBadgeText}>{allergy}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Existing PatientInfoSection (address, phone, email, etc.) */}
      <PatientInfoSection
        patient={patient}
        onAddressPress={onAddressPress}
        onPhonePress={onPhonePress}
        onEmailPress={onEmailPress}
      />

      {/* ALD / BSI badges */}
      {(patient.isAld || patient.hasActiveBsi) && (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>PATHOLOGIES & ANTECEDENTS</Text>
          <View style={styles.bulletList}>
            {patient.isAld && (
              <View style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>Patient en ALD (Affection Longue Duree)</Text>
              </View>
            )}
            {patient.hasActiveBsi && patient.bsiLevel != null && (
              <View style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>BSI actif: {patient.bsiLevel}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Notes as pathologies/antecedents */}
      {patient.notes != null && patient.notes.length > 0 && (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>NOTES</Text>
          <Text style={styles.notesText}>{patient.notes}</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab: Dossier
// ---------------------------------------------------------------------------

function DossierTab({
  recentDocs,
  recentAppts,
  onDocPress,
  onViewAllDocs,
}: {
  recentDocs: DocumentView[];
  recentAppts: AppointmentView[];
  onDocPress: (doc: DocumentView) => void;
  onViewAllDocs: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Documents */}
      <SectionHeader
        icon="document-text-outline"
        title="Documents recents"
        actionLabel={recentDocs.length > 0 ? 'Voir tout' : undefined}
        onAction={onViewAllDocs}
      />
      {recentDocs.length > 0 ? (
        <View style={styles.docsContainer}>
          {recentDocs.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onPress={onDocPress} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Aucun document</Text>
      )}

      {/* Recent appointments */}
      <SectionHeader icon="calendar-outline" title="Derniers rendez-vous" />
      {recentAppts.length > 0 ? (
        <View style={styles.apptsContainer}>
          {recentAppts.map((appt) => (
            <ApptRow key={appt.id} appointment={appt} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Aucun rendez-vous</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab: Ordonnances
// ---------------------------------------------------------------------------

function OrdonnancesTab({
  recentDocs,
  onDocPress,
  onViewAllDocs,
}: {
  recentDocs: DocumentView[];
  onDocPress: (doc: DocumentView) => void;
  onViewAllDocs: () => void;
}) {
  const prescriptions = recentDocs.filter((d) => d.fileType === 'prescription');

  return (
    <View style={styles.tabContent}>
      <SectionHeader
        icon="document-text-outline"
        title="Ordonnances"
        actionLabel={prescriptions.length > 0 ? 'Voir tout' : undefined}
        onAction={onViewAllDocs}
      />
      {prescriptions.length > 0 ? (
        <View style={styles.docsContainer}>
          {prescriptions.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onPress={onDocPress} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>Aucune ordonnance</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab: Transmissions
// ---------------------------------------------------------------------------

function TransmissionsTab({
  recentTxs,
  onViewAll,
  onAdd,
}: {
  recentTxs: TransmissionView[];
  onViewAll: () => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      <SectionHeader
        icon="chatbubble-ellipses-outline"
        title="Transmissions recentes"
        actionLabel={recentTxs.length > 0 ? 'Voir tout' : undefined}
        onAction={onViewAll}
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

      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [styles.addTxBtn, pressed && styles.addTxBtnPressed]}
        accessibilityRole="button"
      >
        <Ionicons name="mic-outline" size={20} color={Colors.primary} />
        <Text style={styles.addTxBtnText}>Ajouter une transmission</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
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
          {appointment.date} -- {appointment.startTime}
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
          {formatTransmissionTime(transmission.createdAt)} -- {transmission.authorName}
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract allergies from notes text.
 * Looks for patterns like "Allergies: X, Y, Z" or "Allergie: X"
 */
function extractAllergies(notes: string | null): string[] {
  if (!notes) return [];
  const match = notes.match(/allerg(?:ies?)\s*[:=]\s*([^\n]+)/i);
  if (!match) return [];
  return match[1]
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
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

  // Custom header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },

  // Profile section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatarOuter: {
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: '#16A34A',
  },
  statusTextInactive: {
    color: '#94A3B8',
  },
  birthDate: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  idNumber: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Quick action cards
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  quickCardPressed: {
    opacity: 0.8,
    backgroundColor: Colors.borderLight,
  },
  quickCardLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Tab content
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Info card (allergies, pathologies)
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  allergyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergyBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  allergyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textTertiary,
    marginTop: 6,
  },
  bulletText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  notesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
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

  // Add transmission button
  addTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryUltraLight,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  addTxBtnPressed: {
    opacity: 0.8,
  },
  addTxBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.9,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },

  bottomSpacer: {
    height: 40,
  },
});
