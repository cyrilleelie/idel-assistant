/**
 * PatientCard — Redesigned card for the patients FlatList.
 *
 * Displays:
 * - Circular avatar with initials (alternating colored backgrounds)
 * - Patient name (UPPERCASE last name), location, last care date
 * - Chevron right
 *
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

// Avatar background colors that cycle based on patient name hash
const AVATAR_COLORS = [
  { bg: '#EDEDFE', text: Colors.primary },     // primary/20
  { bg: '#D1FAE5', text: '#059669' },           // emerald/100
  { bg: '#FEF3C7', text: '#D97706' },           // amber/100
];

function getAvatarColor(patient: PatientView) {
  // Simple hash from first + last name to get consistent color per patient
  const str = `${patient.firstName}${patient.lastName}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function extractPostalCode(address: string): string {
  // Try to extract a French postal code (5 digits) from the address
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}

function PatientCardInner({ patient, onPress }: PatientCardProps) {
  const avatarColor = getAvatarColor(patient);
  const postalCode = extractPostalCode(patient.address);
  const initials = `${patient.firstName.charAt(0).toUpperCase()}${patient.lastName.charAt(0).toUpperCase()}`;

  // Build display name: "Firstname LASTNAME"
  const displayName = `${patient.firstName} ${patient.lastName.toUpperCase()}`;

  // Build location line
  const locationParts: string[] = [];
  if (patient.address) {
    // Extract city name (usually after postal code or last part of address)
    const parts = patient.address.split(',').map((s) => s.trim());
    const cityPart = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    locationParts.push(cityPart);
  }
  if (postalCode && !locationParts[0]?.includes(postalCode)) {
    locationParts.push(postalCode);
  }
  const locationText = locationParts.join(' ') || patient.address;

  return (
    <Pressable
      onPress={() => onPress(patient)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Fiche de ${patient.displayName}`}
    >
      {/* Avatar circle */}
      <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
        <Text style={[styles.avatarText, { color: avatarColor.text }]}>
          {initials}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationText}
          </Text>
        </View>
        <Text style={styles.lastCare} numberOfLines={1}>
          Dernier soin : --
        </Text>
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
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
  },
  pressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 13,
    color: Colors.textTertiary,
    flex: 1,
  },
  lastCare: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
});
