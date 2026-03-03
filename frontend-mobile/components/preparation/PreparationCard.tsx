/**
 * PreparationCard — Patient card for the preparation screen.
 *
 * Shows appointment time, patient name, care types, AI summary with alerts,
 * and expandable transmission list. Border color indicates priority:
 * - Orange: alerts detected
 * - Blue: new info, no alerts
 * - No border accent: no new info
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

  const borderColor = hasAlerts
    ? Colors.warning
    : hasNewInfo
      ? Colors.primary
      : 'transparent';

  const careDisplay = careTypes.join(' + ');
  const locationLabel = formatLocation(locationType);
  const lastVisitLabel = formatLastVisit(lastVisitByCurrentUser);
  const txCount = transmissionsSinceLastVisit.length;

  return (
    <View style={[styles.card, { borderLeftColor: borderColor, borderLeftWidth: borderColor === 'transparent' ? 0 : 3 }]}>
      {/* Time + patient name */}
      <Pressable onPress={onPressAppointment} hitSlop={4}>
        <Text style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(appointmentTime)}</Text>
          {' \u2014 '}
          <Pressable onPress={onPressPatient}>
            <Text style={styles.patientName}>{patientName}</Text>
          </Pressable>
        </Text>
      </Pressable>

      {/* Care types + location */}
      <Text style={styles.careRow}>
        {careDisplay}
        {careTypeLabels.length > 0 && careTypeLabels[0] !== careTypes[0] && (
          <Text style={styles.careLabel}> ({careTypeLabels[0]})</Text>
        )}
        {' \u00B7 '}
        {locationLabel}
      </Text>

      {/* AI Summary section */}
      {hasNewInfo && aiSummary ? (
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

          {/* Alerts */}
          {aiSummary.alerts.length > 0 && (
            <View style={styles.alertsContainer}>
              {aiSummary.alerts.map((alert, idx) => (
                <View key={idx} style={styles.alertRow}>
                  <Text style={styles.alertIcon}>&#9888;&#65039;</Text>
                  <Text style={styles.alertText}>{alert}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Key vitals */}
          {aiSummary.keyVitals && (
            <Text style={styles.vitalsText}>
              Constantes : {formatVitals(aiSummary.keyVitals)}
            </Text>
          )}
        </View>
      ) : (
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
  if (vitals.temperature) parts.push(`T° ${vitals.temperature}`);
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  // Header
  timeRow: {
    fontSize: 15,
    color: Colors.text,
  },
  time: {
    fontWeight: '700',
    color: Colors.text,
  },
  patientName: {
    fontWeight: '700',
    color: Colors.primary,
  },
  careRow: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  careLabel: {
    color: Colors.textTertiary,
  },
  // Summary
  summarySection: {
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
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
  // Alerts
  alertsContainer: {
    gap: 4,
    marginTop: 4,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  alertIcon: {
    fontSize: 13,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.warning,
    lineHeight: 18,
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
    paddingVertical: 6,
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
    marginHorizontal: -14,
    marginBottom: -14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
