import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Searchbar, ActivityIndicator, FAB, Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { usePatients } from '../../../src/hooks/usePatients';
import { PatientCard } from '../../../src/components/PatientCard';
import { theme } from '../../../src/utils/colors';
import { useDebouncedValue } from '../../../src/hooks/useDebouncedValue';

export default function PatientsListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isError, refetch } = usePatients(
    debouncedSearch.length >= 2 ? debouncedSearch : undefined
  );

  const patients = data?.items || [];

  const handlePatientPress = useCallback(
    (id: string) => {
      router.push(`/patients/${id}` as any);
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Rechercher un patient..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Impossible de charger les patients</Text>
          <Button mode="contained" onPress={() => refetch()} style={{ marginTop: 12 }} buttonColor={theme.primary}>
            Reessayer
          </Button>
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PatientCard patient={item} onPress={() => handlePatientPress(item.id)} />
          )}
          refreshing={false}
          onRefresh={() => refetch()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {search.length >= 2 ? 'Aucun patient trouve' : 'Aucun patient enregistre'}
              </Text>
            </View>
          }
          contentContainerStyle={patients.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        color="#FFFFFF"
        onPress={() => {
          // TODO: modal creation patient
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  searchbar: {
    margin: 12,
    borderRadius: 10,
    elevation: 2,
  },
  searchInput: {
    fontSize: 15,
  },
  errorText: {
    fontSize: 16,
    color: theme.error,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: theme.primary,
    borderRadius: 28,
  },
});
