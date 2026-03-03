/**
 * AppointmentDetailScreen — Full detail view for a single appointment.
 *
 * Fetches the Appointment and its associated Patient from WatermelonDB
 * using the local ID from the route parameter. Logs an audit event on mount
 * for HDS/RGPD compliance.
 *
 * Actions available:
 * - Navigate to patient address (GPS)
 * - View full patient record
 * - Add a transmission note
 * - Mark as completed (scheduled/in_progress only, guarded by ConfirmationModal)
 * - Undo completion (completed only, guarded by danger ConfirmationModal)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTourneeStore } from '@/stores/tourneeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useAudit } from '@/hooks/useAudit';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { openNavigation } from '@/services/navigationService';
import { getInvoiceForAppointment } from '@/services/invoiceService';
import type { InvoiceDetail } from '@/services/invoiceService';
import { api } from '@/services/api';
import LoadingScreen from '@/components/ui/LoadingScreen';
import Badge from '@/components/ui/Badge';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { Colors } from '@/constants/colors';
import {
  formatDateFrench,
  formatTimeRange,
  formatLocationType,
  formatAppointmentStatus,
} from '@/utils/dateUtils';
import { formatAmountShort } from '@/utils/formatters';
import type Appointment from '@/db/models/Appointment';
import type Patient from '@/db/models/Patient';
import type Invoice from '@/db/models/Invoice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

function statusToBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success';
    case 'canceled':
    case 'cancelled':
      return 'danger';
    case 'scheduled':
    case 'in_progress':
    default:
      return 'info';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  children: React.ReactNode;
  onPress?: () => void;
  hideBorder?: boolean;
}

function InfoRow({ icon, children, onPress, hideBorder = false }: InfoRowProps) {
  const rowStyle = [
    styles.infoRow,
    hideBorder && styles.infoRowNoBorder,
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={rowStyle} activeOpacity={0.7}>
        <Ionicons name={icon} size={18} color={Colors.textSecondary} style={styles.infoIcon} />
        <View style={styles.infoContent}>{children}</View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
    );
  }
  return (
    <View style={rowStyle}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} style={styles.infoIcon} />
      <View style={styles.infoContent}>{children}</View>
    </View>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

interface ActionButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'success' | 'danger';
}

function ActionButton({ icon, label, onPress, variant = 'default' }: ActionButtonProps) {
  const containerStyle = [
    styles.actionButton,
    variant === 'primary' && styles.actionButtonPrimary,
    variant === 'success' && styles.actionButtonSuccess,
    variant === 'danger' && styles.actionButtonDanger,
  ];
  const textStyle = [
    styles.actionButtonText,
    (variant === 'primary' || variant === 'success') && styles.actionButtonTextLight,
    variant === 'danger' && styles.actionButtonTextDanger,
  ];
  const iconColor =
    variant === 'primary' || variant === 'success'
      ? Colors.white
      : variant === 'danger'
      ? Colors.danger
      : Colors.text;

  return (
    <TouchableOpacity onPress={onPress} style={containerStyle} activeOpacity={0.75}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const database = useDatabase();
  const gpsAppPreference = useSettingsStore((s) => s.gpsAppPreference);
  const isMarkingComplete = useTourneeStore((s) => s.isMarkingComplete);
  const markAsCompleted = useTourneeStore((s) => s.markAsCompleted);
  const undoCompletion = useTourneeStore((s) => s.undoCompletion);
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const { logAccess } = useAudit();
  const { isOnline } = useOnlineStatus();

  // ── Local state ────────────────────────────────────────────────────────────

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [invoiceSummary, setInvoiceSummary] = useState<{
    id: string;
    number: string;
    total: number;
  } | null>(null);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);

  // ── Load appointment + patient ────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const appt = await database.get<Appointment>('appointments').find(id);
        const pat = await database.get<Patient>('patients').find(appt.patientId);

        if (!cancelled) {
          setAppointment(appt);
          setPatient(pat);
          // Audit log for HDS/RGPD compliance
          logAccess('view_appointment', 'appointment', appt.serverId || appt.id);

          // Look up associated invoice if appointment is completed
          if (appt.status === 'completed') {
            try {
              const inv = await database
                .get<Invoice>('invoices')
                .query(Q.where('appointment_id', appt.id))
                .fetch();
              if (inv.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const raw = (inv[0] as any)._raw;
                setInvoiceSummary({
                  id: inv[0].id,
                  number: raw.invoice_number,
                  total: raw.total_amount,
                });
              }
            } catch {
              // Invoice lookup is non-critical
            }
          }
        }
      } catch {
        // Record not found — show not-found state
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, database, logAccess]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleNavigate = useCallback(() => {
    if (!patient) return;
    openNavigation({
      lat: patient.lat,
      lon: patient.lon,
      address: patient.address,
      preference: gpsAppPreference,
    });
  }, [patient, gpsAppPreference]);

  const handleViewPatient = useCallback(() => {
    if (!appointment) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/patient/${appointment.patientId}` as any);
  }, [appointment, router]);

  const handleAddTransmission = useCallback(() => {
    if (!appointment) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/transmission/new?patientId=${appointment.patientId}&appointmentId=${appointment.id}` as any);
  }, [appointment, router]);

  const handleViewInvoice = useCallback(async () => {
    if (!appointment) return;

    if (invoiceSummary) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/invoice/${invoiceSummary.id}` as any);
      return;
    }

    // Try to fetch from server
    const apiClient = isOnline ? api : null;
    const inv = await getInvoiceForAppointment(database, apiClient, appointment.id);
    if (inv) {
      setInvoiceSummary({ id: inv.id, number: inv.invoiceNumber, total: inv.totalAmount });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/invoice/${inv.id}` as any);
    }
    // If not found, the button already shows "en cours de generation"
  }, [appointment, invoiceSummary, database, isOnline, router]);

  const handleConfirmComplete = useCallback(async () => {
    if (!appointment) return;
    setShowCompleteModal(false);
    await markAsCompleted(appointment.id, appointment.serverId, database, userId);
    // Reload to reflect updated status
    try {
      const updated = await database.get<Appointment>('appointments').find(appointment.id);
      setAppointment(updated);
    } catch {
      // Record may no longer exist
    }
  }, [appointment, markAsCompleted, database, userId]);

  const handleConfirmUndo = useCallback(async () => {
    if (!appointment) return;
    setShowUndoModal(false);
    await undoCompletion(appointment.id, appointment.serverId, database);
    try {
      const updated = await database.get<Appointment>('appointments').find(appointment.id);
      setAppointment(updated);
    } catch {
      // Silently ignore
    }
  }, [appointment, undoCompletion, database]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingScreen message="Chargement du rendez-vous..." />;
  }

  // ── Not found state ───────────────────────────────────────────────────────

  if (!appointment || !patient) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Rendez-vous',
            headerStyle: styles.headerBar,
            headerTitleStyle: styles.headerTitle,
            headerTintColor: Colors.text,
          }}
        />
        <View style={styles.notFoundContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.notFoundText}>Rendez-vous introuvable</Text>
        </View>
      </>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const statusLabel = formatAppointmentStatus(appointment.status);
  const badgeVariant = statusToBadgeVariant(appointment.status);
  const isScheduled =
    appointment.status === 'scheduled' || appointment.status === 'in_progress';
  const isCompleted = appointment.status === 'completed';
  const isBusyForThis = isMarkingComplete === appointment.id;

  const patientDisplayName = `${patient.lastName.toUpperCase()} ${patient.firstName}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Rendez-vous',
          headerStyle: styles.headerBar,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: Colors.text,
          headerRight: () => (
            <View style={styles.headerBadge}>
              <Badge label={statusLabel} variant={badgeVariant} />
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Date + time + location header card */}
        <View style={styles.headerCard}>
          <InfoRow icon="calendar-outline">
            <Text style={styles.dateText}>
              {formatDateFrench(appointment.date)}
              {'  '}
              <Text style={styles.timeText}>
                {formatTimeRange(appointment.startTime, appointment.endTime)}
              </Text>
            </Text>
          </InfoRow>

          <InfoRow icon="location-outline" onPress={handleNavigate}>
            <Text style={styles.addressText}>{patient.address}</Text>
          </InfoRow>

          <InfoRow icon="business-outline" hideBorder>
            <Text style={styles.locationTypeText}>
              {formatLocationType(appointment.locationType)}
            </Text>
          </InfoRow>
        </View>

        {/* Care type section */}
        <Section title="SOINS PREVUS">
          <View style={styles.careRow}>
            <Text style={styles.careCode}>{appointment.careTypeCode}</Text>
            <Text style={styles.careDash}> — </Text>
            <Text style={styles.careLabel} numberOfLines={3}>
              {appointment.careTypeLabel}
            </Text>
          </View>
        </Section>

        {/* Notes section — only if non-empty */}
        {appointment.notes != null && appointment.notes.trim().length > 0 && (
          <Section title="NOTES">
            <Text style={styles.notesText}>{appointment.notes}</Text>
          </Section>
        )}

        {/* Actions divider */}
        <View style={styles.divider} />
        <Text style={styles.actionsLabel}>ACTIONS</Text>

        {/* Action buttons */}
        <View style={styles.actionsContainer}>
          <ActionButton
            icon="compass-outline"
            label="Naviguer vers ce patient"
            onPress={handleNavigate}
            variant="default"
          />

          <ActionButton
            icon="person-outline"
            label="Voir fiche patient"
            onPress={handleViewPatient}
            variant="default"
          />

          <ActionButton
            icon="mic-outline"
            label="Ajouter une transmission"
            onPress={handleAddTransmission}
            variant="default"
          />

          {isCompleted && (
            <ActionButton
              icon="receipt-outline"
              label={
                invoiceSummary
                  ? `Facture ${invoiceSummary.number} — ${formatAmountShort(invoiceSummary.total)}`
                  : 'Facture en cours de generation...'
              }
              onPress={handleViewInvoice}
              variant={invoiceSummary ? 'primary' : 'default'}
            />
          )}

          {isScheduled && (
            <ActionButton
              icon="checkmark-circle-outline"
              label={isBusyForThis ? 'Mise a jour...' : 'Marquer comme realise'}
              onPress={() => setShowCompleteModal(true)}
              variant="success"
            />
          )}

          {isCompleted && (
            <ActionButton
              icon="arrow-undo-outline"
              label={isBusyForThis ? 'Annulation...' : 'Annuler la realisation'}
              onPress={() => setShowUndoModal(true)}
              variant="danger"
            />
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Mark complete confirmation */}
      <ConfirmationModal
        visible={showCompleteModal}
        title="Marquer comme realise"
        message={`Confirmer la realisation du rendez-vous avec ${patientDisplayName} ?`}
        confirmLabel="Marquer realise"
        cancelLabel="Annuler"
        onConfirm={handleConfirmComplete}
        onCancel={() => setShowCompleteModal(false)}
      />

      {/* Undo completion confirmation */}
      <ConfirmationModal
        visible={showUndoModal}
        title="Annuler la realisation"
        message={`Annuler le statut realise pour le rendez-vous avec ${patientDisplayName} ?`}
        confirmLabel="Annuler la realisation"
        cancelLabel="Retour"
        onConfirm={handleConfirmUndo}
        onCancel={() => setShowUndoModal(false)}
        variant="danger"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  headerBadge: {
    marginRight: 8,
  },

  // ── Layout ────────────────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  // ── Header info card ──────────────────────────────────────────────────────
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoRowNoBorder: {
    borderBottomWidth: 0,
  },
  infoIcon: {
    marginRight: 12,
    width: 22,
  },
  infoContent: {
    flex: 1,
  },

  // ── Text variants ─────────────────────────────────────────────────────────
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  addressText: {
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
  },
  locationTypeText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  // ── Care type ─────────────────────────────────────────────────────────────
  careRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  careCode: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  careDash: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  careLabel: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },

  // ── Notes ─────────────────────────────────────────────────────────────────
  notesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginBottom: 12,
  },
  actionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  actionsContainer: {
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  actionButtonDanger: {
    backgroundColor: Colors.dangerLight,
    borderColor: Colors.danger,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  actionButtonTextLight: {
    color: Colors.white,
  },
  actionButtonTextDanger: {
    color: Colors.danger,
  },

  // ── Not found ─────────────────────────────────────────────────────────────
  notFoundContainer: {
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

  bottomSpacer: {
    height: 40,
  },
});
