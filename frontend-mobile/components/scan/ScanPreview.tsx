/**
 * ScanPreview — Shows captured image with Retake/Validate actions.
 */

import React from 'react';
import { View, Image, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface ScanPreviewProps {
  imageUri: string;
  onRetake: () => void;
  onValidate: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ScanPreview({ imageUri, onRetake, onValidate }: ScanPreviewProps) {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: imageUri }}
        style={styles.image}
        resizeMode="contain"
      />

      <View style={styles.actions}>
        <Pressable
          onPress={onRetake}
          style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
          accessibilityRole="button"
        >
          <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.btnSecondaryText}>Reprendre</Text>
        </Pressable>

        <Pressable
          onPress={onValidate}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark-outline" size={20} color={Colors.white} />
          <Text style={styles.btnPrimaryText}>Valider</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  image: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: Colors.surface,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnSecondary: {
    backgroundColor: Colors.borderLight,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
});
