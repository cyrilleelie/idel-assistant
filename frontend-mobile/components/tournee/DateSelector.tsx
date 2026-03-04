/**
 * DateSelector — Three-pill date navigator for the tournee screen.
 *
 * Shows J-1, today, and J+1 as tappable pill buttons.
 * Active pill (matching selectedDate) gets a filled primary background.
 * Pills outside the offline window are dimmed and non-interactive.
 * Below the pills, the full French-formatted date is shown as a subtitle.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors } from '@/constants/colors';
import {
  formatDateFrench,
  getRelativeDayLabel,
  addDays,
  getTodayString,
  isWithinOfflineWindow,
} from '@/utils/dateHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DaySelectorItem {
  date: string;
  label: string;
}

interface DateSelectorProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  /** Custom day pills. Defaults to [Hier, Auj., Demain] when omitted. */
  days?: DaySelectorItem[];
}

interface DayPill {
  date: string;
  label: string;
  isActive: boolean;
  isDisabled: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DateSelector({ selectedDate, onDateChange, days }: DateSelectorProps) {
  const today = getTodayString();

  const pills: DayPill[] = useMemo(() => {
    if (days) {
      return days.map((d) => ({
        date: d.date,
        label: d.label,
        isActive: selectedDate === d.date,
        isDisabled: false,
      }));
    }

    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);

    return [
      {
        date: yesterday,
        label: 'Hier',
        isActive: selectedDate === yesterday,
        isDisabled: !isWithinOfflineWindow(yesterday),
      },
      {
        date: today,
        label: "Auj.",
        isActive: selectedDate === today,
        isDisabled: !isWithinOfflineWindow(today),
      },
      {
        date: tomorrow,
        label: 'Demain',
        isActive: selectedDate === tomorrow,
        isDisabled: !isWithinOfflineWindow(tomorrow),
      },
    ];
  }, [today, selectedDate, days]);

  const relativeDayLabel = getRelativeDayLabel(selectedDate);
  const fullDateLabel = formatDateFrench(selectedDate);

  return (
    <View style={styles.container}>
      {/* Pill row */}
      <View style={styles.pillRow}>
        {pills.map((pill) => (
          <TouchableOpacity
            key={pill.date}
            onPress={() => onDateChange(pill.date)}
            disabled={pill.isDisabled}
            style={[
              styles.pill,
              pill.isActive ? styles.pillActive : styles.pillInactive,
              pill.isDisabled && styles.pillDisabled,
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={pill.label}
            accessibilityState={{ selected: pill.isActive, disabled: pill.isDisabled }}
          >
            {/* Left arrow indicator for Hier */}
            {pill.label === 'Hier' && (
              <Text
                style={[
                  styles.pillArrow,
                  pill.isActive ? styles.pillTextActive : styles.pillTextInactive,
                ]}
              >
                {'◀ '}
              </Text>
            )}
            <Text
              style={[
                styles.pillText,
                pill.isActive ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              {pill.isActive && pill.label === 'Auj.' ? '● ' : ''}
              {pill.label}
            </Text>
            {/* Right arrow indicator for Demain */}
            {pill.label === 'Demain' && (
              <Text
                style={[
                  styles.pillArrow,
                  pill.isActive ? styles.pillTextActive : styles.pillTextInactive,
                ]}
              >
                {' ▶'}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Full date label */}
      <View style={styles.fullDateRow}>
        {relativeDayLabel != null && (
          <Text style={styles.relativeLabel}>{relativeDayLabel} · </Text>
        )}
        <Text style={styles.fullDateText}>{fullDateLabel}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // ── Pill row ──────────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minHeight: 44,
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  pillInactive: {
    backgroundColor: Colors.borderLight,
  },
  pillDisabled: {
    opacity: 0.4,
  },

  // ── Pill text ─────────────────────────────────────────────────────────────
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pillTextActive: {
    color: Colors.white,
  },
  pillTextInactive: {
    color: Colors.text,
  },
  pillArrow: {
    fontSize: 11,
    fontWeight: '400',
  },

  // ── Full date row ─────────────────────────────────────────────────────────
  fullDateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relativeLabel: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  fullDateText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
});
