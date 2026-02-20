import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '../utils/colors';
import { formatDistance, formatDuration } from '../utils/formatters';
import type { TourneeMetrics } from '../types/models';

interface MetricsBarProps {
  metrics: TourneeMetrics;
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <View style={styles.container}>
      <MetricItem
        icon="user"
        value={String(metrics.num_stops)}
        label="patients"
      />
      <MetricItem
        icon="road"
        value={formatDistance(metrics.total_distance_km)}
        label="trajet"
      />
      <MetricItem
        icon="car"
        value={formatDuration(metrics.total_travel_minutes)}
        label="route"
      />
      <MetricItem
        icon="heartbeat"
        value={formatDuration(metrics.total_care_minutes)}
        label="soins"
      />
    </View>
  );
}

function MetricItem({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.item}>
      <FontAwesome name={icon as any} size={14} color={theme.primary} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  item: {
    alignItems: 'center',
    gap: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  label: {
    fontSize: 10,
    color: theme.textSecondary,
  },
});
