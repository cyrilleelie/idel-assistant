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
        setError(result.error ?? 'Authentification annul\u00e9e');
      }
    } catch {
      setError('Erreur lors de l\'activation biom\u00e9trique');
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
    displayType === 'face' ? 'scan-outline' : 'finger-print';

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
        <Text style={styles.headerTitle}>S{'\u00e9'}curit{'\u00e9'}</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.container}>
        {/* Icon section */}
        <View style={styles.header}>
          <View style={styles.iconGlow}>
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={56} color={Colors.primary} />
            </View>
          </View>
          <Text style={styles.title}>Activer la biom{'\u00e9'}trie ?</Text>
          <Text style={styles.subtitle}>
            S{'\u00e9'}curisez l'acc{'\u00e8'}s {'\u00e0'} vos tourn{'\u00e9'}es IDEL et gagnez du temps lors de vos connexions quotidiennes. Un simple regard ou une empreinte suffit.
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

        {/* Bottom security note */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.textTertiary} />
          <Text style={styles.securityNoteText}>Donn{'\u00e9'}es chiffr{'\u00e9'}es localement</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconGlow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: 'rgba(226, 232, 240, 0.5)',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 40,
  },
  securityNoteText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
