/**
 * TextComposer — Multiline text input for written transmissions.
 *
 * Features:
 * - Multiline TextInput with 5000 char limit
 * - Character counter
 * - KeyboardAvoidingView so the button is visible above keyboard
 * - Submit disabled when empty
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const MAX_CHARS = 5000;

interface TextComposerProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  initialText?: string;
  placeholder?: string;
}

export default function TextComposer({
  onSubmit,
  onCancel,
  initialText = '',
  placeholder = 'Saisissez vos observations...',
}: TextComposerProps) {
  const [text, setText] = useState(initialText);

  const trimmed = text.trim();
  const isEmpty = trimmed.length === 0;
  const isOverLimit = text.length > MAX_CHARS;

  const handleSubmit = useCallback(() => {
    if (isEmpty || isOverLimit) return;
    onSubmit(trimmed);
  }, [trimmed, isEmpty, isOverLimit, onSubmit]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          multiline
          textAlignVertical="top"
          autoFocus
          maxLength={MAX_CHARS + 100} // Allow slight overshoot for feedback
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.charCount, isOverLimit && styles.charCountError]}>
          {text.length} / {MAX_CHARS}
        </Text>

        <View style={styles.actions}>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            disabled={isEmpty || isOverLimit}
            style={({ pressed }) => [
              styles.submitBtn,
              (isEmpty || isOverLimit) && styles.submitBtnDisabled,
              pressed && !isEmpty && !isOverLimit && styles.submitBtnPressed,
            ]}
            accessibilityRole="button"
          >
            <Ionicons
              name="send"
              size={16}
              color={isEmpty || isOverLimit ? Colors.textTertiary : Colors.white}
            />
            <Text
              style={[
                styles.submitBtnText,
                (isEmpty || isOverLimit) && styles.submitBtnTextDisabled,
              ]}
            >
              Enregistrer
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputContainer: {
    flex: 1,
    padding: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    padding: 0,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 12,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  charCountError: {
    color: Colors.error,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.borderLight,
  },
  submitBtnPressed: {
    opacity: 0.85,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  submitBtnTextDisabled: {
    color: Colors.textTertiary,
  },
});
