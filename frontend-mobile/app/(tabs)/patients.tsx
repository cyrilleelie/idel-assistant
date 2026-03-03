/**
 * PatientsScreen — List of all patients for the logged-in nurse.
 *
 * Features:
 * - SearchBar for filtering by name/address (local, instant)
 * - FlatList of PatientCards sorted alphabetically
 * - Pull-to-refresh (placeholder for sync M4)
 * - Tap card → patient detail screen
 *
 * Data flow:
 *   useEffect (refreshKey)
 *     -> database.get('patients').query().fetch()
 *     -> buildPatientViews()
 *     -> all patients state
 *   useMemo (searchQuery + all patients)
 *     -> filtered + sorted patients
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { usePatientStore } from '@/stores/patientStore';
import { buildPatientViews } from '@/types/patient';
import type { PatientView } from '@/types/patient';
import PatientCard from '@/components/patient/PatientCard';
import EmptyState from '@/components/ui/EmptyState';
import { Colors } from '@/constants/colors';
import type Patient from '@/db/models/Patient';

export default function PatientsScreen() {
  const router = useRouter();
  const database = useDatabase();

  const searchQuery = usePatientStore((s) => s.searchQuery);
  const setSearchQuery = usePatientStore((s) => s.setSearchQuery);
  const refreshKey = usePatientStore((s) => s.refreshKey);

  const [allPatients, setAllPatients] = useState<PatientView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Fetch all patients ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    database
      .get<Patient>('patients')
      .query()
      .fetch()
      .then((raw) => {
        if (!cancelled) {
          setAllPatients(buildPatientViews(raw));
        }
      })
      .catch(() => {
        if (!cancelled) setAllPatients([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [database, refreshKey]);

  // ── Filter + sort ───────────────────────────────────────────────────────

  const filteredPatients = useMemo(() => {
    let list = allPatients;

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q),
      );
    }

    // Sort alphabetically by last name
    return [...list].sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));
  }, [allPatients, searchQuery]);

  // ── Callbacks ───────────────────────────────────────────────────────────

  const handlePress = useCallback(
    (patient: PatientView) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/patient/${patient.id}` as any);
    },
    [router],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // TODO (M4): wire up performSync(database, apiClient) when sync engine is available
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    setIsRefreshing(false);
  }, []);

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PatientView>) => (
      <PatientCard patient={item} onPress={handlePress} />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback((item: PatientView) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un patient..."
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
        <Text style={styles.countLabel}>
          {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
        </Text>
      </View>
    ),
    [searchQuery, setSearchQuery, filteredPatients.length],
  );

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    if (searchQuery.trim().length > 0) {
      return (
        <EmptyState
          icon="search-outline"
          title="Aucun resultat"
          message={`Aucun patient ne correspond a "${searchQuery}".`}
        />
      );
    }
    return (
      <EmptyState
        icon="people-outline"
        title="Aucun patient"
        message="Les patients apparaitront ici apres la synchronisation."
      />
    );
  }, [isLoading, searchQuery]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPatients}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        windowSize={7}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 12,
  },
  countLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 8,
    marginLeft: 4,
  },
});
