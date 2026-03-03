import { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

/**
 * Tournee tab placeholder. Shows an empty state with a pull-to-refresh
 * that triggers data synchronization.
 *
 * Note: performSync requires database and apiClient args which will be
 * wired in the M2 iteration when the full sync engine is connected.
 * For now, the refresh simulates a sync delay.
 */
export default function TourneeScreen() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // TODO (M2): wire up performSync(database, apiClient) when WatermelonDB
      // database instance and authenticated API client are injected via context
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      <View style={styles.emptyState}>
        <View style={styles.iconContainer}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>Tournée du jour</Text>
        <Text style={styles.emptySubtitle}>
          L'écran de tournée sera implémenté dans l'itération M2
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 280,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
