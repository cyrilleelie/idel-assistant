/**
 * AppointmentCard — The primary list item for the tournee screen.
 *
 * Four visual states based on appointment status:
 *   COMPLETED  – successLight bg, green left border, compact (no actions)
 *   CANCELED   – borderLight bg, strikethrough patient name, badge "Annulé"
 *   NEXT       – white bg, primary left border, full detail + two action buttons
 *   SCHEDULED  – white bg, thin border left, full detail but no action buttons
 *
 * Action buttons (NEXT only) are rendered in their own TouchableOpacity views
 * to avoid nested Pressable conflicts in React Native.
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

interface TimeAndIconRowProps {
  appointment: AppointmentView;
  state: CardState;
}

function TimeAndIconRow({ appointment, state }: TimeAndIconRowProps) {
  const iconName =
    state === 'completed'
      ? 'checkmark-circle'
      : state === 'canceled'
        ? 'close-circle'
        : state === 'next'
          ? 'play-circle'
          : 'time-outline';

  const iconColor =
    state === 'completed'
      ? Colors.success
      : state === 'canceled'
        ? Colors.textTertiary
        : state === 'next'
          ? Colors.primary
          : Colors.textSecondary;

  const timeStyle = [
    styles.timeText,
    state === 'next' ? styles.timeTextBold : null,
    state === 'canceled' ? styles.canceledText : null,
  ];

  return (
    <View style={styles.timeRow}>
      <Ionicons name={iconName} size={16} color={iconColor} style={styles.stateIcon} />
      <Text style={timeStyle}>
        {formatTime(appointment.startTime)}
        {appointment.endTime ? ` – ${formatTime(appointment.endTime)}` : ''}
      </Text>
      {state === 'canceled' && (
        <View style={styles.canceledBadgeWrapper}>
          <Badge label="Annulé" variant="danger" />
        </View>
      )}
    </View>
  );
}

interface PatientNameRowProps {
  name: string;
  state: CardState;
  isAld: boolean;
  hasActiveBsi: boolean;
  bsiLevel: string | null;
}

function PatientNameRow({ name, state, isAld, hasActiveBsi, bsiLevel }: PatientNameRowProps) {
  const nameStyle = [
    styles.patientName,
    state === 'next' ? styles.patientNameBold : null,
    state === 'canceled' ? styles.canceledPatientName : null,
    state === 'completed' ? styles.completedPatientName : null,
  ];

  return (
    <View style={styles.patientRow}>
      <Text style={nameStyle} numberOfLines={1}>
        {name}
      </Text>
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

  // Derive container style from state — StyleSheet.flatten accepts falsy values
  const stateStyle =
    state === 'completed'
      ? styles.cardCompleted
      : state === 'canceled'
        ? styles.cardCanceled
        : state === 'next'
          ? styles.cardNext
          : styles.cardScheduled;

  const containerStyle: ViewStyle = StyleSheet.flatten([styles.card, stateStyle]);

  const duration =
    appointment.startTime && appointment.endTime
      ? estimateDuration(appointment.startTime, appointment.endTime)
      : null;

  const accessibilityLabel = [
    appointment.patient.displayName,
    formatTime(appointment.startTime),
    state === 'completed' ? 'réalisé' : state === 'canceled' ? 'annulé' : state === 'next' ? 'prochain' : 'planifié',
  ].join(', ');

  return (
    <View style={containerStyle}>
      {/* Pressable covers the entire card content but NOT the action buttons */}
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.pressableContent, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {/* Time + state icon row */}
        <TimeAndIconRow appointment={appointment} state={state} />

        {/* Patient name row (always visible) */}
        <PatientNameRow
          name={appointment.patient.displayName}
          state={state}
          isAld={appointment.patient.isAld}
          hasActiveBsi={appointment.patient.hasActiveBsi}
          bsiLevel={appointment.patient.bsiLevel}
        />

        {/* Compact state: only time + name */}
        {state === 'completed' && (
          <Text style={styles.completedLabel}>Réalisé</Text>
        )}

        {/* Full detail rows (NEXT + SCHEDULED) */}
        {(state === 'next' || state === 'scheduled') && (
          <View style={styles.detailRows}>
            <Text style={styles.careTypeText} numberOfLines={1}>
              {appointment.careTypeLabel}
              {' · '}
              {formatLocationType(appointment.locationType)}
              {duration != null ? ` · ${duration}` : ''}
            </Text>
          </View>
        )}

        {/* Address only for NEXT */}
        {state === 'next' && appointment.patient.address.length > 0 && (
          <Text style={styles.addressText} numberOfLines={2}>
            {appointment.patient.address}
          </Text>
        )}
      </Pressable>

      {/* Action buttons for NEXT state — outside Pressable to avoid nesting */}
      {state === 'next' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleNavigate}
            style={[styles.actionButton, styles.navigateButton]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Y aller"
          >
            <Ionicons name="compass-outline" size={16} color={Colors.text} />
            <Text style={styles.navigateButtonText}>Y aller</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleMarkComplete}
            disabled={isMarkingComplete}
            style={[
              styles.actionButton,
              styles.completeButton,
              isMarkingComplete && styles.actionButtonDisabled,
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Marquer comme réalisé"
            accessibilityState={{ busy: isMarkingComplete }}
          >
            {isMarkingComplete ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                <Text style={styles.completeButtonText}>Réalisé</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const AppointmentCard = React.memo(AppointmentCardInner);
export default AppointmentCard;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const LEFT_BORDER_WIDTH = 4;
const LEFT_BORDER_THIN = 2;

const styles = StyleSheet.create({
  // ── Card containers ──────────────────────────────────────────────────────
  card: {
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 5,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardCompleted: {
    backgroundColor: Colors.successLight,
    borderLeftWidth: LEFT_BORDER_WIDTH,
    borderLeftColor: Colors.success,
  },
  cardCanceled: {
    backgroundColor: Colors.borderLight,
    borderLeftWidth: LEFT_BORDER_THIN,
    borderLeftColor: Colors.disabled,
  },
  cardNext: {
    backgroundColor: Colors.surface,
    borderLeftWidth: LEFT_BORDER_WIDTH,
    borderLeftColor: Colors.primary,
  },
  cardScheduled: {
    backgroundColor: Colors.surface,
    borderLeftWidth: LEFT_BORDER_THIN,
    borderLeftColor: Colors.border,
  },

  // ── Pressable content area ────────────────────────────────────────────────
  pressableContent: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
  },
  pressed: {
    opacity: 0.85,
  },

  // ── Time row ─────────────────────────────────────────────────────────────
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stateIcon: {
    marginRight: 5,
  },
  timeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  timeTextBold: {
    fontWeight: '700',
    color: Colors.text,
    fontSize: 14,
  },
  canceledText: {
    color: Colors.textTertiary,
  },
  canceledBadgeWrapper: {
    marginLeft: 8,
  },

  // ── Patient name row ──────────────────────────────────────────────────────
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  patientNameBold: {
    fontWeight: '700',
    fontSize: 16,
  },
  canceledPatientName: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  completedPatientName: {
    color: Colors.success,
  },

  // ── ALD / BSI inline badges ───────────────────────────────────────────────
  aldBadge: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  aldText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.warning,
  },
  bsiBadge: {
    backgroundColor: Colors.primaryUltraLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bsiText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Detail rows (care type, location, duration) ───────────────────────────
  detailRows: {
    marginTop: 2,
  },
  careTypeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ── Address (NEXT only) ───────────────────────────────────────────────────
  addressText: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 4,
    lineHeight: 18,
  },

  // ── Completed label ───────────────────────────────────────────────────────
  completedLabel: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
    marginTop: 2,
  },

  // ── Action buttons (NEXT) ─────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  navigateButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navigateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  completeButton: {
    backgroundColor: Colors.primary,
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
});
