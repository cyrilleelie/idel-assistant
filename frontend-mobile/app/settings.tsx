import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useSecurityStore } from '@/stores/securityStore';
import { useSyncStore } from '@/stores/syncStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { GpsApp } from '@/stores/settingsStore';
import {
  checkBiometricAvailability,
  setBiometricEnabled as persistBiometricEnabled,
} from '@/security/biometricAuth';
import { Colors } from '@/constants/colors';

/** Available lock timeout options in minutes */
const LOCK_TIMEOUT_OPTIONS = [1, 2, 5] as const;

/**
 * Settings screen accessible from the tab bar header gear icon.
 * Contains account info, security settings, data management, and logout.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const cabinet = useAuthStore((s) => s.cabinet);
  const logout = useAuthStore((s) => s.logout);
  const biometricEnabled = useSecurityStore((s) => s.isBiometricsEnabled);
  const initSecurity = useSecurityStore((s) => s.initSecurity);
  const lockTimeout = useSecurityStore((s) => s.lockTimeoutMinutes);
  const setLockTimeout = useSecurityStore((s) => s.setLockTimeout);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const pendingCount = useSyncStore((s) => s.pendingOperationsCount);
  const gpsAppPreference = useSettingsStore((s) => s.gpsAppPreference);
  const setGpsAppPreference = useSettingsStore((s) => s.setGpsAppPreference);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check biometric availability on mount
  useEffect(() => {
    let mounted = true;
    async function check() {
      const result = await checkBiometricAvailability();
      if (mounted) setBiometricAvailable(result.isAvailable);
    }
    check();
    return () => {
      mounted = false;
    };
  }, []);

  // Toggle biometric enabled
  const handleBiometricToggle = useCallback(
    async (value: boolean) => {
      await persistBiometricEnabled(value);
      await initSecurity();
    },
    [initSecurity],
  );

  // Force sync handler
  const handleForceSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // TODO (M2): wire up performSync(database, apiClient) when available
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
    } catch {
      Alert.alert('Erreur', 'La synchronisation a échoué. Réessayez.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Clear cache confirmation
  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Vider le cache local',
      'Les données locales seront supprimées. Elles seront re-téléchargées à la prochaine synchronisation.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider',
          style: 'destructive',
          onPress: () => {
            // Placeholder: cache clearing will be implemented in a future iteration
            Alert.alert('Cache vidé', 'Les données locales ont été supprimées.');
          },
        },
      ],
    );
  }, []);

  // Logout confirmation
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Se déconnecter',
      'Êtes-vous sûr de vouloir vous déconnecter ? Les données non synchronisées seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }, [logout, router]);

  // Lock timeout picker
  const handleTimeoutChange = useCallback(
    (minutes: number) => {
      setLockTimeout(minutes);
    },
    [setLockTimeout],
  );

  // PIN change handler (placeholder)
  const handleChangePIN = useCallback(() => {
    // Will be implemented in a future iteration
    console.log('Change PIN requested');
    Alert.alert(
      'Modifier le code PIN',
      'Cette fonctionnalité sera disponible dans une prochaine mise à jour.',
    );
  }, []);

  // Format last sync date
  const lastSyncFormatted =
    lastSyncAt !== null
      ? new Date(lastSyncAt).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Jamais';

  // Compose display name from user fields
  const displayName =
    user !== null
      ? `${user.firstName} ${user.lastName}`.trim()
      : '-';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Paramètres',
          headerStyle: styles.headerBar,
          headerTitleStyle: styles.headerBarTitle,
          headerTintColor: Colors.text,
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* COMPTE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPTE</Text>
          <View style={styles.card}>
            <SettingsRow label="Nom" value={displayName} />
            <Separator />
            <SettingsRow label="Email" value={user?.email ?? '-'} />
            <Separator />
            <SettingsRow label="RPPS" value={user?.rpps ?? '-'} />
            <Separator />
            <SettingsRow label="Cabinet" value={cabinet?.name ?? '-'} />
          </View>
        </View>

        {/* SECURITE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SÉCURITÉ</Text>
          <View style={styles.card}>
            {biometricAvailable && (
              <>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Verrouillage biométrique</Text>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={handleBiometricToggle}
                    trackColor={{
                      false: Colors.border,
                      true: Colors.primaryLight,
                    }}
                    thumbColor={biometricEnabled ? Colors.primary : Colors.white}
                  />
                </View>
                <Separator />
              </>
            )}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Délai de verrouillage</Text>
              <View style={styles.pickerRow}>
                {LOCK_TIMEOUT_OPTIONS.map((minutes) => (
                  <TouchableOpacity
                    key={minutes}
                    style={[
                      styles.pickerOption,
                      lockTimeout === minutes && styles.pickerOptionActive,
                    ]}
                    onPress={() => handleTimeoutChange(minutes)}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        lockTimeout === minutes && styles.pickerOptionTextActive,
                      ]}
                    >
                      {minutes} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Separator />
            <TouchableOpacity style={styles.row} onPress={handleChangePIN}>
              <Text style={styles.rowLabel}>Modifier le code PIN</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* NAVIGATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NAVIGATION</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Application GPS</Text>
            </View>
            <View style={styles.gpsPickerContainer}>
              {(
                [
                  { value: 'system' as GpsApp, label: 'Systeme' },
                  { value: 'google_maps' as GpsApp, label: 'Google Maps' },
                  { value: 'waze' as GpsApp, label: 'Waze' },
                  ...(Platform.OS === 'ios'
                    ? [{ value: 'apple_maps' as GpsApp, label: 'Apple Plans' }]
                    : []),
                ] satisfies Array<{ value: GpsApp; label: string }>
              ).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.pickerOption,
                    gpsAppPreference === option.value && styles.pickerOptionActive,
                  ]}
                  onPress={() => setGpsAppPreference(option.value)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      gpsAppPreference === option.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* DONNEES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DONNÉES</Text>
          <View style={styles.card}>
            <SettingsRow
              label="Dernière synchronisation"
              value={lastSyncFormatted}
            />
            <Separator />
            <SettingsRow
              label="Opérations en attente"
              value={String(pendingCount)}
            />
            <Separator />
            <TouchableOpacity
              style={styles.row}
              onPress={handleForceSync}
              disabled={isSyncing}
            >
              <Text style={styles.rowLabelAction}>
                Forcer la synchronisation
              </Text>
              {isSyncing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="sync-outline" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
            <Separator />
            <TouchableOpacity style={styles.row} onPress={handleClearCache}>
              <Text style={styles.rowLabelAction}>Vider le cache local</Text>
              <Ionicons name="trash-outline" size={20} color={Colors.warning} />
            </TouchableOpacity>
          </View>
        </View>

        {/* DECONNEXION */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            <Text style={styles.dangerButtonText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );
}

/** Read-only label + value row */
function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Thin separator line between card rows */
function Separator() {
  return <View style={styles.separator} />;
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
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  rowLabelAction: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  rowValue: {
    fontSize: 15,
    color: Colors.textSecondary,
    maxWidth: '50%',
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gpsPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  pickerOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
  },
  pickerOptionActive: {
    backgroundColor: Colors.primaryUltraLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  pickerOptionTextActive: {
    color: Colors.primary,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerLight,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
  bottomSpacer: {
    height: 40,
  },
});
