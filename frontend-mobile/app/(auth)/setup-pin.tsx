import { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { storePinHash } from '@/security/biometricAuth';
import { useSecurityStore } from '@/stores/securityStore';
import PinInput from '@/components/ui/PinInput';
import { Colors } from '@/constants/colors';
import { PIN_LENGTH } from '@/constants/securityConfig';

type PinPhase = 'entering' | 'confirming';

/**
 * PIN setup screen shown after first login.
 * User enters a PIN, then confirms it. On match, stores the hash and navigates.
 */
export default function SetupPinScreen() {
  const router = useRouter();
  const initSecurity = useSecurityStore((s) => s.initSecurity);

  const [phase, setPhase] = useState<PinPhase>('entering');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePinComplete = useCallback(
    async (pin: string) => {
      if (isProcessing) return;

      if (phase === 'entering') {
        // Save first entry and move to confirmation
        setFirstPin(pin);
        setPhase('confirming');
        setError(undefined);
        return;
      }

      // Confirming phase: check match
      if (pin !== firstPin) {
        setError('Les codes ne correspondent pas');
        setPhase('entering');
        setFirstPin('');
        return;
      }

      // PINs match - store and navigate
      setIsProcessing(true);
      setError(undefined);

      try {
        await storePinHash(pin);
        // Reinitialize security store to pick up the new PIN config
        await initSecurity();
        router.replace('/(auth)/setup-biometrics');
      } catch {
        setError('Erreur lors de la sauvegarde du code PIN');
        setPhase('entering');
        setFirstPin('');
      } finally {
        setIsProcessing(false);
      }
    },
    [phase, firstPin, isProcessing, initSecurity, router],
  );

  const title =
    phase === 'entering' ? 'Créez votre code PIN' : 'Confirmez votre code PIN';

  const subtitle =
    phase === 'entering'
      ? 'Ce code protège l\'accès aux données de vos patients'
      : `Saisissez à nouveau les ${PIN_LENGTH} chiffres`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {/* PIN Input */}
        <PinInput
          length={PIN_LENGTH}
          onComplete={handlePinComplete}
          disabled={isProcessing}
          error={error}
        />

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          <View
            style={[styles.stepDot, phase === 'entering' && styles.stepDotActive]}
          />
          <View
            style={[
              styles.stepDot,
              phase === 'confirming' && styles.stepDotActive,
            ]}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 40,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
});
