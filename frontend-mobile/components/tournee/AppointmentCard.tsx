/**
 * AppointmentCard — The primary list item for the tournee screen.
 *
 * Four visual states based on appointment status:
 *   COMPLETED  – emerald-100 bg, green checkmark circle, faded text, "Termine" badge
 *   CANCELED   – borderLight bg, strikethrough patient name, "Annule" badge
 *   NEXT       – white bg, left-4 primary border, "EN COURS" badge, full detail + action buttons
 *   SCHEDULED  – white bg, slightly transparent, clock icon, compact layout, chevron right
 *
 * Wrapped in React.memo for FlatList performance.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import Badge from '@/components/ui/Badge';
import { formatTime } from '@/utils/dateHelpers';
import { formatLocationType, estimateDuration } from '@/utils/formatters';
import type { AppointmentView } from '@/types/appointment';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppointmentCardProps {
  appointment: AppointmentView;
  onPress: (appointment: AppointmentView) => void;
  onMarkComplete: (appointment: AppointmentView) => void;
  onNavigate: (appointment: AppointmentView) => void;
  isMarkingComplete: boolean;
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

type CardState = 'completed' | 'canceled' | 'next' | 'scheduled';

function getCardState(appointment: AppointmentView): CardState {
  if (appointment.isCompleted || appointment.status === 'completed') return 'completed';
  if (appointment.isCanceled || appointment.status === 'canceled' || appointment.status === 'cancelled') return 'canceled';
  if (appointment.isNext) return 'next';
  return 'scheduled';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PatientBadgesProps {
  isAld: boolean;
  hasActiveBsi: boolean;
  bsiLevel: string | null;
}

function PatientBadges({ isAld, hasActiveBsi, bsiLevel }: PatientBadgesProps) {
  if (!isAld && !(hasActiveBsi && bsiLevel)) return null;
  return (
    <View style={styles.badgeRow}>
      {isAld && (
        <View style={styles.aldBadge}>
          <Text style={styles.aldText}>ALD</Text>
        </View>
      )}
      {hasActiveBsi && bsiLevel != null && (
        <View style={styles.bsiBadge}>
          <Text style={styles.bsiText}>BSI {bsiLevel}</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Completed Card
// ---------------------------------------------------------------------------

function CompletedCard({ appointment, onPress }: { appointment: AppointmentView; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.cardCompleted, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${appointment.patient.displayName}, termine`}
    >
      <View style={styles.completedContent}>
        {/* Green checkmark circle */}
        <View style={styles.completedIconCircle}>
          <Ionicons name="checkmark" size={16} color={Colors.white} />
        </View>

        {/* Middle: time + patient name */}
        <View style={styles.completedInfo}>
          <Text style={styles.completedTime}>
            {formatTime(appointment.startTime)}
            {' - '}
            {appointment.careTypeLabel}
          </Text>
          <Text style={styles.completedName} numberOfLines={1}>
            {appointment.patient.displayName}
          </Text>
        </View>

        {/* Right: Termine badge */}
        <Text style={styles.completedBadge}>Termine</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Next (EN COURS) Card
// ---------------------------------------------------------------------------

