/**
 * VitaleStatusBadge — Badge showing Carte Vitale status.
 *
 * In v1, this will always be 'not_read'. Future iterations will
 * integrate e-CPS or NFC Bluetooth reader to change the status.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface VitaleStatusBadgeProps {
  status: 'not_read' | 'read_pending' | 'validated';
}

const CONFIG = {
  not_read: {
    label: 'Carte vitale non lue',
    icon: 'card-outline' as const,
    bg: Colors.borderLight,
    color: Colors.textSecondary,
  },
  read_pending: {
    label: 'Lecture en attente',
    icon: 'time-outline' as const,
    bg: Colors.warningLight,
    color: Colors.warning,
  },
  validated: {
    label: 'Carte vitale validee',
    icon: 'checkmark-circle-outline' as const,
    bg: Colors.successLight,
    color: Colors.success,
  },
};

export default function VitaleStatusBadge({ status }: VitaleStatusBadgeProps) {
  const cfg = CONFIG[status] ?? CONFIG.not_read;

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
      <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
