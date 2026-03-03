/**
 * DocumentsScreen — Full list of documents for a patient.
 *
 * Features:
 * - FlatList of DocumentCards
 * - Delete with confirmation modal
 * - FAB to add new document (scan or gallery)
 * - Sorted by document_date DESC
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  type ListRenderItemInfo,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { fetchPatientDocuments } from '@/types/patient';
import type { DocumentView } from '@/types/patient';
import { deleteDocument } from '@/services/scanService';
import DocumentCard from '@/components/patient/DocumentCard';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import EmptyState from '@/components/ui/EmptyState';
import { Colors } from '@/constants/colors';

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const database = useDatabase();

  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Deletion state
  const [pendingDelete, setPendingDelete] = useState<DocumentView | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Fetch documents ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);

    fetchPatientDocuments(database, id)
      .then((docs) => {
        if (!cancelled) setDocuments(docs);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, database, refreshKey]);

  // ── Callbacks ───────────────────────────────────────────────────────────

  const handleDocPress = useCallback((_doc: DocumentView) => {
    // TODO (M4): Open document viewer
  }, []);

  const handleDocDelete = useCallback((doc: DocumentView) => {
    setPendingDelete(doc);
    setShowDeleteModal(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setShowDeleteModal(false);
    try {
      await deleteDocument(database, pendingDelete.id);
      setRefreshKey((k) => k + 1);
    } catch {
      Alert.alert('Erreur', 'Impossible de supprimer le document.');
    }
    setPendingDelete(null);
  }, [pendingDelete, database]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setPendingDelete(null);
  }, []);

  const handleAddDocument = useCallback(() => {
    if (!id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(`/patient/${id}/scan` as any);
  }, [id, router]);

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<DocumentView>) => (
      <DocumentCard
        document={item}
        onPress={handleDocPress}
        onDelete={handleDocDelete}
      />
    ),
    [handleDocPress, handleDocDelete],
  );

  const keyExtractor = useCallback((item: DocumentView) => item.id, []);

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="document-text-outline"
        title="Aucun document"
        message="Les documents scannes et ordonnances apparaitront ici."
        actionLabel="Scanner un document"
        onAction={handleAddDocument}
      />
    );
  }, [isLoading, handleAddDocument]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <FlatList
        data={documents}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        windowSize={7}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContent}
      />

      {/* FAB */}
      {documents.length > 0 && (
        <Pressable
          onPress={handleAddDocument}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Ajouter un document"
        >
          <Ionicons name="add" size={28} color={Colors.white} />
        </Pressable>
      )}

      {/* Delete confirmation */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Supprimer le document"
        message={
          pendingDelete != null
            ? `Supprimer ce document ? Cette action est irreversible.`
            : 'Supprimer ce document ?'
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
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
    paddingTop: 12,
    paddingBottom: 80,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
  },
});
