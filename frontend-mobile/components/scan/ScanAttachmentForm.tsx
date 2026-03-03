/**
 * ScanAttachmentForm — Metadata form shown after capturing/selecting an image.
 *
 * Fields: document type (picker), prescriber name, date, notes.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { getTodayString } from '@/utils/dateHelpers';
import type { DocumentMetadata } from '@/services/scanService';

interface ScanAttachmentFormProps {
  onSubmit: (metadata: DocumentMetadata) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

const FILE_TYPES = [
  { value: 'prescription', label: 'Ordonnance', icon: 'document-text-outline' as const },
  { value: 'lab_result', label: 'Resultat labo', icon: 'flask-outline' as const },
  { value: 'other', label: 'Autre document', icon: 'document-outline' as const },
];

export default function ScanAttachmentForm({
  onSubmit,
  onCancel,
  isSaving,
}: ScanAttachmentFormProps) {
  const [fileType, setFileType] = useState('prescription');
  const [prescriberName, setPrescriberName] = useState('');
  const [documentDate, setDocumentDate] = useState(getTodayString());
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    onSubmit({
      fileType,
      prescriberName: prescriberName.trim() || undefined,
      documentDate: documentDate || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Informations du document</Text>

      {/* File type picker */}
      <Text style={styles.label}>Type de document</Text>
      <View style={styles.typeRow}>
        {FILE_TYPES.map((type) => (
          <Pressable
            key={type.value}
            onPress={() => setFileType(type.value)}
            style={[
              styles.typeChip,
              fileType === type.value && styles.typeChipActive,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: fileType === type.value }}
          >
            <Ionicons
              name={type.icon}
              size={16}
              color={fileType === type.value ? Colors.white : Colors.textSecondary}
            />
            <Text
              style={[
                styles.typeChipText,
                fileType === type.value && styles.typeChipTextActive,
              ]}
            >
              {type.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Prescriber name */}
      <Text style={styles.label}>Prescripteur</Text>
      <TextInput
        style={styles.input}
        value={prescriberName}
        onChangeText={setPrescriberName}
        placeholder="Dr. Dupont"
        placeholderTextColor={Colors.textTertiary}
        autoCapitalize="words"
      />

      {/* Date */}
      <Text style={styles.label}>Date du document</Text>
      <TextInput
        style={styles.input}
        value={documentDate}
        onChangeText={setDocumentDate}
        placeholder="AAAA-MM-JJ"
        placeholderTextColor={Colors.textTertiary}
        keyboardType="numbers-and-punctuation"
      />

      {/* Notes */}
      <Text style={styles.label}>Notes (optionnel)</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={note}
        onChangeText={setNote}
        placeholder="Informations complementaires..."
        placeholderTextColor={Colors.textTertiary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
          accessibilityRole="button"
          disabled={isSaving}
        >
          <Text style={styles.btnSecondaryText}>Annuler</Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            pressed && styles.btnPressed,
            isSaving && styles.btnDisabled,
          ]}
          accessibilityRole="button"
          disabled={isSaving}
        >
          <Ionicons name="checkmark-outline" size={18} color={Colors.white} />
          <Text style={styles.btnPrimaryText}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: Colors.white,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  inputMultiline: {
    minHeight: 80,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
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
  btnDisabled: {
    opacity: 0.6,
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
