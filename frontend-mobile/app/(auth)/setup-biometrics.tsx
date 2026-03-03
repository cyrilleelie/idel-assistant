import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  checkBiometricAvailability,
  authenticateWithBiometrics,
  setBiometricEnabled,
} from '@/security/biometricAuth';
import { useSecurityStore } from '@/stores/securityStore';
import { Colors } from '@/constants/colors';

type BiometricDisplayType = 'face' | 'fingerprint';

/**
 * Biometric setup screen shown after PIN configuration.
 * If biometrics are not available, auto-navigates to main tabs.
 * Otherwise, offers the user the option to enable biometric unlock.
 */
export default function SetupBiometricsScreen() {
  const router = useRouter();
  const initSecurity = useSecurityStore((s) => s.initSecurity);

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [displayType, setDisplayType] = useState<BiometricDisplayType>('fingerprint');
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check biometric availability on mount
  useEffect(() => {
    let mounted = true;

    async function checkAvailability() {
      const availability = await checkBiometricAvailability();
      if (!mounted) return;

      if (!availability.isAvailable) {
        // Not available: skip directly to main tabs
        router.replace('/(tabs)/tournee');
        return;
      }

      setIsAvailable(true);

      // Determine display type from supported authentication types
      const hasFace = availability.supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      );
      setDisplayType(hasFace ? 'face' : 'fingerprint');
    }

    checkAvailability();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleActivate = useCallback(async () => {
    if (isActivating) return;

    setIsActivating(true);
    setError(null);

    try {
      const result = await authenticateWithBiometrics();
      if (result.success) {
        await setBiometricEnabled(true);
        // Reinitialize security store to pick up biometric enablement
        await initSecurity();
        router.replace('/(tabs)/tournee');
      } else {
        setError(result.error ?? 'Authentification annulée');
      }
    } catch {
      setError('Erreur lors de l\'activation biométrique');
    } finally {
      setIsActivating(false);
    }
  }, [isActivating, initSecurity, router]);

  const handleSkip = useCallback(() => {
    router.replace('/(tabs)/tournee');
  }, [router]);

  // Show nothing while checking availability (will auto-redirect if unavailable)
  if (isAvailable === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const iconName: keyof typeof Ionicons.glyphMap =
    displayType === 'face' ? 'scan' : 'finger-print';

  const biometricLabel =
    displayType === 'face' ? 'Face ID' : 'l\'empreinte digitale';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name={iconName} size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Activez {biometricLabel}</Text>
          <Text style={styles.subtitle}>
            Déverrouillez l'application rapidement et en toute sécurité avec{' '}
            {displayType === 'face' ? 'la reconnaissance faciale' : 'votre empreinte digitale'}
          </Text>
        </View>

        {/* Error */}
        {error !== null && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.activateButton}
            onPress={handleActivate}
            disabled={isActivating}
            activeOpacity={0.8}
          >
            {isActivating ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.activateButtonText}>Activer</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={isActivating}
            activeOpacity={0.8}
          >
            <Text style={styles.skipButtonText}>Plus tard</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  activateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  activateButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
