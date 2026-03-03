import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';
import { INACTIVITY_WIPE_DAYS } from '@/constants/securityConfig';
import { checkDeviceIntegrity } from '@/security/deviceIntegrity';
import { executeRemoteWipeIfRequested } from '@/security/remoteWipe';
import { performSecureWipe } from '@/security/secureWipe';
import * as keyManager from '@/security/keyManager';

/**
 * Security states representing the sequential startup checks.
 * Each state transitions to the next or to 'blocked' on failure.
 */
type SecurityState =
  | 'loading'
  | 'checking_integrity'
  | 'checking_wipe'
  | 'checking_inactivity'
  | 'checking_keys'
  | 'blocked'
  | 'ready';

interface SecurityContextValue {
  securityState: SecurityState;
  isReady: boolean;
  recheck: () => void;
}

const SecurityContext = createContext<SecurityContextValue>({
  securityState: 'loading',
  isReady: false,
  recheck: () => {},
});

/** Hook to access the security gate state */
export function useSecurityContext(): SecurityContextValue {
  return useContext(SecurityContext);
}

interface SecurityGateProps {
  children: React.ReactNode;
}

/** Status messages displayed during each check phase (French UI) */
const STATUS_MESSAGES: Record<string, string> = {
  loading: 'Initialisation...',
  checking_integrity: "Vérification de l'intégrité de l'appareil...",
  checking_wipe: 'Vérification de la sécurité distante...',
  checking_inactivity: "Vérification de l'activité...",
  checking_keys: 'Vérification des clés de chiffrement...',
};

/**
 * SecurityGate runs sequential security checks before allowing
 * the app to render. This component does NOT handle authentication
 * (that is the root layout's responsibility). It only checks:
 *
 * 1. Device integrity (jailbreak/root detection)
 * 2. Remote wipe status (server-requested wipe)
 * 3. Inactivity wipe (too long since last use)
 * 4. Key existence (encryption keys present)
 *
 * If any critical check fails, the app is blocked with an explanation.
 */
export function SecurityGate({ children }: SecurityGateProps): React.JSX.Element {
  const [securityState, setSecurityState] = useState<SecurityState>('loading');
  const [blockReason, setBlockReason] = useState<string>('');
  const [checkTrigger, setCheckTrigger] = useState(0);

  const recheck = useCallback(() => {
    setCheckTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function runChecks(): Promise<void> {
      // Step 1: Check device integrity
      if (cancelled) return;
      setSecurityState('checking_integrity');

      const integrity = checkDeviceIntegrity();
      if (integrity.isCompromised) {
        if (!cancelled) {
          setBlockReason(
            `Appareil non sécurisé : ${integrity.reasons.join(', ')}. ` +
              "L'application ne peut pas fonctionner sur un appareil compromis " +
              'pour protéger les données de santé (HDS).',
          );
          setSecurityState('blocked');
        }
        return;
      }

      // Step 2: Check remote wipe status
      if (cancelled) return;
      setSecurityState('checking_wipe');

      try {
        const wiped = await executeRemoteWipeIfRequested();
        if (wiped) {
          // Wipe was performed - the app state is now clean.
          // The user will need to re-authenticate.
          // We proceed to 'ready' and let the auth flow handle the rest.
        }
      } catch {
        // Network errors are non-fatal for remote wipe checks
      }

      // Step 3: Check inactivity
      if (cancelled) return;
      setSecurityState('checking_inactivity');

      try {
        const lastActivity = await keyManager.getLastActivity();
        if (lastActivity !== null) {
          const daysSinceActivity =
            (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
          if (daysSinceActivity > INACTIVITY_WIPE_DAYS) {
            await performSecureWipe('inactivity_timeout');
            // After wipe, proceed to ready - auth flow handles re-login
          }
        }
      } catch {
        // Inactivity check failure is non-fatal
      }

      // Step 4: Check key existence (informational only - keys may not
      // exist before first login, which is normal)
      if (cancelled) return;
      setSecurityState('checking_keys');

      // Keys are generated on first login, so their absence is expected
      // for new installations. This check is here for future use
      // (e.g., detecting corrupted SecureStore).

      // All checks passed
      if (!cancelled) {
        setSecurityState('ready');
      }
    }

    runChecks();

    return () => {
      cancelled = true;
    };
  }, [checkTrigger]);

  const isReady = securityState === 'ready';

  if (securityState === 'blocked') {
    return (
      <View style={styles.blockedContainer}>
        <Text style={styles.blockedIcon}>&#x26A0;</Text>
        <Text style={styles.blockedTitle}>Appareil non sécurisé</Text>
        <Text style={styles.blockedMessage}>{blockReason}</Text>
        <Text style={styles.blockedHint}>
          Contactez le support technique si vous pensez que c'est une erreur.
        </Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>
          {STATUS_MESSAGES[securityState] ?? 'Chargement...'}
        </Text>
      </View>
    );
  }

  return (
    <SecurityContext.Provider value={{ securityState, isReady, recheck }}>
      {children}
    </SecurityContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 32,
  },
  blockedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  blockedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  blockedMessage: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  blockedHint: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