function NextCard({
  appointment,
  onPress,
  onMarkComplete,
  onNavigate,
  isMarkingComplete,
}: {
  appointment: AppointmentView;
  onPress: () => void;
  onMarkComplete: () => void;
  onNavigate: () => void;
  isMarkingComplete: boolean;
}) {
  const duration =
    appointment.startTime && appointment.endTime
      ? estimateDuration(appointment.startTime, appointment.endTime)
      : null;

  return (
    <View style={[styles.card, styles.cardNext]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.nextContent, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${appointment.patient.displayName}, en cours`}
      >
        {/* EN COURS badge */}
        <View style={styles.enCoursBadgeRow}>
          <View style={styles.enCoursBadge}>
            <Text style={styles.enCoursBadgeText}>EN COURS</Text>
          </View>
          {/* Info button */}
          <TouchableOpacity
            onPress={onPress}
            style={styles.infoButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="information-circle-outline" size={22} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Time + care type */}
        <Text style={styles.nextTimeText}>
          {formatTime(appointment.startTime)}
          {appointment.endTime ? ` - ${formatTime(appointment.endTime)}` : ''}
          {' | '}
          {appointment.careTypeLabel}
          {duration != null ? ` | ${duration}` : ''}
        </Text>

        {/* Patient name */}
        <Text style={styles.nextPatientName} numberOfLines={1}>
          {appointment.patient.displayName}
        </Text>

        {/* Patient badges */}
        <PatientBadges
          isAld={appointment.patient.isAld}
          hasActiveBsi={appointment.patient.hasActiveBsi}
          bsiLevel={appointment.patient.bsiLevel}
        />

        {/* Address */}
        {appointment.patient.address.length > 0 && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
            <Text style={styles.addressText} numberOfLines={2}>
              {appointment.patient.address}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={onMarkComplete}
          disabled={isMarkingComplete}
          style={[
            styles.actionButton,
            styles.validateButton,
            isMarkingComplete && styles.actionButtonDisabled,
          ]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Valider le rendez-vous"
          accessibilityState={{ busy: isMarkingComplete }}
        >
          {isMarkingComplete ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
              <Text style={styles.validateButtonText}>Valider</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNavigate}
          style={[styles.actionButton, styles.navigateButton]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Naviguer vers le patient"
        >
          <Ionicons name="navigate-outline" size={16} color="#475569" />
          <Text style={styles.navigateButtonText}>Naviguer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Scheduled Card
// ---------------------------------------------------------------------------

function ScheduledCard({ appointment, onPress }: { appointment: AppointmentView; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.cardScheduled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${appointment.patient.displayName}, planifie`}
    >
      <View style={styles.scheduledContent}>
        {/* Clock icon */}
        <View style={styles.scheduledIconCircle}>
          <Ionicons name="time-outline" size={16} color="#94A3B8" />
        </View>

        {/* Middle: time + patient */}
        <View style={styles.scheduledInfo}>
          <Text style={styles.scheduledTime}>
            {formatTime(appointment.startTime)}
            {' - '}
            {appointment.careTypeLabel}
          </Text>
          <Text style={styles.scheduledName} numberOfLines={1}>
            {appointment.patient.displayName}
          </Text>
          <PatientBadges
            isAld={appointment.patient.isAld}
            hasActiveBsi={appointment.patient.hasActiveBsi}
            bsiLevel={appointment.patient.bsiLevel}
          />
        </View>

        {/* Right: chevron */}
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Canceled Card
// ---------------------------------------------------------------------------

function CanceledCard({ appointment, onPress }: { appointment: AppointmentView; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.cardCanceled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${appointment.patient.displayName}, annule`}
    >
      <View style={styles.canceledContent}>
        <View style={styles.canceledLeft}>
          <Ionicons name="close-circle" size={16} color={Colors.textTertiary} style={{ marginRight: 6 }} />
          <Text style={styles.canceledTime}>
            {formatTime(appointment.startTime)}
          </Text>
          <Text style={styles.canceledName} numberOfLines={1}>
            {appointment.patient.displayName}
          </Text>
        </View>
        <Badge label="Annule" variant="danger" />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function AppointmentCardInner({
  appointment,
  onPress,
  onMarkComplete,
  onNavigate,
  isMarkingComplete,
}: AppointmentCardProps) {
  const state = getCardState(appointment);

  const handlePress = useCallback(() => {
    onPress(appointment);
  }, [appointment, onPress]);

  const handleNavigate = useCallback(() => {
    onNavigate(appointment);
  }, [appointment, onNavigate]);

  const handleMarkComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onMarkComplete(appointment);
  }, [appointment, onMarkComplete]);

  switch (state) {
    case 'completed':
      return <CompletedCard appointment={appointment} onPress={handlePress} />;
    case 'next':
      return (
        <NextCard
          appointment={appointment}
          onPress={handlePress}
          onMarkComplete={handleMarkComplete}
          onNavigate={handleNavigate}
          isMarkingComplete={isMarkingComplete}
        />
      );
    case 'canceled':
      return <CanceledCard appointment={appointment} onPress={handlePress} />;
    case 'scheduled':
    default:
      return <ScheduledCard appointment={appointment} onPress={handlePress} />;
  }
}

const AppointmentCard = React.memo(AppointmentCardInner);
export default AppointmentCard;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // -- Base card -----------------------------------------------------------
  card: {
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },

  // -- Completed -----------------------------------------------------------
  cardCompleted: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  completedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  completedIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedInfo: {
    flex: 1,
  },
  completedTime: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  completedName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    opacity: 0.8,
  },
  completedBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },

  // -- Next (EN COURS) -----------------------------------------------------
  cardNext: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  nextContent: {
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  enCoursBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  enCoursBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  enCoursBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  infoButton: {
    padding: 2,
  },
  nextTimeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  nextPatientName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 6,
  },
  addressText: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 18,
    flex: 1,
  },

  // -- Scheduled -----------------------------------------------------------
  cardScheduled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    opacity: 0.85,
  },
  scheduledContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  scheduledIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduledInfo: {
    flex: 1,
  },
  scheduledTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },
  scheduledName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },

  // -- Canceled -----------------------------------------------------------
  cardCanceled: {
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  canceledContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  canceledLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  canceledTime: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginRight: 8,
  },
  canceledName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
    flex: 1,
  },

  // -- Badges (ALD / BSI) -------------------------------------------------
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  aldBadge: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aldText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.warning,
  },
  bsiBadge: {
    backgroundColor: Colors.primaryUltraLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bsiText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },

  // -- Action buttons (NEXT) -----------------------------------------------
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 6,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  validateButton: {
    backgroundColor: Colors.primary,
  },
  validateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  navigateButton: {
    backgroundColor: '#F1F5F9',
  },
  navigateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});
