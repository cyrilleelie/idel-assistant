/**
 * PatientCard — Compact card for the patients FlatList.
 *
 * Displays name (LASTNAME Firstname), address, and ALD/BSI badges.
 * React.memo for FlatList performance.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import type { PatientView } from '@/types/patient';

interface PatientCardProps {
  patient: PatientView;
  onPress: (patient: PatientView) => void;
}

function PatientCardInner({ patient, onPress }: PatientCardProps) {
  return (
    <Pressable
      onPress={() => onPress(patient)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Fiche de ${patient.displayName}`}
    >
      {/* Avatar circle */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {patient.firstName.charAt(0).toUpperCase()}
          {patient.lastName.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {patient.displayName}
        </Text>
        <View style={styles.addressRow}>
          <Ionicons
            name="location-outline"
            size={13}
            color={Colors.textTertiary}
          />
          <Text style={styles.address} numberOfLines={1}>
            {patient.address}
          </Text>
        </View>
        {(patient.isAld || patient.hasActiveBsi) && (
          <View style={styles.badges}>
            {patient.isAld && <Badge label="ALD" variant="warning" />}
            {patient.hasActiveBsi && patient.bsiLevel != null && (
              <Badge label={patient.bsiLevel} variant="info" />
            )}
          </View>
        )}
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

const PatientCard = React.memo(PatientCardInner);
export default PatientCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  pressed: {
    opacity: 0.92,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
});
