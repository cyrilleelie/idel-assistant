import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { usePatient, usePatientAppointments } from '../../../src/hooks/usePatients';
import { SectorBadge } from '../../../src/components/SectorBadge';
import { theme } from '../../../src/utils/colors';
import { formatDate, formatTime, formatDateShort } from '../../../src/utils/formatters';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: patient, isLoading } = usePatient(id!);
  const { data: appointments } = usePatientAppointments(id!);

  if (isLoading || !patient) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  function handleCall() {
    if (patient?.phone) {
      Linking.openURL(`tel:${patient.phone}`);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <FontAwesome name="user" size={32} color={theme.primary} />
        </View>
        <Text style={styles.name}>
          {patient.last_name.toUpperCase()} {patient.first_name}
        </Text>
        {patient.birth_date && (
          <Text style={styles.birthDate}>Ne(e) le {formatDate(patient.birth_date)}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coordonnees</Text>
        <InfoRow icon="map-marker" value={patient.address || 'Non renseignee'} />
        <InfoRow icon="building" value={`${patient.postal_code} ${patient.city}`} />
        {patient.phone ? (
          <TouchableOpacity onPress={handleCall}>
            <InfoRow icon="phone" value={patient.phone} isLink />
          </TouchableOpacity>
        ) : null}
        {patient.email ? <InfoRow icon="envelope" value={patient.email} /> : null}
      </View>

      {patient.sector_id && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Secteur</Text>
          <SectorBadge name="Secteur assigne" color={theme.primary} />
        </View>
      )}

      {patient.pathologies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pathologies</Text>
          <View style={styles.tags}>
            {patient.pathologies.map((p, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations soins</Text>
        <InfoRow icon="clock-o" value={`Duree par defaut: ${patient.care_duration_default} min`} />
        {patient.preferred_time_slot ? (
          <InfoRow
            icon="sun-o"
            value={`Preference: ${patient.preferred_time_slot === 'morning' ? 'Matin' : patient.preferred_time_slot === 'afternoon' ? 'Apres-midi' : patient.preferred_time_slot}`}
          />
        ) : null}
      </View>

      {appointments && appointments.items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prochains rendez-vous</Text>
          {appointments.items.map((appt) => (
            <View key={appt.id} style={styles.apptRow}>
              <Text style={styles.apptDate}>{formatDateShort(appt.scheduled_at)}</Text>
              <Text style={styles.apptTime}>{formatTime(appt.scheduled_at)}</Text>
              <Text style={styles.apptType}>{appt.care_type}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      appt.status === 'scheduled'
                        ? theme.primary + '20'
                        : appt.status === 'completed'
                          ? theme.success + '20'
                          : theme.error + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        appt.status === 'scheduled'
                          ? theme.primary
                          : appt.status === 'completed'
                            ? theme.success
                            : theme.error,
                    },
                  ]}
                >
                  {appt.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Button
        mode="contained"
        icon="calendar-plus"
        style={styles.newApptButton}
        buttonColor={theme.primary}
        onPress={() => {
          // TODO: navigate to suggestion pre-filled with this patient
        }}
      >
        Nouveau rendez-vous
      </Button>

      {patient.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{patient.notes}</Text>
        </View>
      ) : null}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function InfoRow({
  icon,
  value,
  isLink = false,
}: {
  icon: string;
  value: string;
  isLink?: boolean;
}) {
  return (
    <View style={infoStyles.row}>
      <FontAwesome name={icon as any} size={14} color={theme.textSecondary} style={infoStyles.icon} />
      <Text style={[infoStyles.value, isLink && infoStyles.link]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  icon: {
    width: 20,
    textAlign: 'center',
    marginRight: 10,
  },
  value: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
  },
  link: {
    color: theme.primary,
    textDecorationLine: 'underline',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  birthDate: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  section: {
    padding: 16,
    backgroundColor: theme.surface,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: theme.primaryLight + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '500',
  },
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  apptDate: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    width: 80,
  },
  apptTime: {
    fontSize: 13,
    color: theme.textSecondary,
    width: 45,
  },
  apptType: {
    flex: 1,
    fontSize: 13,
    color: theme.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  newApptButton: {
    margin: 16,
    borderRadius: 8,
  },
  notes: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },
});
