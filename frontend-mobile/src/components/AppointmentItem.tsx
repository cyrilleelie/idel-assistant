import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SectorBadge } from './SectorBadge';
import { theme } from '../utils/colors';
import { formatTime } from '../utils/formatters';
import type { MapStop } from '../types/models';

interface AppointmentItemProps {
  stop: MapStop;
  index: number;
}

export function AppointmentItem({ stop, index }: AppointmentItemProps) {
  const locationIcon = stop.care_type === 'cabinet' ? 'building' : 'home';

  return (
    <View style={styles.container}>
      <View style={styles.timeColumn}>
        <Text style={styles.order}>{index + 1}</Text>
        <Text style={styles.time}>{formatTime(stop.time)}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.patientName}>{stop.patient_name}</Text>
        <View style={styles.detailRow}>
          <FontAwesome name={locationIcon as any} size={12} color={theme.textSecondary} />
          <Text style={styles.detail}>{stop.care_type}</Text>
        </View>
        {stop.sector_name ? (
          <SectorBadge name={stop.sector_name} color={stop.sector_color || theme.primary} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 64,
    alignItems: 'center',
  },
  timeColumn: {
    width: 50,
    alignItems: 'center',
    marginRight: 12,
  },
  order: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primary,
  },
  time: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detail: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});
