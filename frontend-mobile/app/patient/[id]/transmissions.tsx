/**
 * TransmissionsScreen — Full list of transmissions for a patient.
 *
 * Features:
 * - SectionList grouped by day (Aujourd'hui / Hier / date)
 * - TransmissionCard with play/edit/view actions
 * - "Nouvelle transmission" button at bottom
 * - EmptyState when no transmissions
 * - Screen protection + audit log
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  type SectionListRenderItemInfo,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuthStore } from '@/stores/authStore';
import { useAudit } from '@/hooks/useAudit';
import { useScreenProtection } from '@/security/screenProtection';
import {
  fetchPatientTransmissions,
  groupTransmissionsByDay,
  type TransmissionView,
  type TransmissionSection,
} from '@/types/transmission';
import TransmissionCard from '@/components/transmission/TransmissionCard';
import EmptyState from '@/components/ui/EmptyState';
import { Colors } from '@/constants/colors';

export default function TransmissionsScreen() {
  const { id: patientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const database = useDatabase();
  const userId = useAuthStore((s) => s.user?.id);
  const { logAccess } = useAudit();

  useScreenProtection();

  const [transmissions, setTransmissions] = useState<TransmissionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch transmissions ───────────────────────────────────────────────

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    fetchPatientTransmissions(database, patientId)
      .then((txs) => {
        if (!cancelled) setTransmissions(txs);
      })
      .catch(() => {
        if (!cancelled) setTransmissions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // Audit log
    logAccess('view_transmission', 'transmission', patientId);

    return () => {
      cancelled = true;
    };
  }, [patientId, database, logAccess]);

  // ── Group by day ──────────────────────────────────────────────────────

  const sections = useMemo(
    () => groupTransmissionsByDay(transmissions),
    [transmissions],
  );

  // ── Callbacks ─────────────────────────────────────────────────────────

  const handlePlay = useCallback(
    (tx: TransmissionView) => {
      logAccess('play_audio', 'transmission', tx.id);
      // Audio playback is handled inline via AudioPlaybackBar in the detail screen
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/transmission/${tx.id}` as any);
    },
    [router, logAccess],
  );

  const handleViewFull = useCallback(
    (tx: TransmissionView) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/transmission/${tx.id}` as any);
    },
    [router],
  );

  const handleEdit = useCallback(
    (tx: TransmissionView) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/transmission/${tx.id}/edit` as any);
    },
    [router],
  );

  const handleNewTransmission = useCallback(() => {
    if (!patientId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/transmission/new?patientId=${patientId}` as any);
  }, [patientId, router]);

  // ── Render ────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<TransmissionView, TransmissionSection>) => (
      <TransmissionCard
        transmission={item}
        isCurrentUser={item.authorUserId === userId}
        onPlay={item.audioFilePath ? () => handlePlay(item) : undefined}
        onViewFull={() => handleViewFull(item)}
        onEdit={
          item.status === 'transcribed' && item.authorUserId === userId
            ? () => handleEdit(item)
            : undefined
        }
      />
    ),
    [userId, handlePlay, handleViewFull, handleEdit],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: TransmissionSection }) => (
      <Text style={styles.sectionTitle}>{section.title}</Text>
    ),
    [],
  );

  const keyExtractor = useCallback((item: TransmissionView) => item.id, []);

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="chatbubble-ellipses-outline"
        title="Aucune transmission"
        message="Les transmissions de ce patient apparaitront ici."
        actionLabel="Ajouter une transmission"
        onAction={handleNewTransmission}
      />
    );
  }, [isLoading, handleNewTransmission]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />

      {/* New transmission button */}
      {transmissions.length > 0 && (
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleNewTransmission}
            style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={20} color={Colors.white} />
            <Text style={styles.newBtnText}>Nouvelle transmission</Text>
          </Pressable>
        </View>
      )}
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
    paddingTop: 8,
    paddingBottom: 80,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  newBtnPressed: {
    opacity: 0.9,
  },
  newBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
});
