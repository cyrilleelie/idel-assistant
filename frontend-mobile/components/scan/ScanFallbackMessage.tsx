/**
 * ScanFallbackMessage — Shown in Expo Go when camera is unavailable.
 *
 * Explains why camera doesn't work and offers gallery as an alternative.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface ScanFallbackMessageProps {
  onPickFromGallery: () => void;
}

export default function ScanFallbackMessage({ onPickFromGallery }: ScanFallbackMessageProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="camera-outline" size={48} color={Colors.textTertiary} />
      </View>

      <Text style={styles.title}>Camera non disponible</Text>
      <Text style={styles.message}>
        La camera n'est pas disponible dans Expo Go.{'\n'}
        Utilisez un build natif (EAS Build) pour scanner des documents avec la camera.
      </Text>

      <Pressable
        onPress={onPickFromGallery}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityRole="button"
      >
        <Ionicons name="images-outline" size={20} color={Colors.white} />
        <Text style={styles.buttonText}>Choisir depuis la galerie</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
});
