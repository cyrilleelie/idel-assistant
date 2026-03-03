/**
 * PatientInfoSection — Collapsible section showing patient details.
 *
 * Displays address, phone, email, birth date, notes, and BSI info
 * in a clean card layout.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { PatientView } from '@/types/patient';
import { formatPatientAge } from '@/types/patient';
import { formatDateFrench } from '@/utils/dateHelpers';

interface PatientInfoSectionProps {
  patient: PatientView;
  onAddressPress: () => void;
  onPhonePress: () => void;
  onEmailPress: () => void;
}

export default function PatientInfoSection({
  patient,
  onAddressPress,
  onPhonePress,
  onEmailPress,
}: PatientInfoSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const age = formatPatientAge(patient.birthDate);

  return (
    <View style={styles.container}>
      {/* Section header */}
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={styles.header}
        accessibilityRole="button"
      >
        <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.headerTitle}>Informations</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textTertiary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.content}>
          {/* Address */}
          <InfoRow
            icon="location-outline"
            label="Adresse"
            value={patient.address}
            onPress={onAddressPress}
          />

          {/* Phone */}
          {patient.phone != null ? (
            <InfoRow
              icon="call-outline"
              label="Telephone"
              value={patient.phone}
              onPress={onPhonePress}
            />
          ) : (
            <InfoRow
              icon="call-outline"
              label="Telephone"
              value="Non renseigne"
              muted
            />
          )}

          {/* Email */}
          {patient.email != null ? (
            <InfoRow
              icon="mail-outline"
              label="Email"
              value={patient.email}
              onPress={onEmailPress}
            />
          ) : (
            <InfoRow
              icon="mail-outline"
              label="Email"
              value="Non renseigne"
              muted
            />
          )}

          {/* Birth date + age */}
          {patient.birthDate != null && (
            <InfoRow
              icon="calendar-outline"
              label="Date de naissance"
              value={`${formatDateFrench(patient.birthDate)}${age ? ` (${age})` : ''}`}
            />
          )}

          {/* BSI info */}
          {patient.hasActiveBsi && patient.bsiLevel != null && (
            <InfoRow
              icon="medkit-outline"
              label="BSI"
              value={`${patient.bsiLevel}${patient.bsiEndDate ? ` — expire le ${formatDateFrench(patient.bsiEndDate)}` : ''}`}
            />
          )}

          {/* Notes */}
          {patient.notes != null && patient.notes.length > 0 && (
            <View style={styles.notesContainer}>
              <View style={styles.notesHeader}>
                <Ionicons name="create-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.notesLabel}>Notes</Text>
              </View>
              <Text style={styles.notesText}>{patient.notes}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress?: () => void;
  muted?: boolean;
}

function InfoRow({ icon, label, value, onPress, muted }: InfoRowProps) {
  const content = (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon}
        size={16}
        color={Colors.textSecondary}
        style={styles.infoIcon}
      />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={[styles.infoValue, muted && styles.infoValueMuted]}
          numberOfLines={3}
        >
          {value}
        </Text>
      </View>
      {onPress != null && (
        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
      )}
    </View>
  );

  if (onPress != null) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && styles.rowPressed}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoIcon: {
    marginRight: 10,
    width: 20,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  infoValueMuted: {
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  rowPressed: {
    backgroundColor: Colors.borderLight,
  },
  notesContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
