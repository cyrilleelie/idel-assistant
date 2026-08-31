/**
 * PatientHeader — Redesigned header for the patient detail screen.
 *
 * Shows:
 * - Large avatar (80x80) with initials
 * - Patient name (large bold)
 * - Status badge ("ACTIF" green or "INACTIF" gray) next to name
 * - Birth date + age below
 * - ID number (serverId) below
 * - Action buttons row
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { PatientView } from '@/types/patient';
import { formatPatientAge } from '@/types/patient';
import { formatDateFrench } from '@/utils/dateHelpers';

interface PatientHeaderProps {
  patient: PatientView;
  onCall: () => void;
  onNavigate: () => void;
  onEmail: () => void;
}

export default function PatientHeader({
  patient,
  onCall,
  onNavigate,
  onEmail,
}: PatientHeaderProps) {
  const age = formatPatientAge(patient.birthDate);
  const isActive = patient.status === 'active';
  const initials = `${patient.firstName.charAt(0).toUpperCase()}${patient.lastName.charAt(0).toUpperCase()}`;

  return (
    <View style={styles.container}>
      {/* Large avatar */}
      <View style={styles.avatarOuter}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      {/* Name + status badge */}
      <View style={styles.nameRow}>
        <Text style={styles.name}>{patient.displayName}</Text>
        <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
          <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
            {isActive ? 'ACTIF' : 'INACTIF'}
          </Text>
        </View>
      </View>

      {/* Birth date + age */}
      {patient.birthDate != null && (
        <Text style={styles.birthDate}>
          {formatDateFrench(patient.birthDate)}{age ? ` - ${age}` : ''}
        </Text>
      )}

      {/* ID number */}
      {patient.serverId != null && patient.serverId.length > 0 && (
        <Text style={styles.idNumber}>ID: {patient.serverId.substring(0, 8).toUpperCase()}</Text>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {patient.phone != null && (
          <ActionButton
            icon="call-outline"
            label="Appeler"
            onPress={onCall}
          />
        )}
        <ActionButton
          icon="navigate-outline"
          label="Y aller"
          onPress={onNavigate}
        />
        {patient.email != null && (
          <ActionButton
            icon="mail-outline"
            label="Email"
            onPress={onEmail}
          />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}

function ActionButton({ icon, label, onPress }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  // Avatar
  avatarOuter: {
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Name + status
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: '#16A34A',
  },
  statusTextInactive: {
    color: '#94A3B8',
  },

  // Birth date + ID
  birthDate: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  idNumber: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.primaryUltraLight,
    minWidth: 72,
  },
  actionBtnPressed: {
    opacity: 0.8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
