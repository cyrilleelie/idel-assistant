import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { TextInput, Button, RadioButton, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useSlotSuggestion } from '../../src/hooks/useSlotSuggestion';
import { usePatients } from '../../src/hooks/usePatients';
import { SlotSuggestionCard } from '../../src/components/SlotSuggestionCard';
import { theme } from '../../src/utils/colors';
import { format } from 'date-fns';

const DURATIONS = [15, 20, 30, 45, 60];
const PREFERENCES = [
  { label: 'Peu importe', value: '' },
  { label: 'Matin', value: 'morning' },
  { label: 'Apres-midi', value: 'afternoon' },
];

export default function SuggestScreen() {
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [careType, setCareType] = useState('');
  const [duration, setDuration] = useState(30);
  const [locationType, setLocationType] = useState('home');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [preference, setPreference] = useState('');
  const [showPatientList, setShowPatientList] = useState(false);
  const [bookSuccess, setBookSuccess] = useState(false);

  const { data: patientsData } = usePatients(patientSearch.length >= 2 ? patientSearch : undefined);
  const {
    suggest,
    suggestions,
    isSuggesting,
    suggestError,
    bookAsync,
    isBooking,
    reset,
  } = useSlotSuggestion();

  const filteredPatients = useMemo(() => {
    return patientsData?.items || [];
  }, [patientsData]);

  function handleSearch() {
    if (!selectedPatientId) return;
    reset();
    suggest({
      patient_id: selectedPatientId,
      care_type: careType || 'soins_infirmiers',
      duration_minutes: duration,
      location_type: locationType,
      date,
      preferred_slot: preference,
    });
  }

  async function handleBook(startTime: string) {
    try {
      await bookAsync({
        patient_id: selectedPatientId,
        care_type: careType || 'soins_infirmiers',
        duration_minutes: duration,
        location_type: locationType,
        start_time: startTime,
        date,
      });
      setBookSuccess(true);
      reset();
    } catch {
      // Error is handled by bookError in useSlotSuggestion
    }
  }

  function selectPatient(id: string, name: string) {
    setSelectedPatientId(id);
    setSelectedPatientName(name);
    setPatientSearch(name);
    setShowPatientList(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient</Text>
          <TextInput
            label="Rechercher un patient"
            value={patientSearch}
            onChangeText={(text) => {
              setPatientSearch(text);
              setSelectedPatientId('');
              setSelectedPatientName('');
              setShowPatientList(text.length >= 2);
            }}
            mode="outlined"
            style={styles.input}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
            left={<TextInput.Icon icon="account-search" />}
          />
          {showPatientList && filteredPatients.length > 0 && (
            <View style={styles.dropdown}>
              {filteredPatients.slice(0, 5).map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.dropdownItem}
                  onPress={() =>
                    selectPatient(p.id, `${p.last_name.toUpperCase()} ${p.first_name}`)
                  }
                >
                  <Text style={styles.dropdownText}>
                    {p.last_name.toUpperCase()} {p.first_name}
                  </Text>
                  <Text style={styles.dropdownSub}>{p.city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type de soin</Text>
          <TextInput
            label="Ex: prise de sang, pansement..."
            value={careType}
            onChangeText={setCareType}
            mode="outlined"
            style={styles.input}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duree</Text>
          <View style={styles.chipRow}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, duration === d && styles.chipActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>
                  {d} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lieu</Text>
          <RadioButton.Group onValueChange={setLocationType} value={locationType}>
            <View style={styles.radioRow}>
              <RadioButton.Item label="Domicile" value="home" />
              <RadioButton.Item label="Cabinet" value="office" />
            </View>
          </RadioButton.Group>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date</Text>
          <TextInput
            label="AAAA-MM-JJ"
            value={date}
            onChangeText={setDate}
            mode="outlined"
            style={styles.input}
            outlineColor={theme.border}
            activeOutlineColor={theme.primary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preference horaire</Text>
          <View style={styles.chipRow}>
            {PREFERENCES.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.chip, preference === p.value && styles.chipActive]}
                onPress={() => setPreference(p.value)}
              >
                <Text style={[styles.chipText, preference === p.value && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button
          mode="contained"
          onPress={handleSearch}
          loading={isSuggesting}
          disabled={isSuggesting || !selectedPatientId}
          style={styles.searchButton}
          buttonColor={theme.primary}
          icon="magnify"
        >
          Trouver un creneau
        </Button>

        {isSuggesting && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.loadingText}>Recherche des meilleurs creneaux...</Text>
          </View>
        )}

        {suggestError && (
          <Text style={styles.errorText}>
            Une erreur est survenue. Verifiez votre connexion.
          </Text>
        )}

        {suggestions && suggestions.suggestions.length > 0 && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>
              {suggestions.suggestions.length} creneau(x) propose(s)
            </Text>
            {suggestions.day_summary && (
              <Text style={styles.summaryText}>
                {suggestions.day_summary.num_appointments} RDV ce jour
                {suggestions.day_summary.first_appointment
                  ? ` (${suggestions.day_summary.first_appointment} - ${suggestions.day_summary.last_appointment})`
                  : ''}
              </Text>
            )}
            {suggestions.suggestions.map((s) => (
              <SlotSuggestionCard
                key={s.rank}
                suggestion={s}
                onBook={() => handleBook(s.start_time)}
                isBooking={isBooking}
              />
            ))}
          </View>
        )}

        {suggestions && suggestions.suggestions.length === 0 && (
          <View style={styles.emptyResults}>
            <Text style={styles.emptyText}>Aucun creneau disponible</Text>
            <Text style={styles.emptySubtext}>
              Essayez une autre date ou modifiez les criteres
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Snackbar
        visible={bookSuccess}
        onDismiss={() => setBookSuccess(false)}
        duration={4000}
        style={styles.snackbar}
        action={{ label: 'OK', onPress: () => setBookSuccess(false) }}
      >
        Rendez-vous reserve avec succes !
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.surface,
  },
  dropdown: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    marginTop: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 14,
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  dropdownSub: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  radioRow: {
    flexDirection: 'row',
  },
  searchButton: {
    borderRadius: 8,
    paddingVertical: 4,
    marginTop: 8,
    marginBottom: 16,
  },
  loadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  loadingText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  errorText: {
    color: theme.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  results: {
    marginTop: 8,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  emptyResults: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  snackbar: {
    backgroundColor: theme.success,
  },
});
