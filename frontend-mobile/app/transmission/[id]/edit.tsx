/**
 * TransmissionEditScreen — Correction of transcription text.
 *
 * Pre-fills TextComposer with existing contentText.
 * On save, updates contentText in WatermelonDB and enqueues sync.
 * Optional "Regenerer synthese IA" button enqueues with regenerate flag.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useScreenProtection } from '@/security/screenProtection';
import { globalQueue } from '@/services/globalQueue';
import { buildTransmissionView, type TransmissionView } from '@/types/transmission';
import TextComposer from '@/components/transmission/TextComposer';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { Colors } from '@/constants/colors';
import type Transmission from '@/db/models/Transmission';

export default function TransmissionEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const database = useDatabase();

  useScreenProtection();

  const [transmission, setTransmission] = useState<TransmissionView | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load transmission ─────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    database
      .get<Transmission>('transmissions')
      .find(id)
      .then((tx) => {
        if (!cancelled) setTransmission(buildTransmissionView(tx));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, database]);

  // ── Save correction ───────────────────────────────────────────────────

  const handleSave = useCallback(
    async (text: string) => {
      if (!id || !transmission) return;

      try {
        const tx = await database.get<Transmission>('transmissions').find(id);
        await database.write(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.update((record: any) => {
            record._raw.content_text = text;
          });
        });

        // Enqueue sync
        globalQueue
          .enqueue('PATCH', `/api/v1/transmissions/${transmission.serverId}`, {
            contentText: text,
          })
          .catch(() => {});

        Alert.alert('Enregistre', 'La correction a ete sauvegardee.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch {
        Alert.alert('Erreur', 'Impossible de sauvegarder la correction.');
      }
    },
    [id, transmission, database, router],
  );

  // ── Regenerate AI synthesis ───────────────────────────────────────────

  const handleRegenerate = useCallback(async () => {
    if (!transmission) return;

    try {
      await globalQueue.enqueue(
        'POST',
        `/api/v1/transmissions/${transmission.serverId}/regenerate`,
        { regenerate_synthesis: true },
      );
      Alert.alert(
        'Demande envoyee',
        'La synthese IA sera regeneree lors de la prochaine synchronisation.',
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande.');
    }
  }, [transmission]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  // ── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingScreen message="Chargement..." />;
  }

  if (!transmission) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
        <Text style={styles.notFoundText}>Transmission introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Regenerate button */}
      {transmission.contentStructured && (
        <Pressable
          onPress={handleRegenerate}
          style={({ pressed }) => [styles.regenerateBtn, pressed && styles.regenerateBtnPressed]}
        >
          <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
          <Text style={styles.regenerateBtnText}>Regenerer la synthese IA</Text>
        </Pressable>
      )}

      {/* Text composer with existing text */}
      <TextComposer
        onSubmit={handleSave}
        onCancel={handleCancel}
        initialText={transmission.contentText ?? ''}
        placeholder="Corrigez la transcription..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: Colors.background,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primaryUltraLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  regenerateBtnPressed: {
    opacity: 0.7,
  },
  regenerateBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
