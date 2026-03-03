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
import { FlatList, View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuthStore } from '@/stores/authStore';
import { usePreparationStore } from '@/stores/preparationStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useScreenProtection } from '@/security/screenProtection';
import { getTodayString, addDays, getRelativeDayLabel } from '@/utils/dateHelpers';
import type { PatientPreparation } from '@/services/preparationService';
import PreparationHeader from '@/components/preparation/PreparationHeader';
import PreparationCard from '@/components/preparation/PreparationCard';
import DailySynthesis from '@/components/preparation/DailySynthesis';
import EmptyState from '@/components/ui/EmptyState';
import LoadingScreen from '@/components/ui/LoadingScreen';
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

  const isToday = preparationDate === today;
  const isTomorrow = preparationDate === tomorrow;

  const handleDateToggle = useCallback(() => {
    if (isTomorrow) {
      setPreparationDate(today);
    } else {
      setPreparationDate(tomorrow);
    }
  }, [isTomorrow, today, tomorrow, setPreparationDate]);

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
    return <LoadingScreen message="Preparation de votre journee..." />;
  }

  // Empty state
  if (data && data.totalPatients === 0) {
    const relativeLabel = getRelativeDayLabel(preparationDate);
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="moon-outline"
          title={`Pas de RDV ${relativeLabel?.toLowerCase() ?? 'ce jour'}`}
          message="Profitez de votre soiree"
          actionLabel={isToday ? 'Voir demain' : 'Voir aujourd\'hui'}
          onAction={handleDateToggle}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Date toggle pills */}
      <View style={styles.dateToggle}>
        <DatePill
          label="Aujourd'hui"
          isActive={isToday}
          onPress={() => setPreparationDate(today)}
        />
        <DatePill
          label="Demain"
          isActive={isTomorrow}
          onPress={() => setPreparationDate(tomorrow)}
        />
        <DatePill
          label="J+2"
          isActive={preparationDate === dayAfterTomorrow}
          onPress={() => setPreparationDate(dayAfterTomorrow)}
        />
      </View>

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
  );
}

// ---------------------------------------------------------------------------
// Date pill sub-component
// ---------------------------------------------------------------------------

function DatePill({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        isActive && styles.pillActive,
        pressed && styles.pillPressed,
      ]}
    >
      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
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
  // Date toggle
  dateToggle: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  pillPressed: {
    opacity: 0.8,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.white,
  },
});
