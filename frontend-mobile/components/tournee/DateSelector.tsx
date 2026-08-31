/**
 * DateSelector — Horizontal scrollable pill date navigator for the tournee screen.
 *
 * Shows Hier, Aujourd'hui, Demain plus additional dates as tappable pills.
 * Active pill gets a filled primary background with shadow.
 * Inactive pills get a slate-200 background.
 * Below the pills, the full French-formatted date is shown as a subtitle.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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
  /** Custom day pills. Defaults to a 7-day range when omitted. */
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
  const scrollRef = useRef<ScrollView>(null);

  const pills: DayPill[] = useMemo(() => {
    if (days) {
      return days.map((d) => ({
        date: d.date,
        label: d.label,
        isActive: selectedDate === d.date,
        isDisabled: false,
      }));
    }

    // Build a range: yesterday, today, tomorrow, +2, +3
    const dayOffsets = [-1, 0, 1, 2, 3];
    const labels = ['Hier', "Aujourd'hui", 'Demain'];

    return dayOffsets.map((offset, index) => {
      const date = addDays(today, offset);
      let label: string;
      if (index < labels.length) {
        label = labels[index];
      } else {
        // Format as short day name: "Jeu. 18"
        const d = new Date(`${date}T00:00:00`);
        const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' });
        const dayNum = d.getDate();
        label = `${dayName.charAt(0).toUpperCase()}${dayName.slice(1)} ${dayNum}`;
      }

      return {
        date,
        label,
        isActive: selectedDate === date,
        isDisabled: !isWithinOfflineWindow(date),
      };
    });
  }, [today, selectedDate, days]);

  // Auto-scroll to active pill
  const activeIndex = pills.findIndex((p) => p.isActive);
  useEffect(() => {
    if (scrollRef.current && activeIndex >= 0) {
      // Approximate pill width + gap to scroll to the right position
      const estimatedPillWidth = 110;
      const scrollX = Math.max(0, activeIndex * estimatedPillWidth - 40);
      scrollRef.current.scrollTo({ x: scrollX, animated: true });
    }
  }, [activeIndex]);

  const relativeDayLabel = getRelativeDayLabel(selectedDate);
  const fullDateLabel = formatDateFrench(selectedDate);

  return (
    <View style={styles.container}>
      {/* Scrollable pill row */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
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
            <Text
              style={[
                styles.pillText,
                pill.isActive ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              {pill.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Full date label */}
      <View style={styles.fullDateRow}>
        {relativeDayLabel != null && (
          <Text style={styles.relativeLabel}>{relativeDayLabel} - </Text>
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
    paddingTop: 12,
    paddingBottom: 10,
  },

  // -- Pill row (horizontal scroll) ----------------------------------------
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    minHeight: 44,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pillInactive: {
    backgroundColor: '#E2E8F0',
  },
  pillDisabled: {
    opacity: 0.4,
  },

  // -- Pill text -----------------------------------------------------------
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pillTextActive: {
    color: Colors.white,
  },
  pillTextInactive: {
    color: '#475569',
  },

  // -- Full date row -------------------------------------------------------
  fullDateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
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
