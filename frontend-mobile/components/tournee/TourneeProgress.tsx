/**
 * TourneeProgress — Compact progress bar + summary for the tournee screen header.
 *
 * Three display modes:
 *   - total === 0          → "Aucun RDV"
 *   - all remaining done   → "X RDV · Tous réalisés" + checkmark icon
 *   - in progress          → "X RDV · Y réalisés" (+ "· Z annulés" if any canceled)
 *
 * Progress bar height 4, filled with Colors.success at progressPercent%.
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
// Component
// ---------------------------------------------------------------------------

export default function TourneeProgress({ stats }: TourneeProgressProps) {
  const { total, completed, canceled, remaining, progressPercent } = stats;

  // Edge case: nothing scheduled
  if (total === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Aucun RDV</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '0%' }]} />
        </View>
      </View>
    );
  }

  // All non-canceled appointments are done
  const allDone = remaining === 0 && completed > 0;

  // Build summary text pieces
  const totalLabel = `${total} RDV`;
  const completedLabel = allDone ? 'Tous réalisés' : `${completed} réalisé${completed > 1 ? 's' : ''}`;
  const canceledLabel = canceled > 0 ? ` · ${canceled} annulé${canceled > 1 ? 's' : ''}` : '';

  // Clamp progressPercent to [0, 100]
  const fillPercent = Math.min(100, Math.max(0, progressPercent));

  return (
    <View style={styles.container}>
      {/* Summary text row */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {totalLabel}
          {' · '}
          <Text style={allDone ? styles.doneText : styles.progressText}>
            {completedLabel}
          </Text>
          {canceledLabel.length > 0 && (
            <Text style={styles.canceledText}>{canceledLabel}</Text>
          )}
        </Text>
        {allDone && (
          <Ionicons
            name="checkmark-circle"
            size={15}
            color={Colors.success}
            style={styles.checkIcon}
          />
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            // Use a fixed-width string percentage for RN layout
            { width: `${fillPercent}%` as `${number}%` },
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
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // ── Summary row ───────────────────────────────────────────────────────────
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
    flexShrink: 1,
  },
  doneText: {
    color: Colors.success,
    fontWeight: '600',
  },
  progressText: {
    color: Colors.text,
    fontWeight: '500',
  },
  canceledText: {
    color: Colors.textTertiary,
  },
  checkIcon: {
    marginLeft: 5,
  },

  // ── Progress bar ──────────────────────────────────────────────────────────
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.success,
  },
});
