import { useState, useEffect, useCallback, useMemo } from 'react';
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
 * Settings screen — Stitch-inspired redesign with clean sections:
 * Compte, Securite, Navigation & GPS, Notifications, Deconnexion
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

  // User initials
  const userInitials = useMemo(() => {
    if (!user) return 'U';
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || 'U';
  }, [user]);

  // GPS app display name
  const gpsAppLabel = useMemo(() => {
    switch (gpsAppPreference) {
      case 'google_maps': return 'Google Maps';
      case 'waze': return 'Waze';
      case 'apple_maps': return 'Apple Plans';
      default: return 'Systeme';
    }
  }, [gpsAppPreference]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: styles.headerBar,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <Text style={styles.headerTitleText}>Parametres</Text>
          ),
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* COMPTE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPTE</Text>
          <View style={styles.card}>
            {/* Profile card row */}
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.7}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{userInitials}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.profileRole}>Infirmier(e) liberal(e)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
            <Separator />
            <SettingsRow
              icon="medical-outline"
              label="ADELI"
              value={user?.rpps ?? '-'}
            />
          </View>
        </View>

        {/* SECURITE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITE</Text>
          <View style={styles.card}>
            {biometricAvailable && (
              <>
                <View style={styles.row}>
                  <View style={styles.rowIconLabel}>
                    <Ionicons name="finger-print-outline" size={20} color={Colors.text} />
                    <Text style={styles.rowLabel}>Biometrie</Text>
                  </View>
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
              <View style={styles.rowIconLabel}>
                <Ionicons name="cloud-outline" size={20} color={Colors.text} />
                <View>
                  <Text style={styles.rowLabel}>Synchronisation cloud</Text>
                  <Text style={styles.rowSubtext}>{lastSyncFormatted}</Text>
                </View>
              </View>
              {isSyncing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <TouchableOpacity onPress={handleForceSync} hitSlop={8}>
                  <Ionicons name="sync-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* NAVIGATION & GPS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NAVIGATION & GPS</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowIconLabel}>
                <Ionicons name="navigate-outline" size={20} color={Colors.text} />
                <Text style={styles.rowLabel}>Application</Text>
              </View>
              <Text style={styles.rowValue}>{gpsAppLabel}</Text>
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
              <View style={styles.rowIconLabel}>
                <Ionicons name="notifications-outline" size={20} color={Colors.text} />
                <Text style={styles.rowLabel}>Rappels de tournee</Text>
              </View>
              <Switch
                value={notifPreferences.appointmentCancelled}
                onValueChange={(v) => updateNotifPref('appointmentCancelled', v)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={notifPreferences.appointmentCancelled ? Colors.primary : Colors.white}
                accessibilityRole="switch"
                accessibilityLabel="Notifications de rappels de tournee"
              />
            </View>
            <Separator />
            <View style={styles.row}>
              <View style={styles.rowIconLabel}>
                <Ionicons name="chatbubble-outline" size={20} color={Colors.text} />
                <Text style={styles.rowLabel}>Messages</Text>
              </View>
              <Switch
                value={notifPreferences.newTransmission}
                onValueChange={(v) => updateNotifPref('newTransmission', v)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={notifPreferences.newTransmission ? Colors.primary : Colors.white}
                accessibilityRole="switch"
                accessibilityLabel="Notifications de messages"
              />
            </View>
          </View>
        </View>

        {/* DECONNEXION */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutCard}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Se deconnecter"
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            <Text style={styles.logoutText}>Deconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={styles.versionText}>Version 2.4.0 (IDEL Planning Pro)</Text>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );
}

/** Settings row with icon */
function SettingsRow({ icon, label, value }: { icon?: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconLabel}>
        {icon && <Ionicons name={icon} size={20} color={Colors.text} />}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
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
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  // Profile row
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  profileRole: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  rowSubtext: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  rowValue: {
    fontSize: 15,
    color: Colors.textSecondary,
    maxWidth: '40%',
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 52,
  },
  // GPS picker
  gpsPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  pickerOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
    minHeight: 44,
    justifyContent: 'center',
  },
  pickerOptionActive: {
    backgroundColor: Colors.primaryUltraLight,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pickerOptionTextActive: {
    color: Colors.primary,
  },
  // Logout
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
  // Version
  versionText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
