/**
 * PreparationHeader — Stats header for the preparation screen.
 *
 * Shows the date (with relative label), patient count, new info count,
 * and an indicator of data source (local vs server AI).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRelativeDayLabel, formatDateFrench } from '@/utils/dateHelpers';
import { Colors } from '@/constants/colors';

interface PreparationHeaderProps {
  date: string;
  totalPatients: number;
  patientsWithNewInfo: number;
  source: 'local' | 'server' | null;
}

export default function PreparationHeader({
  date,
  totalPatients,
  patientsWithNewInfo,
  source,
}: PreparationHeaderProps) {
  const relativeLabel = getRelativeDayLabel(date);
  const frenchDate = formatDateFrench(date);
  // Capitalize first letter of French date
  const dateDisplay = frenchDate.charAt(0).toUpperCase() + frenchDate.slice(1);

  return (
    <View style={styles.container}>
      <Text style={styles.dateLabel}>
        {relativeLabel ? `${relativeLabel} \u2014 ${dateDisplay}` : dateDisplay}
      </Text>
      <Text style={styles.stats}>
        <Text style={styles.statsBold}>{totalPatients} patient{totalPatients > 1 ? 's' : ''}</Text>
        {patientsWithNewInfo > 0 && (
          <>
            {' \u00B7 '}
            <Text style={styles.statsHighlight}>
              {patientsWithNewInfo} avec nouvelles infos
            </Text>
          </>
        )}
      </Text>
      {source && (
        <View style={styles.sourceRow}>
          <Ionicons
            name={source === 'server' ? 'cloud-outline' : 'phone-portrait-outline'}
            size={12}
            color={Colors.textTertiary}
          />
          <Text style={styles.sourceText}>
            {source === 'server' ? 'Syntheses IA serveur' : 'Syntheses locales'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    gap: 4,
  },
  dateLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  stats: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statsBold: {
    fontWeight: '600',
    color: Colors.text,
  },
  statsHighlight: {
    fontWeight: '600',
    color: Colors.primary,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  sourceText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
