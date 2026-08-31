/**
 * PreparationCard — Patient card for the preparation screen.
 *
 * Shows patient avatar, name, critical badge, time slot, alert message,
 * and expandable transmission list. Stitch-inspired design.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PatientPreparation } from '@/services/preparationService';
import TransmissionCard from '@/components/transmission/TransmissionCard';
import { formatTime } from '@/utils/dateHelpers';
import { getTodayString, addDays } from '@/utils/dateHelpers';
import { Colors } from '@/constants/colors';

interface PreparationCardProps {
  preparation: PatientPreparation;
  isExpanded: boolean;
  currentUserId: string;
  onToggleExpand: () => void;
  onPressPatient: () => void;
  onPressAppointment: () => void;
  onViewTransmission?: (txId: string) => void;
}

export default React.memo(function PreparationCard({
  preparation,
  isExpanded,
  currentUserId,
  onToggleExpand,
  onPressPatient,
  onPressAppointment,
  onViewTransmission,
}: PreparationCardProps) {
  const {
    patientName,
    appointmentTime,
    careTypes,
    careTypeLabels,
    locationType,
    lastVisitByCurrentUser,
    transmissionsSinceLastVisit,
    aiSummary,
    hasNewInfo,
    hasAlerts,
  } = preparation;

  const careDisplay = careTypeLabels.length > 0 ? careTypeLabels.join(', ') : careTypes.join(' + ');
  const locationLabel = formatLocation(locationType);
  const lastVisitLabel = formatLastVisit(lastVisitByCurrentUser);
  const txCount = transmissionsSinceLastVisit.length;

  // Patient initials for avatar
  const initials = patientName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.card}>
      {/* Top row: avatar + name + badge + time */}
      <View style={styles.topRow}>
        <Pressable onPress={onPressPatient} style={styles.avatarNameRow}>
          <View style={[styles.avatar, hasAlerts && styles.avatarAlert]}>
            <Text style={[styles.avatarText, hasAlerts && styles.avatarTextAlert]}>{initials}</Text>
          </View>
          <View style={styles.nameColumn}>
            <View style={styles.nameRow}>
              <Text style={styles.patientName} numberOfLines={1}>{patientName}</Text>
              {hasAlerts && (
                <View style={styles.criticalBadge}>
                  <Text style={styles.criticalBadgeText}>INFO CRITIQUE</Text>
                </View>
              )}
            </View>
            <Text style={styles.careRow}>
              {careDisplay} {'\u00B7'} {locationLabel}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={onPressAppointment} hitSlop={8}>
          <View style={styles.timeChip}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.timeText}>{formatTime(appointmentTime)}</Text>
          </View>
        </Pressable>
      </View>

      {/* Alert message block */}
      {hasAlerts && aiSummary && aiSummary.alerts.length > 0 && (
        <View style={styles.alertBlock}>
          {aiSummary.alerts.map((alert, idx) => (
            <Text key={idx} style={styles.alertText}>{alert}</Text>
          ))}
        </View>
      )}

      {/* AI Summary section (non-alert) */}
      {hasNewInfo && aiSummary && !hasAlerts && (
        <View style={styles.summarySection}>
          <View style={styles.summaryHeader}>
            <Ionicons name="document-text-outline" size={14} color={Colors.primary} />
            <Text style={styles.summaryTitle}>
              Resume {lastVisitLabel}
            </Text>
          </View>

          {txCount > 0 && (
            <Text style={styles.txCountText}>
              {txCount} transmission{txCount > 1 ? 's' : ''} de{' '}
              {uniqueAuthors(transmissionsSinceLastVisit)}.
            </Text>
          )}

          <Text style={styles.summaryText}>{aiSummary.text}</Text>

          {/* Key vitals */}
          {aiSummary.keyVitals && (
            <Text style={styles.vitalsText}>
              Constantes : {formatVitals(aiSummary.keyVitals)}
            </Text>
          )}
        </View>
      )}

      {/* AI Summary with alerts — show text too */}
      {hasAlerts && aiSummary && aiSummary.text && (
        <View style={styles.summarySection}>
          <View style={styles.summaryHeader}>
            <Ionicons name="document-text-outline" size={14} color={Colors.primary} />
            <Text style={styles.summaryTitle}>
              Resume {lastVisitLabel}
            </Text>
          </View>
          <Text style={styles.summaryText}>{aiSummary.text}</Text>
          {aiSummary.keyVitals && (
            <Text style={styles.vitalsText}>
              Constantes : {formatVitals(aiSummary.keyVitals)}
            </Text>
          )}
        </View>
      )}

      {/* No new info */}
      {!hasNewInfo && (
        <View style={styles.noInfoSection}>
          <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
          <Text style={styles.noInfoText}>
            Aucune nouvelle transmission{'\n'}
            <Text style={styles.noInfoSubtext}>{lastVisitLabel}</Text>
          </Text>
        </View>
      )}

      {/* Expand/collapse button */}
      {txCount > 0 && (
        <Pressable
          onPress={onToggleExpand}
          style={({ pressed }) => [styles.expandBtn, pressed && styles.expandBtnPressed]}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? 'Masquer les transmissions' : `Voir les ${txCount} transmissions`}
        >
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.primary}
          />
          <Text style={styles.expandText}>
            {isExpanded ? 'Masquer' : 'Voir'} les {txCount} transmission{txCount > 1 ? 's' : ''}
          </Text>
        </Pressable>
      )}

      {/* Expanded transmissions */}
      {isExpanded && txCount > 0 && (
        <View style={styles.transmissionsContainer}>
          {transmissionsSinceLastVisit.map((tx) => (
            <TransmissionCard
              key={tx.id}
              transmission={{
                id: tx.id,
                serverId: '',
                patientId: preparation.patientId,
                appointmentId: null,
                authorUserId: tx.isCurrentUser ? currentUserId : '',
                authorName: tx.authorName,
                contentText: tx.contentText,
                contentStructured: tx.contentStructured,
                audioFilePath: tx.hasAudio ? 'audio' : null,
                status: tx.status as 'draft' | 'pending_transcription' | 'transcribed' | 'validated',
                audioUploaded: false,
                createdAt: new Date(`${tx.date}T${tx.time}:00`).getTime(),
              }}
              isCurrentUser={tx.isCurrentUser}
              onViewFull={onViewTransmission ? () => onViewTransmission(tx.id) : undefined}
            />
          ))}
        </View>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLocation(locationType: string): string {
  switch (locationType) {
    case 'home':
      return 'Domicile';
    case 'office':
      return 'Cabinet';
    case 'hospital':
    case 'ehpad':
      return 'EHPAD';
    default:
      return locationType;
  }
}

function formatLastVisit(lastVisitDate: string | null): string {
  if (!lastVisitDate) return '(premiere visite)';

  const today = getTodayString();
  const yesterday = addDays(today, -1);

  if (lastVisitDate === yesterday) {
    return 'depuis votre derniere visite hier';
  }

  const lastDate = new Date(`${lastVisitDate}T00:00:00`);
  const todayDate = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'depuis votre visite aujourd\'hui';
  if (diffDays === 1) return 'depuis votre derniere visite hier';
  return `depuis votre derniere visite il y a ${diffDays} jours`;
}

function uniqueAuthors(txs: { authorName: string }[]): string {
  const names = [...new Set(txs.map((t) => t.authorName))];
  return names.join(', ');
}

function formatVitals(vitals: Record<string, string>): string {
  const parts: string[] = [];
  if (vitals.ta) parts.push(`TA ${vitals.ta}`);
  if (vitals.temperature) parts.push(`T ${vitals.temperature}`);
  if (vitals.glycemie) parts.push(`Glyc. ${vitals.glycemie}`);
  if (vitals.pouls) parts.push(`Pouls ${vitals.pouls}`);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatarNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAlert: {
    backgroundColor: Colors.errorLight,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  avatarTextAlert: {
    color: Colors.error,
  },
  nameColumn: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  criticalBadge: {
    backgroundColor: Colors.error,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  criticalBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  careRow: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  // Time chip
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  // Alert block
  alertBlock: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  alertText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.text,
    lineHeight: 20,
  },
  // Summary
  summarySection: {
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  txCountText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  summaryText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  // Vitals
  vitalsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  // No info
  noInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  noInfoText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  noInfoSubtext: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  // Expand
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  expandBtnPressed: {
    opacity: 0.7,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Expanded transmissions
  transmissionsContainer: {
    gap: 4,
    marginHorizontal: -16,
    marginBottom: -16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
