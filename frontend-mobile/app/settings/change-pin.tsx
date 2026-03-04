/**
 * ChangePinScreen — 3-step PIN change flow.
 *
 * Step 1: Verify current PIN
 * Step 2: Enter new PIN
 * Step 3: Confirm new PIN
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { verifyPin, storePinHash } from '@/security/biometricAuth';
import { useToastStore } from '@/stores/toastStore';
import PinInput from '@/components/ui/PinInput';
import { Colors } from '@/constants/colors';

type Step = 'verify' | 'new' | 'confirm';

const STEP_TITLES: Record<Step, string> = {
  verify: 'Saisissez votre code PIN actuel',
  new: 'Choisissez votre nouveau code PIN',
  confirm: 'Confirmez votre nouveau code PIN',
};

export default function ChangePinScreen() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);

  const [step, setStep] = useState<Step>('verify');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVerify = useCallback(
    async (pin: string) => {
      setIsProcessing(true);
      setError(undefined);
      try {
        const valid = await verifyPin(pin);
        if (valid) {
          setStep('new');
        } else {
          setError('Code PIN incorrect');
        }
      } catch {
        setError('Erreur de verification');
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const handleNewPin = useCallback((pin: string) => {
    setError(undefined);
    setNewPin(pin);
    setStep('confirm');
  }, []);

  const handleConfirm = useCallback(
    async (pin: string) => {
      setError(undefined);
      if (pin !== newPin) {
        setError('Les codes ne correspondent pas');
        setNewPin('');
        setStep('new');
        return;
      }

      setIsProcessing(true);
      try {
        await storePinHash(pin);
        showToast('Code PIN modifie avec succes', 'success');
        router.back();
      } catch {
        setError('Erreur lors de la sauvegarde');
      } finally {
        setIsProcessing(false);
      }
    },
    [newPin, showToast, router],
  );

  const handlers: Record<Step, (pin: string) => void> = {
    verify: handleVerify,
    new: handleNewPin,
    confirm: handleConfirm,
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Modifier le code PIN',
          headerStyle: styles.headerBar,
          headerTitleStyle: styles.headerBarTitle,
          headerTintColor: Colors.text,
        }}
      />
      <View style={styles.container}>
        <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
        <PinInput
          onComplete={handlers[step]}
          error={error}
          disabled={isProcessing}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: Colors.surface,
  },
  headerBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 32,
  },
});
