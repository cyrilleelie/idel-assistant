import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  authenticateWithBiometrics,
  verifyPin,
  incrementPinAttempts,
  resetPinAttempts,
  getPinAttempts,
} from '@/security/biometricAuth';
import { performSecureWipe } from '@/security/secureWipe';
import { useSecurityStore } from '@/stores/securityStore';
import { useAuthStore } from '@/stores/authStore';
import { AuditLogger } from '@/security/auditLogger';
import PinInput from '@/components/ui/PinInput';
import { Colors } from '@/constants/colors';
import { PIN_LENGTH, MAX_PIN_ATTEMPTS } from '@/constants/securityConfig';

/**
 * Unlock screen shown when the app is locked after inactivity.
 * Supports biometric unlock (auto-prompted) and PIN fallback.
 * After MAX_PIN_ATTEMPTS failures, triggers a secure wipe.
 */
export default function UnlockScreen() {
  const router = useRouter();
  const unlock = useSecurityStore((s) => s.unlock);
  const biometricEnabled = useSecurityStore((s) => s.isBiometricsEnabled);
  const userId = useAuthStore((s) => s.user?.id) ?? 'unknown';

  const [showPinInput, setShowPinInput] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [remainingAttempts, setRemainingAttempts] = useState(MAX_PIN_ATTEMPTS);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle successful unlock
  const handleUnlockSuccess = useCallback(
    async (method: 'biometric' | 'pin') => {
      await resetPinAttempts();
      unlock();
      AuditLogger.log('app_unlock', 'system', 'device', userId, {
        method,
      });
      router.back();
    },
    [unlock, router, userId],
  );

  // Auto-prompt biometric on mount if enabled
  useEffect(() => {
    let mounted = true;

    async function tryBiometric() {
      if (!biometricEnabled) {
        setShowPinInput(true);
        return;
      }

      try {
        const result = await authenticateWithBiometrics();
        if (!mounted) return;

        if (result.success) {
          await handleUnlockSuccess('biometric');
        } else {
          // Biometric failed or cancelled: fall back to PIN
          setShowPinInput(true);
        }
      } catch {
        if (mounted) {
          setShowPinInput(true);
        }
      }
    }

    tryBiometric();
    return () => {
      mounted = false;
    };
  }, [biometricEnabled, handleUnlockSuccess]);

  // Handle PIN entry
  const handlePinComplete = useCallback(
    async (pin: string) => {
      if (isProcessing) return;

      setIsProcessing(true);
      setError(undefined);

      try {
        const valid = await verifyPin(pin);

        if (valid) {
          await handleUnlockSuccess('pin');
          return;
        }

        // Wrong PIN
        const newAttemptCount = await incrementPinAttempts();
        const remaining = MAX_PIN_ATTEMPTS - newAttemptCount;
        setRemainingAttempts(remaining);

        if (remaining <= 0) {
          // Max attempts reached: secure wipe
          await performSecureWipe('max_pin_attempts');
          router.replace('/(auth)/login');
          return;
        }

        setError(
          `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`,
        );
      } catch {
        setError('Erreur de vérification');
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, handleUnlockSuccess, router],
  );

  // Initialize remaining attempts on mount
  useEffect(() => {
    let mounted = true;
    async function loadAttempts() {
      const attempts = await getPinAttempts();
      if (mounted) {
        setRemainingAttempts(MAX_PIN_ATTEMPTS - attempts);
      }
    }
    loadAttempts();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Lock icon */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Application verrouillée</Text>
          <Text style={styles.subtitle}>
            {showPinInput
              ? `Saisissez votre code PIN à ${PIN_LENGTH} chiffres`
              : 'Authentification en cours...'}
          </Text>
        </View>

        {/* PIN Input */}
        {showPinInput && (
          <PinInput
            length={PIN_LENGTH}
            onComplete={handlePinComplete}
            disabled={isProcessing}
            error={error}
          />
        )}

        {/* Attempts warning */}
        {remainingAttempts <= 2 && remainingAttempts > 0 && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning" size={16} color={Colors.warning} />
            <Text style={styles.warningText}>
              Attention : les données seront effacées après {MAX_PIN_ATTEMPTS}{' '}
              tentatives échouées
            </Text>
          </View>
        )}
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
    width: 88,
    height: 88,
    borderRadius: 44,
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
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.warningLight,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    color: Colors.warning,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
