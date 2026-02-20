import React, { useState } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  TextInput,
  Button,
  HelperText,
  Chip,
  Snackbar,
  Text,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useCreatePatient } from '../../../src/hooks/usePatients';
import { theme } from '../../../src/utils/colors';

const DURATIONS = [15, 20, 30, 45, 60];
const TIME_SLOTS = [
  { label: 'Matin', value: 'morning' },
  { label: 'Apres-midi', value: 'afternoon' },
  { label: 'Indifferent', value: '' },
];

export default function CreatePatientScreen() {
  const router = useRouter();
  const createMutation = useCreatePatient();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState(30);
  const [timeSlot, setTimeSlot] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const errors = {
    lastName: submitted && lastName.trim().length === 0,
    firstName: submitted && firstName.trim().length === 0,
    address: submitted && address.trim().length === 0,
    postalCode: submitted && postalCode.trim().length === 0,
    city: submitted && city.trim().length === 0,
  };

  async function handleSubmit() {
    setSubmitted(true);
    setErrorMessage('');

    if (
      !lastName.trim() ||
      !firstName.trim() ||
      !address.trim() ||
      !postalCode.trim() ||
      !city.trim()
    ) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        birth_date: birthDate.trim() || undefined,
        address: address.trim(),
        postal_code: postalCode.trim(),
        city: city.trim(),
        phone: phone.trim(),
        email: email.trim(),
        notes: notes.trim(),
        care_duration_default: duration,
        preferred_time_slot: timeSlot,
      });
      setSnackVisible(true);
      setTimeout(() => router.back(), 1200);
    } catch {
      setErrorMessage('Impossible de creer le patient. Verifiez votre connexion.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TextInput
          label="Nom *"
          mode="outlined"
          value={lastName}
          onChangeText={setLastName}
          error={errors.lastName}
          style={styles.input}
        />
        <HelperText type="error" visible={errors.lastName}>
          Le nom est requis
        </HelperText>

        <TextInput
          label="Prenom *"
          mode="outlined"
          value={firstName}
          onChangeText={setFirstName}
          error={errors.firstName}
          style={styles.input}
        />
        <HelperText type="error" visible={errors.firstName}>
          Le prenom est requis
        </HelperText>

        <TextInput
          label="Date de naissance (AAAA-MM-JJ)"
          mode="outlined"
          value={birthDate}
          onChangeText={setBirthDate}
          style={styles.input}
        />

        <TextInput
          label="Adresse *"
          mode="outlined"
          value={address}
          onChangeText={setAddress}
          error={errors.address}
          style={styles.input}
        />
        <HelperText type="error" visible={errors.address}>
          L'adresse est requise
        </HelperText>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <TextInput
              label="Code postal *"
              mode="outlined"
              value={postalCode}
              onChangeText={setPostalCode}
              error={errors.postalCode}
              keyboardType="numeric"
            />
            <HelperText type="error" visible={errors.postalCode}>
              Requis
            </HelperText>
          </View>
          <View style={styles.halfInput}>
            <TextInput
              label="Ville *"
              mode="outlined"
              value={city}
              onChangeText={setCity}
              error={errors.city}
            />
            <HelperText type="error" visible={errors.city}>
              Requis
            </HelperText>
          </View>
        </View>

        <TextInput
          label="Telephone"
          mode="outlined"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <TextInput
          label="Email"
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={styles.sectionLabel}>Duree du soin par defaut</Text>
        <View style={styles.chipRow}>
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              selected={duration === d}
              onPress={() => setDuration(d)}
              style={styles.chip}
              selectedColor={theme.primary}
            >
              {d} min
            </Chip>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Preference horaire</Text>
        <View style={styles.chipRow}>
          {TIME_SLOTS.map((slot) => (
            <Chip
              key={slot.value}
              selected={timeSlot === slot.value}
              onPress={() => setTimeSlot(slot.value)}
              style={styles.chip}
              selectedColor={theme.primary}
            >
              {slot.label}
            </Chip>
          ))}
        </View>

        <TextInput
          label="Notes"
          mode="outlined"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        {errorMessage !== '' && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={createMutation.isPending}
          disabled={createMutation.isPending}
          style={styles.submitButton}
          buttonColor={theme.primary}
        >
          Enregistrer
        </Button>
      </ScrollView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={1200}
      >
        Patient cree avec succes
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  input: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    marginBottom: 4,
  },
  errorText: {
    color: theme.error,
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 8,
  },
});
