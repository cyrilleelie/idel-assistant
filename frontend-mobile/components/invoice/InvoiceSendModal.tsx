/**
 * InvoiceSendModal — Modal for sending an invoice by email or SMS.
 *
 * Pre-fills with the patient's contact info if available.
 * Validates format before enabling the send button.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface InvoiceSendModalProps {
  visible: boolean;
  channel: 'email' | 'sms';
  defaultRecipient: string;
  invoiceNumber: string;
  patientName: string;
  onSend: (recipient: string) => void;
  onCancel: () => void;
  isSending: boolean;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-.()]/g, '');
  return /^(\+?\d{10,15}|0\d{9,14})$/.test(digits);
}

export default function InvoiceSendModal({
  visible,
  channel,
  defaultRecipient,
  invoiceNumber,
  patientName,
  onSend,
  onCancel,
  isSending,
}: InvoiceSendModalProps) {
  const [recipient, setRecipient] = useState(defaultRecipient);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setRecipient(defaultRecipient);
    }
  }, [visible, defaultRecipient]);

  const isEmail = channel === 'email';
  const isValid = useMemo(
    () => (isEmail ? validateEmail(recipient) : validatePhone(recipient)),
    [isEmail, recipient],
  );

  const canSend = recipient.trim().length > 0 && isValid && !isSending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        </View>

        <View style={styles.dialog}>
          <Text style={styles.title}>
            Envoyer la facture par {isEmail ? 'Email' : 'SMS'}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Facture :</Text>
            <Text style={styles.infoValue}>{invoiceNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patient :</Text>
            <Text style={styles.infoValue}>{patientName}</Text>
          </View>

          <Text style={styles.inputLabel}>
            {isEmail ? 'Adresse email' : 'Numero de telephone'}
          </Text>
          <TextInput
            style={[styles.input, !isValid && recipient.length > 2 && styles.inputError]}
            value={recipient}
            onChangeText={setRecipient}
            keyboardType={isEmail ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={isEmail ? 'patient@email.fr' : '06 12 34 56 78'}
            placeholderTextColor={Colors.textTertiary}
            editable={!isSending}
          />

          <View style={styles.buttons}>
            <Pressable
              onPress={onCancel}
              style={[styles.button, styles.cancelButton]}
              disabled={isSending}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>

            <Pressable
              onPress={() => onSend(recipient.trim())}
              style={[
                styles.button,
                styles.sendButton,
                !canSend && styles.sendButtonDisabled,
              ]}
              disabled={!canSend}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name={isEmail ? 'mail-outline' : 'chatbubble-outline'}
                    size={16}
                    color={Colors.white}
                  />
                  <Text style={styles.sendText}>Envoyer</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  dialog: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    width: '90%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    width: 70,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: Colors.borderLight,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sendButton: {
    backgroundColor: Colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  sendText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
});
