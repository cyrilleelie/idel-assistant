import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SectorBadge } from './SectorBadge';
import { theme } from '../utils/colors';
import { formatDistance, formatDuration } from '../utils/formatters';
import type { SlotSuggestion } from '../types/models';

interface SlotSuggestionCardProps {
  suggestion: SlotSuggestion;
  onBook: () => void;
  isBooking: boolean;
}

export function SlotSuggestionCard({ suggestion, onBook, isBooking }: SlotSuggestionCardProps) {
  const rankColors = ['#16A34A', '#2563EB', '#F59E0B'];
  const rankColor = rankColors[suggestion.rank - 1] || theme.textSecondary;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>#{suggestion.rank}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.time}>
            {suggestion.start_time} - {suggestion.end_time}
          </Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreValue}>{Math.round(suggestion.score)}</Text>
          <Text style={styles.scoreLabel}>score</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <FontAwesome name="road" size={12} color={theme.textSecondary} />
          <Text style={styles.detailText}>
            Detour: {formatDistance(suggestion.detour_km)} ({formatDuration(suggestion.detour_minutes)})
          </Text>
        </View>
        {suggestion.sector_name ? (
          <View style={styles.detailRow}>
            <FontAwesome name="map-marker" size={12} color={theme.textSecondary} />
            <SectorBadge
              name={suggestion.sector_name}
              color={suggestion.same_sector ? theme.success : theme.warning}
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.explanation}>{suggestion.explanation}</Text>

      <Button
        mode="contained"
        onPress={onBook}
        loading={isBooking}
        disabled={isBooking}
        style={styles.bookButton}
        buttonColor={theme.primary}
      >
        Reserver ce creneau
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  rankText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  timeBlock: {
    flex: 1,
  },
  time: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  scoreBlock: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.primary,
  },
  scoreLabel: {
    fontSize: 10,
    color: theme.textSecondary,
  },
  details: {
    gap: 6,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  explanation: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  bookButton: {
    borderRadius: 8,
  },
});
