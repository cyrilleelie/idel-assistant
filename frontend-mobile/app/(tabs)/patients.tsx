/**
 * PatientsScreen — List of all patients for the logged-in nurse.
 *
 * Features:
 * - Header with icon + title + menu
 * - SearchBar for filtering by name/address (local, instant)
 * - Filter pills: Tous / Actifs / Inactifs
 * - FlatList of PatientCards sorted alphabetically
 * - Pull-to-refresh (sync)
 * - Tap card -> patient detail screen
 *
 * Data flow:
 *   useEffect (refreshKey)
 *     -> database.get('patients').query().fetch()
 *     -> buildPatientViews()
 *     -> all patients state
 *   useMemo (searchQuery + statusFilter + all patients)
 *     -> filtered + sorted patients
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  Pressable,
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
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { Colors } from '@/constants/colors';
import type Patient from '@/db/models/Patient';

type StatusFilter = 'all' | 'active' | 'inactive';

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'inactive', label: 'Inactifs' },
];

export default function PatientsScreen() {
  const router = useRouter();
  const database = useDatabase();

  const searchQuery = usePatientStore((s) => s.searchQuery);
  const setSearchQuery = usePatientStore((s) => s.setSearchQuery);
  const refreshKey = usePatientStore((s) => s.refreshKey);

  const [allPatients, setAllPatients] = useState<PatientView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // -- Fetch all patients ----------------------------------------------------

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

  // -- Filter + sort ---------------------------------------------------------

  const filteredPatients = useMemo(() => {
    let list = allPatients;

    // Status filter
    if (statusFilter === 'active') {
      list = list.filter((p) => p.status === 'active');
    } else if (statusFilter === 'inactive') {
      list = list.filter((p) => p.status !== 'active');
    }

    // Search filter
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
  }, [allPatients, searchQuery, statusFilter]);

  // -- Callbacks -------------------------------------------------------------

  const handlePress = useCallback(
    (patient: PatientView) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/patient/${patient.id}` as any);
    },
    [router],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { performSync } = await import('@/db/sync');
      const { api } = await import('@/services/api');
      await performSync(database, api);
    } catch {
      // Sync failure is non-blocking
    }
    setIsRefreshing(false);
  }, [database]);

  // -- Render helpers --------------------------------------------------------

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PatientView>) => (
      <PatientCard patient={item} onPress={handlePress} />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback((item: PatientView) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <View style={styles.headerArea}>
        {/* Top row: icon + title + menu */}
        <View style={styles.topRow}>
          <View style={styles.titleIconContainer}>
            <View style={styles.titleIcon}>
              <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Patients</Text>
          </View>
          <Pressable
            style={styles.menuButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Menu"
          >
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.text} />
          </Pressable>
        </View>

        {/* Search bar */}
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

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => {
            const isActive = statusFilter === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setStatusFilter(option.key)}
                style={[
                  styles.filterPill,
                  isActive ? styles.filterPillActive : styles.filterPillInactive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isActive ? styles.filterPillTextActive : styles.filterPillTextInactive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Count label */}
        <Text style={styles.countLabel}>
          {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
        </Text>
      </View>
    ),
    [searchQuery, setSearchQuery, filteredPatients.length, statusFilter],
  );

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) {
      return <SkeletonLoader type="patient-card" count={5} />;
    }
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
        title="Aucun patient synchronise"
        message="Les patients apparaitront ici apres la synchronisation."
      />
    );
  }, [isLoading, searchQuery]);

  // -- Render ----------------------------------------------------------------

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

  // Header area
  headerArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 12,
  },

  // Filter pills
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
  },
  filterPillInactive: {
    backgroundColor: '#E2E8F0',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: Colors.white,
  },
  filterPillTextInactive: {
    color: '#334155',
  },

  // Count label
  countLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
});
