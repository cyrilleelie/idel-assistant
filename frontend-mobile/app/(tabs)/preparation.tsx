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
import { FlatList, View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuthStore } from '@/stores/authStore';
import { usePreparationStore } from '@/stores/preparationStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useScreenProtection } from '@/security/screenProtection';
import { getTodayString, addDays } from '@/utils/dateHelpers';
import type { PatientPreparation } from '@/services/preparationService';
import PreparationCard from '@/components/preparation/PreparationCard';
import DailySynthesis from '@/components/preparation/DailySynthesis';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import SwipeDateContainer from '@/components/ui/SwipeDateContainer';
import { Colors } from '@/constants/colors';

export default function PreparationScreen() {
  const router = useRouter();
  const database = useDatabase();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
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

  // Active date toggle: "Aujourd'hui" or "Demain"
  const isToday = preparationDate === today;
  const isTomorrow = preparationDate === tomorrow;

  const handleSwipeLeft = useCallback(() => {
    if (preparationDate < dayAfterTomorrow) setPreparationDate(addDays(preparationDate, 1));
  }, [preparationDate, dayAfterTomorrow, setPreparationDate]);

  const handleSwipeRight = useCallback(() => {
    if (preparationDate > today) setPreparationDate(addDays(preparationDate, -1));
  }, [preparationDate, today, setPreparationDate]);

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

  // Collect all alerts for "Points d'attention" section
  const allAlerts: { patientName: string; alert: string; patientId: string }[] = useMemo(() => {
    if (!data) return [];
    const alerts: { patientName: string; alert: string; patientId: string }[] = [];
    for (const p of data.patients) {
      if (p.aiSummary) {
        for (const alert of p.aiSummary.alerts) {
          alerts.push({ patientName: p.patientName, alert, patientId: p.patientId });
        }
      }
    }
    return alerts;
  }, [data]);

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

  // User initials for avatar
  const userInitials = useMemo(() => {
    if (!user) return 'U';
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  }, [user]);

  // Header component for FlatList
  const renderHeader = useCallback(() => {
    if (!data) return null;
    return (
      <>
        {/* Stats cards row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>PATIENTS</Text>
            <Text style={styles.statValue}>{data.totalPatients}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>NOUVELLES INFOS</Text>
            <Text style={[styles.statValue, styles.statValuePrimary]}>{data.patientsWithNewInfo}</Text>
          </View>
        </View>

        {/* AI Synthesis box */}
        {data.totalPatients > 0 && (
          <DailySynthesis data={data} />
        )}

        {/* Points d'attention section */}
        {allAlerts.length > 0 && (
          <View style={styles.attentionSection}>
            <View style={styles.attentionHeader}>
              <Ionicons name="notifications-outline" size={18} color={Colors.text} />
              <Text style={styles.attentionTitle}>Points d'attention</Text>
            </View>
            {allAlerts.map((a, idx) => (
              <View key={idx} style={styles.attentionItem}>
                <View style={styles.attentionDot} />
                <Text style={styles.attentionText}>
                  <Text style={styles.attentionPatient}>{a.patientName}</Text>
                  {' : '}{a.alert}
                </Text>
              </View>
            ))}
          </View>
        )}
      </>
    );
  }, [data, allAlerts]);

  // Custom header bar
  const headerBar = (
    <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.headerIcon} hitSlop={8}>
        <Ionicons name="menu-outline" size={24} color={Colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Preparer ma journee</Text>
      <View style={styles.headerAvatar}>
        <Text style={styles.headerAvatarText}>{userInitials}</Text>
      </View>
    </View>
  );

  // Date toggle
  const dateToggle = (
    <View style={styles.dateToggleContainer}>
      <View style={styles.dateToggle}>
        <Pressable
          onPress={() => setPreparationDate(today)}
          style={[styles.dateToggleBtn, isToday && styles.dateToggleBtnActive]}
        >
          <Text style={[styles.dateToggleText, isToday && styles.dateToggleTextActive]}>
            Aujourd'hui
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setPreparationDate(tomorrow)}
          style={[styles.dateToggleBtn, isTomorrow && styles.dateToggleBtnActive]}
        >
          <Text style={[styles.dateToggleText, isTomorrow && styles.dateToggleTextActive]}>
            Demain
          </Text>
        </Pressable>
      </View>
    </View>
  );

  // Loading state
  if (isLoading && !data) {
    return (
      <SwipeDateContainer onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight}>
        <View style={styles.container}>
          {headerBar}
          {dateToggle}
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
          {headerBar}
          {dateToggle}
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
        {headerBar}
        {dateToggle}

        <FlatList
          data={data?.patients ?? []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderHeader}
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

  // Header bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },

  // Date toggle
  dateToggleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  dateToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 3,
  },
  dateToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  dateToggleBtnActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dateToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  dateToggleTextActive: {
    color: Colors.primary,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
  },
  statValuePrimary: {
    color: Colors.primary,
  },

  // Points d'attention
  attentionSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attentionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  attentionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.warning,
    marginTop: 6,
  },
  attentionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  attentionPatient: {
    fontWeight: '700',
    color: Colors.warning,
  },
});
