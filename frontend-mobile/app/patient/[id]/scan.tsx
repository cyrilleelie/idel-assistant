/**
 * ScanScreen — Document capture and attachment screen.
 *
 * Flow:
 * 1. Expo Go → ScanFallbackMessage + gallery picker
 *    Native build → camera or gallery
 * 2. After capture → ScanPreview (retake/validate)
 * 3. After validate → ScanAttachmentForm (metadata)
 * 4. After submit → save to WatermelonDB → navigate back to documents
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAudit } from '@/hooks/useAudit';
import {
  isExpoGo,
  captureFromCamera,
  captureFromGallery,
  processImage,
  saveDocument,
} from '@/services/scanService';
import type { DocumentMetadata } from '@/services/scanService';
import ScanFallbackMessage from '@/components/scan/ScanFallbackMessage';
import ScanPreview from '@/components/scan/ScanPreview';
import ScanAttachmentForm from '@/components/scan/ScanAttachmentForm';
import { Colors } from '@/constants/colors';

type ScanStep = 'capture' | 'preview' | 'form';

export default function ScanScreen() {
  const { id: patientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const database = useDatabase();
  const { logAccess } = useAudit();

  const [step, setStep] = useState<ScanStep>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Capture from camera (native builds only) ───────────────────────────

  const handleCameraCapture = useCallback(async () => {
    try {
      const result = await captureFromCamera();
      if (result) {
        const processed = await processImage(result.uri);
        setImageUri(processed);
        setStep('preview');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de capturer la photo.');
    }
  }, []);

  // ── Pick from gallery ──────────────────────────────────────────────────

  const handleGalleryPick = useCallback(async () => {
    try {
      const result = await captureFromGallery();
      if (result) {
        const processed = await processImage(result.uri);
        setImageUri(processed);
        setStep('preview');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de selectionner la photo.');
    }
  }, []);

  // ── Preview actions ────────────────────────────────────────────────────

  const handleRetake = useCallback(() => {
    setImageUri(null);
    setStep('capture');
  }, []);

  const handleValidate = useCallback(() => {
    setStep('form');
  }, []);

  // ── Form submit ────────────────────────────────────────────────────────

  const handleFormSubmit = useCallback(
    async (metadata: DocumentMetadata) => {
      if (!patientId || !imageUri) return;
      setIsSaving(true);

      try {
        await saveDocument(database, patientId, imageUri, metadata);

        // Haptic feedback on successful scan
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Audit log (fire-and-forget)
        logAccess('scan_document', 'document', patientId);

        // Navigate back to documents
        router.back();
      } catch {
        Alert.alert('Erreur', 'Impossible d\'enregistrer le document.');
      } finally {
        setIsSaving(false);
      }
    },
    [patientId, imageUri, database, router, logAccess],
  );

  const handleFormCancel = useCallback(() => {
    setStep('preview');
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  // Step 1: Capture
  if (step === 'capture') {
    if (isExpoGo()) {
      return (
        <View style={styles.container}>
          <ScanFallbackMessage onPickFromGallery={handleGalleryPick} />
        </View>
      );
    }

    // Native build: offer camera and gallery
    return (
      <View style={styles.container}>
        <View style={styles.captureOptions}>
          <CaptureOption
            icon="camera-outline"
            label="Camera"
            onPress={handleCameraCapture}
          />
          <CaptureOption
            icon="images-outline"
            label="Galerie"
            onPress={handleGalleryPick}
          />
        </View>
      </View>
    );
  }

  // Step 2: Preview
  if (step === 'preview' && imageUri) {
    return (
      <ScanPreview
        imageUri={imageUri}
        onRetake={handleRetake}
        onValidate={handleValidate}
      />
    );
  }

  // Step 3: Form
  if (step === 'form') {
    return (
      <ScanAttachmentForm
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        isSaving={isSaving}
      />
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function CaptureOption({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.captureBtn, pressed && styles.captureBtnPressed]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={36} color={Colors.primary} />
      <Text style={styles.captureBtnText}>{label}</Text>
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
  captureOptions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 32,
  },
  captureBtn: {
    width: 140,
    height: 140,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  captureBtnPressed: {
    opacity: 0.8,
    backgroundColor: Colors.primaryUltraLight,
  },
  captureBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
});
