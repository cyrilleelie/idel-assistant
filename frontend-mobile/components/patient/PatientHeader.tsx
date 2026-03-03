/**
 * PatientHeader — Full header for the patient detail screen.
 *
 * Shows avatar, name, age, status badge, ALD/BSI badges,
 * and action buttons (call, navigate, email).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import type { PatientView } from '@/types/patient';
import { formatPatientAge } from '@/types/patient';

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

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {patient.firstName.charAt(0).toUpperCase()}
          {patient.lastName.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Name + age */}
      <Text style={styles.name}>{patient.displayName}</Text>
      {age != null && <Text style={styles.age}>{age}</Text>}

      {/* Badges */}
      {(patient.isAld || patient.hasActiveBsi) && (
        <View style={styles.badges}>
          {patient.isAld && <Badge label="ALD" variant="warning" />}
          {patient.hasActiveBsi && patient.bsiLevel != null && (
            <Badge label={patient.bsiLevel} variant="info" />
          )}
        </View>
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
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  name: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  age: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
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
