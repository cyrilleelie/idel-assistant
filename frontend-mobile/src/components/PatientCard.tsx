import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '../utils/colors';
import type { Patient } from '../types/models';

interface PatientCardProps {
  patient: Patient;
  onPress: () => void;
}

export function PatientCard({ patient, onPress }: PatientCardProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <FontAwesome name="user" size={20} color={theme.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>
          {patient.last_name.toUpperCase()} {patient.first_name}
        </Text>
        <Text style={styles.info}>
          {patient.city || patient.postal_code || 'Adresse non renseignee'}
        </Text>
        {patient.pathologies.length > 0 && (
          <Text style={styles.pathologies} numberOfLines={1}>
            {patient.pathologies.join(', ')}
          </Text>
        )}
      </View>
      <FontAwesome name="chevron-right" size={14} color={theme.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  info: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  pathologies: {
    fontSize: 11,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
});
