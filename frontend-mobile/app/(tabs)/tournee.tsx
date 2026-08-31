/**
 * TourneeScreen — Main daily round screen.
 *
 * Shows the nurse's appointments for the selected day with:
 * - DateSelector (horizontal scrollable pills): switch between dates
 * - TourneeProgress: card-based progress with percentage and time remaining
 * - "PLANNING DU JOUR" section label
 * - FlatList of AppointmentCards
 * - ConfirmationModal: shown before marking an appointment as completed
 *
 * Data flow:
 *   useEffect (selectedDate + userId + refreshKey)
 *     -> database.query().fetch()
 *     -> buildAppointmentViews()
 *     -> appointmentViews state
 *     -> computeTourneeStats()
 *
 * The refreshKey from tourneeStore is bumped after every local write
 * (markAsCompleted, undoCompletion) to force a re-fetch. This replaces the
 * WatermelonDB observable pattern which doesn't fire change notifications
 * with the LokiJS in-memory adapter (Expo Go).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  LayoutAnimation,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTourneeStore } from '@/stores/tourneeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { getTodayString, addDays } from '@/utils/dateHelpers';
import { buildAppointmentViews, computeTourneeStats } from '@/types/appointment';
import type { AppointmentView } from '@/types/appointment';
import { openNavigation } from '@/services/navigationService';
import AppointmentCard from '@/components/tournee/AppointmentCard';
import DateSelector from '@/components/tournee/DateSelector';
import TourneeProgress from '@/components/tournee/TourneeProgress';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import SwipeDateContainer from '@/components/ui/SwipeDateContainer';
import { Colors } from '@/constants/colors';
import type Appointment from '@/db/models/Appointment';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TourneeScreen() {
  const router = useRouter();
  const database = useDatabase();
  const userId = useAuthStore((s) => s.user?.id);
  const gpsAppPreference = useSettingsStore((s) => s.gpsAppPreference);

  const selectedDate = useTourneeStore((s) => s.selectedDate);
  const isMarkingComplete = useTourneeStore((s) => s.isMarkingComplete);
  const refreshKey = useTourneeStore((s) => s.refreshKey);
  const tourneeError = useTourneeStore((s) => s.error);
  const clearError = useTourneeStore((s) => s.clearError);
  const setSelectedDate = useTourneeStore((s) => s.setSelectedDate);
  const markAsCompleted = useTourneeStore((s) => s.markAsCompleted);

  // -- Dev seed (only in __DEV__, needs userId) ----------------------------

  const bumpRefreshKey = useTourneeStore((s) => s.bumpRefreshKey);

  useEffect(() => {
    if (!userId) return;

    // Try sync first; if backend is unreachable, fall back to dev seed
    import('@/services/syncService')
      .then(({ trySyncOrSeed }) => trySyncOrSeed(database, userId))
      .then(() => {
        bumpRefreshKey();
      })
      .catch(() => {
        // Non-critical
      });
  }, [database, userId, bumpRefreshKey]);

  // -- View state ----------------------------------------------------------

  const [appointmentViews, setAppointmentViews] = useState<AppointmentView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // -- Confirmation modal state --------------------------------------------

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAppointment, setPendingAppointment] = useState<AppointmentView | null>(null);

  // -- Fetch appointments (manual query -- LokiJS doesn't fire observables)

  useEffect(() => {
    if (!userId) {
      setAppointmentViews([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    database
      .get<Appointment>('appointments')
      .query(Q.and(
        Q.where('date', selectedDate),
        Q.where('user_id', userId),
        Q.where('status', Q.notEq('canceled')),
      ))
      .fetch()
      .then((raw) => {
        if (cancelled) return;
        return buildAppointmentViews(raw, database);
      })
      .then((views) => {
        if (!cancelled && views) {
          setAppointmentViews(views);
        }
      })
      .catch(() => {
        if (!cancelled) setAppointmentViews([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // refreshKey is bumped by tourneeStore after every local write,
    // which triggers a re-fetch here.
  }, [database, selectedDate, userId, refreshKey]);

  // -- Stats ---------------------------------------------------------------

  const stats = useMemo(() => computeTourneeStats(appointmentViews), [appointmentViews]);

  // -- Swipe boundaries (Hier / Auj. / Demain) ----------------------------

  const today = useMemo(() => getTodayString(), []);
  const minDate = useMemo(() => addDays(today, -1), [today]);
  const maxDate = useMemo(() => addDays(today, 1), [today]);

  const handleSwipeLeft = useCallback(() => {
    if (selectedDate < maxDate) setSelectedDate(addDays(selectedDate, 1));
  }, [selectedDate, maxDate, setSelectedDate]);

  const handleSwipeRight = useCallback(() => {
    if (selectedDate > minDate) setSelectedDate(addDays(selectedDate, -1));
  }, [selectedDate, minDate, setSelectedDate]);

  // -- Callbacks -----------------------------------------------------------

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
    },
    [setSelectedDate],
  );

  const handlePress = useCallback(
    (appt: AppointmentView) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/appointment/${appt.id}` as any);
    },
    [router],
  );

  const handleNavigate = useCallback(
    (appt: AppointmentView) => {
      openNavigation({
        lat: appt.patient.lat,
        lon: appt.patient.lon,
        address: appt.patient.address,
        preference: gpsAppPreference,
      });
    },
    [gpsAppPreference],
  );

  const handleMarkComplete = useCallback((appt: AppointmentView) => {
    setPendingAppointment(appt);
    setShowConfirmModal(true);
  }, []);

  const handleConfirmComplete = useCallback(async () => {
    if (!pendingAppointment) return;
    setShowConfirmModal(false);
    // Animate the list transition when a card changes to completed state
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await markAsCompleted(
      pendingAppointment.id,
      pendingAppointment.serverId,
      database,
      userId ?? '',
    );
    setPendingAppointment(null);
  }, [pendingAppointment, markAsCompleted, database, userId]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmModal(false);
    setPendingAppointment(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { performSync } = await import('@/db/sync');
      const { api } = await import('@/services/api');
      await performSync(database, api);
      bumpRefreshKey();
    } catch {
      // Sync failure is non-blocking -- the local data is still displayed
    }
    setIsRefreshing(false);
  }, [database, bumpRefreshKey]);

  // -- Render helpers ------------------------------------------------------

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AppointmentView>) => (
      <AppointmentCard
        appointment={item}
        onPress={handlePress}
        onMarkComplete={handleMarkComplete}
        onNavigate={handleNavigate}
        isMarkingComplete={isMarkingComplete === item.id}
      />
    ),
    [handlePress, handleMarkComplete, handleNavigate, isMarkingComplete],
  );

  const keyExtractor = useCallback((item: AppointmentView) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <>
        <DateSelector selectedDate={selectedDate} onDateChange={handleDateChange} />
        <TourneeProgress stats={stats} />

        {/* Section label */}
        {appointmentViews.length > 0 && (
          <Text style={styles.sectionLabel}>PLANNING DU JOUR</Text>
        )}
      </>
    ),
    [selectedDate, handleDateChange, stats, appointmentViews.length],
  );

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) {
      return <SkeletonLoader type="appointment-card" count={5} />;
    }
    return (
      <EmptyState
        icon="calendar-outline"
        title="Pas de RDV ce jour"
        message="Swipez pour changer de jour"
      />
    );
  }, [isLoading]);

  // -- Render --------------------------------------------------------------

  return (
    <SwipeDateContainer onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight}>
      <View style={styles.container}>
        {/* Error banner -- shown when a write operation fails */}
        {tourneeError != null && (
          <Pressable onPress={clearError} style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{tourneeError}</Text>
            <Text style={styles.errorDismiss}>Fermer</Text>
          </Pressable>
        )}

        <FlatList
          data={appointmentViews}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          windowSize={5}
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

        <ConfirmationModal
          visible={showConfirmModal}
          title="Marquer comme realise"
          message={
            pendingAppointment != null
              ? `Confirmer la realisation du rendez-vous avec ${pendingAppointment.patient.displayName} ?`
              : 'Confirmer la realisation de ce rendez-vous ?'
          }
          confirmLabel="Marquer realise"
          cancelLabel="Annuler"
          onConfirm={handleConfirmComplete}
          onCancel={handleCancelConfirm}
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
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  errorBanner: {
    backgroundColor: Colors.danger,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  errorDismiss: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
    opacity: 0.85,
  },
});
