// Small inline label badge with semantic color variants

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Colors } from '@/constants/colors';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { container: ViewStyle; text: TextStyle }> = {
  success: {
    container: { backgroundColor: Colors.successLight },
    text: { color: Colors.success },
  },
  warning: {
    container: { backgroundColor: Colors.warningLight },
    text: { color: Colors.warning },
  },
  danger: {
    container: { backgroundColor: Colors.dangerLight },
    text: { color: Colors.danger },
  },
  info: {
    container: { backgroundColor: Colors.primaryUltraLight },
    text: { color: Colors.primary },
  },
  neutral: {
    container: { backgroundColor: Colors.borderLight },
    text: { color: Colors.textSecondary },
  },
};

export default function Badge({ label, variant }: BadgeProps) {
  const style = variantStyles[variant];

  return (
    <View style={[styles.badge, style.container]}>
      <Text style={[styles.label, style.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
