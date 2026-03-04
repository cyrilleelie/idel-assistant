/**
 * PreparationScreen — "Prepare My Day" tab.
 *
 * Shows tomorrow's patients with AI summaries of recent transmissions.
 * Patients with alerts are prioritized at the top. Transmissions can be
 * expanded inline. Works fully offline via WatermelonDB.
 *
 * Security: FLAG_SECURE active (medical summaries).
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuthStore } from '@/stores/authStore';
import { usePreparationStore } from '@/stores/preparationStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useScreenProtection } from '@/security/screenProtection';
import { getTodayString, addDays } from '@/utils/dateHelpers';
import type { PatientPreparation } from '@/services/preparationService';
import PreparationHeader from '@/components/preparation/PreparationHeader';
import PreparationCard from '@/components/preparation/PreparationCard';
import DailySynthesis from '@/components/preparation/DailySynthesis';
import DateSelector from '@/components/tournee/DateSelector';
import type { DaySelectorItem } from '@/components/tournee/DateSelector';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import SwipeDateContainer from '@/components/ui/SwipeDateContainer';
import { Colors } from '@/constants/colors';

export default function PreparationScreen() {
  const router = useRouter();
  const database = useDatabase();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const { isOnline } = useOnlineStatus();

  const {
    preparationDate,
    data,
    isLoading,
    isRefreshing,
    source,
    loadPreparation,
    refreshPreparation,
    setPreparationDate,
  } = usePreparationStore();

  // Screen protection — medical summaries
  useScreenProtection();

  // Set of expanded patient IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Load on mount and when date changes
  useEffect(() => {
    if (userId) {
      loadPreparation(database, userId, isOnline);
    }
  }, [preparationDate, userId, database, isOnline, loadPreparation]);

  // Date navigation
  const today = useMemo(() => getTodayString(), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);
  const dayAfterTomorrow = useMemo(() => addDays(today, 2), [today]);

  const handleSwipeLeft = useCallback(() => {
    if (preparationDate < dayAfterTomorrow) setPreparationDate(addDays(preparationDate, 1));
  }, [preparationDate, dayAfterTomorrow, setPreparationDate]);

  const handleSwipeRight = useCallback(() => {
    if (preparationDate > today) setPreparationDate(addDays(preparationDate, -1));
  }, [preparationDate, today, setPreparationDate]);

  const preparationDays: DaySelectorItem[] = useMemo(() => [
    { date: today, label: "Auj." },
    { date: tomorrow, label: 'Demain' },
    { date: dayAfterTomorrow, label: 'J+2' },
  ], [today, tomorrow, dayAfterTomorrow]);

  // Pull-to-refresh
  const handleRefresh = useCallback(() => {
    if (userId) {
      refreshPreparation(database, userId, isOnline);
    }
  }, [database, userId, isOnline, refreshPreparation]);

  // Toggle expand
  const toggleExpand = useCallback((patientId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  }, []);

  // Navigation
  const handlePressPatient = useCallback((patientId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/patient/${patientId}` as any);
  }, [router]);

  const handlePressAppointment = useCallback((appointmentId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/appointment/${appointmentId}` as any);
  }, [router]);

  const handleViewTransmission = useCallback((txId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/transmission/${txId}` as any);
  }, [router]);

  // Render item
  const renderItem = useCallback(({ item }: { item: PatientPreparation }) => (
    <PreparationCard
      preparation={item}
      isExpanded={expandedIds.has(item.patientId)}
      currentUserId={userId}
      onToggleExpand={() => toggleExpand(item.patientId)}
      onPressPatient={() => handlePressPatient(item.patientId)}
      onPressAppointment={() => handlePressAppointment(item.appointmentId)}
      onViewTransmission={handleViewTransmission}
    />
  ), [expandedIds, userId, toggleExpand, handlePressPatient, handlePressAppointment, handleViewTransmission]);

  const keyExtractor = useCallback((item: PatientPreparation) => item.patientId, []);

  // Loading state
  if (isLoading && !data) {
    return (
      <SwipeDateContainer onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight}>
        <View style={styles.container}>
          <DateSelector selectedDate={preparationDate} onDateChange={setPreparationDate} days={preparationDays} />
          <SkeletonLoader type="preparation-card" count={4} />
        </View>
      </SwipeDateContainer>
    );
  }

  // Empty state
  if (data && data.totalPatients === 0) {
    return (
      <SwipeDateContainer onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight}>
        <View style={styles.container}>
          <DateSelector selectedDate={preparationDate} onDateChange={setPreparationDate} days={preparationDays} />
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="moon-outline"
              title="Pas de RDV ce jour"
              message="Swipez pour changer de jour"
            />
          </View>
        </View>
      </SwipeDateContainer>
    );
  }

  return (
    <SwipeDateContainer onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight}>
      <View style={styles.container}>
        <DateSelector selectedDate={preparationDate} onDateChange={setPreparationDate} days={preparationDays} />

        <FlatList
          data={data?.patients ?? []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            data ? (
              <>
                <PreparationHeader
                  date={data.date}
                  totalPatients={data.totalPatients}
                  patientsWithNewInfo={data.patientsWithNewInfo}
                  source={source}
                />
                {data.totalPatients > 0 && (
                  <DailySynthesis data={data} />
                )}
              </>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </View>
    </SwipeDateContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 32,
  },
});
