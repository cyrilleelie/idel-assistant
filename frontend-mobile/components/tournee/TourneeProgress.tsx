/**
 * TourneeProgress — Card-based progress display for the tournee screen.
 *
 * Shows a white card with:
 *   - "Progression" label (secondary color)
 *   - Left: "X/Y RDV" large bold
 *   - Right: percentage in primary color + estimated time remaining
 *   - Progress bar: slate-100 track, primary fill, 8px height, rounded-full
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { TourneeStats } from '@/types/appointment';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TourneeProgressProps {
  stats: TourneeStats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rough estimate: average 20 min per remaining appointment. */
function estimateRemainingTime(remaining: number): string {
  const totalMinutes = remaining * 20;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min restants`;
  if (minutes === 0) return `${hours}h restants`;
  return `${hours}h${String(minutes).padStart(2, '0')} restants`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TourneeProgress({ stats }: TourneeProgressProps) {
  const { total, completed, canceled, remaining, progressPercent } = stats;

  // Edge case: nothing scheduled
  if (total === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Progression</Text>
        <View style={styles.statsRow}>
          <Text style={styles.rdvCount}>0/0 RDV</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '0%' }]} />
        </View>
      </View>
    );
  }

  // All non-canceled appointments are done
  const allDone = remaining === 0 && completed > 0;
  const fillPercent = Math.min(100, Math.max(0, progressPercent));

  const canceledSuffix = canceled > 0 ? ` (${canceled} annul.)` : '';
  const accessibilityText = `${completed} sur ${total} rendez-vous termines, ${fillPercent} pourcent${canceledSuffix}`;

  return (
    <View
      style={styles.card}
      accessibilityLabel={accessibilityText}
    >
      <Text style={styles.sectionLabel}>Progression</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {/* Left: X/Y RDV */}
        <View style={styles.statsLeft}>
          <Text style={styles.rdvCount}>
            {completed}/{total} RDV
          </Text>
          {canceled > 0 && (
            <Text style={styles.canceledText}>
              {canceled} annule{canceled > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Right: percentage + time remaining */}
        <View style={styles.statsRight}>
          {allDone ? (
            <View style={styles.doneRow}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.doneText}>Termine</Text>
            </View>
          ) : (
            <>
              <Text style={styles.percentText}>{fillPercent}%</Text>
              {remaining > 0 && (
                <Text style={styles.timeRemaining}>
                  {estimateRemainingTime(remaining)}
                </Text>
              )}
            </>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${fillPercent}%` as `${number}%` },
            allDone && styles.progressFillDone,
          ]}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // -- Stats row -----------------------------------------------------------
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  statsLeft: {
    flexDirection: 'column',
  },
  rdvCount: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 28,
  },
  canceledText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statsRight: {
    alignItems: 'flex-end',
  },
  percentText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    lineHeight: 28,
  },
  timeRemaining: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
  },

  // -- Progress bar --------------------------------------------------------
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  progressFillDone: {
    backgroundColor: Colors.success,
  },
});
