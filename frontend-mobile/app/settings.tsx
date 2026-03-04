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
import { Directory, Paths } from 'expo-file-system';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAuthStore } from '@/stores/authStore';
import { useSecurityStore } from '@/stores/securityStore';
import { useSyncStore } from '@/stores/syncStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNotificationStore } from '@/stores/notificationStore';
import type { GpsApp } from '@/stores/settingsStore';
import {
  checkBiometricAvailability,
  setBiometricEnabled as persistBiometricEnabled,
} from '@/security/biometricAuth';
import { Colors } from '@/constants/colors';

/** Available lock timeout options in minutes */
const LOCK_TIMEOUT_OPTIONS = [1, 2, 5] as const;

/**
 * Settings screen — final version with all sections:
 * Compte, Securite, Navigation, Notifications, Donnees, Deconnexion
 */
export default function SettingsScreen() {
  const router = useRouter();
  const database = useDatabase();
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

  // Notification preferences
  const notifPreferences = useNotificationStore((s) => s.preferences);
  const updateNotifPref = useNotificationStore((s) => s.updatePreference);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cacheSize, setCacheSize] = useState<string | null>(null);

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

  // Calculate cache size on mount
  useEffect(() => {
    let mounted = true;
    async function calculateCacheSize() {
      let totalBytes = 0;
      const directories = ['audio', 'scans', 'invoices', 'cache'];

      for (const dirName of directories) {
        try {
          const dir = new Directory(Paths.document, dirName);
          if (dir.exists) {
            // List files and sum sizes
            const files = dir.list();
            for (const entry of files) {
              try {
                if ('size' in entry) {
                  totalBytes += (entry as { size: number }).size;
                }
              } catch {
                // Skip inaccessible files
              }
            }
          }
        } catch {
          // Directory may not exist
        }
      }

      if (!mounted) return;

      if (totalBytes < 1024 * 1024) {
        setCacheSize('< 1 Mo');
      } else {
        const mb = (totalBytes / (1024 * 1024)).toFixed(1);
        setCacheSize(`${mb} Mo`);
      }
    }
    calculateCacheSize();
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
      const { triggerSync } = await import('@/services/syncService');
      await triggerSync(database);
    } catch {
      Alert.alert('Erreur', 'La synchronisation a echoue. Reessayez.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, database]);

  // Clear cache confirmation
  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Vider le cache local',
      'Les donnees locales seront supprimees. Elles seront re-telechargees a la prochaine synchronisation.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider',
          style: 'destructive',
          onPress: async () => {
            const directories = ['audio', 'scans', 'invoices', 'cache'];
            for (const dirName of directories) {
              try {
                const dir = new Directory(Paths.document, dirName);
                if (dir.exists) {
                  dir.delete();
                }
              } catch {
                // Continue
              }
            }
            setCacheSize('< 1 Mo');
            Alert.alert('Cache vide', 'Les donnees locales ont ete supprimees.');
          },
        },
      ],
    );
  }, []);

  // Logout confirmation
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Se deconnecter',
      'Etes-vous sur de vouloir vous deconnecter ? Les donnees non synchronisees seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se deconnecter',
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

  // Navigate to PIN change screen
  const handleChangePIN = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push('/settings/change-pin' as any);
  }, [router]);

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
          title: 'Parametres',
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
          <Text style={styles.sectionTitle}>SECURITE</Text>
          <View style={styles.card}>
            {biometricAvailable && (
              <>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Verrouillage biometrique</Text>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={handleBiometricToggle}
                    trackColor={{
                      false: Colors.border,
                      true: Colors.primaryLight,
                    }}
                    thumbColor={biometricEnabled ? Colors.primary : Colors.white}
                    accessibilityRole="switch"
                    accessibilityLabel="Activer le verrouillage biometrique"
                  />
                </View>
                <Separator />
              </>
            )}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Delai de verrouillage</Text>
              <View style={styles.pickerRow}>
                {LOCK_TIMEOUT_OPTIONS.map((minutes) => (
                  <TouchableOpacity
                    key={minutes}
                    style={[
                      styles.pickerOption,
                      lockTimeout === minutes && styles.pickerOptionActive,
                    ]}
                    onPress={() => handleTimeoutChange(minutes)}
                    accessibilityRole="button"
                    accessibilityLabel={`${minutes} minutes`}
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
            <TouchableOpacity
              style={styles.row}
              onPress={handleChangePIN}
              accessibilityRole="button"
              accessibilityLabel="Modifier le code PIN"
            >
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
                  accessibilityRole="button"
                  accessibilityLabel={`GPS : ${option.label}`}
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

        {/* NOTIFICATIONS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Annulations de RDV</Text>
              <Switch
                value={notifPreferences.appointmentCancelled}
                onValueChange={(v) => updateNotifPref('appointmentCancelled', v)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={notifPreferences.appointmentCancelled ? Colors.primary : Colors.white}
                accessibilityRole="switch"
                accessibilityLabel="Notifications d'annulations de RDV"
              />
            </View>
            <Separator />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Transmissions collegues</Text>
              <Switch
                value={notifPreferences.newTransmission}
                onValueChange={(v) => updateNotifPref('newTransmission', v)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={notifPreferences.newTransmission ? Colors.primary : Colors.white}
                accessibilityRole="switch"
                accessibilityLabel="Notifications de transmissions collegues"
              />
            </View>
            <Separator />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Confirmations de sync</Text>
              <Switch
                value={notifPreferences.syncConfirmation}
                onValueChange={(v) => updateNotifPref('syncConfirmation', v)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={notifPreferences.syncConfirmation ? Colors.primary : Colors.white}
                accessibilityRole="switch"
                accessibilityLabel="Notifications de confirmation de synchronisation"
              />
            </View>
            <Separator />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Silence nocturne (22h-7h)</Text>
              <Switch
                value={notifPreferences.silentHoursEnabled}
                onValueChange={(v) => updateNotifPref('silentHoursEnabled', v)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={notifPreferences.silentHoursEnabled ? Colors.primary : Colors.white}
                accessibilityRole="switch"
                accessibilityLabel="Activer le silence nocturne de 22h a 7h"
              />
            </View>
          </View>
        </View>

        {/* DONNEES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DONNEES</Text>
          <View style={styles.card}>
            <SettingsRow
              label="Derniere synchronisation"
              value={lastSyncFormatted}
            />
            <Separator />
            <SettingsRow
              label="Donnees en cache"
              value={cacheSize ?? '...'}
            />
            <Separator />
            <SettingsRow
              label="Operations en attente"
              value={String(pendingCount)}
            />
            <Separator />
            <TouchableOpacity
              style={styles.row}
              onPress={handleForceSync}
              disabled={isSyncing}
              accessibilityRole="button"
              accessibilityLabel="Forcer la synchronisation"
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
            <TouchableOpacity
              style={styles.row}
              onPress={handleClearCache}
              accessibilityRole="button"
              accessibilityLabel="Vider le cache local"
            >
              <Text style={styles.rowLabelAction}>Vider le cache local</Text>
              <Ionicons name="trash-outline" size={20} color={Colors.warning} />
            </TouchableOpacity>
          </View>
        </View>

        {/* DECONNEXION */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Se deconnecter"
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            <Text style={styles.dangerButtonText}>Se deconnecter</Text>
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
    minHeight: 44,
    justifyContent: 'center',
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
    minHeight: 48,
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
