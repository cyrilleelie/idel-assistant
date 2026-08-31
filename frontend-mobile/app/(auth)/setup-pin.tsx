import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
    phase === 'entering' ? 'Cr\u00e9er votre code PIN' : 'Confirmez votre code PIN';

  const subtitle =
    phase === 'entering'
      ? 'Saisissez un code \u00e0 4 chiffres pour\ns\u00e9curiser votre acc\u00e8s'
      : 'Saisissez \u00e0 nouveau les 4 chiffres';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>IDEL Planning Pro</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.container}>
        {/* Title section */}
        <View style={styles.titleSection}>
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

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {'\u00a9'} 2024 IDEL Planning Pro. Tous droits r{'\u00e9'}serv{'\u00e9'}s.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
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
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
