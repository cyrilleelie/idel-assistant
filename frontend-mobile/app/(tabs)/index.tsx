import React from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import { useTournee } from '../../src/hooks/useTournee';
import { TourneeMap } from '../../src/components/TourneeMap';
import { MetricsBar } from '../../src/components/MetricsBar';
import { AppointmentItem } from '../../src/components/AppointmentItem';
import { theme } from '../../src/utils/colors';
import type { MapStop } from '../../src/types/models';

const MAP_HEIGHT = Dimensions.get('window').height * 0.35;

export default function TourneeScreen() {
  const { tournee, map, isLoading, isError, refetch } = useTournee();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Chargement de la tournee...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Impossible de charger la tournee</Text>
        <Text style={styles.errorSubtext}>Verifiez votre connexion</Text>
        <Button mode="contained" onPress={() => refetch()} style={{ marginTop: 12 }} buttonColor={theme.primary}>
          Reessayer
        </Button>
      </View>
    );
  }

  const stops: MapStop[] = map?.stops || [];

  return (
    <View style={styles.container}>
      <View style={{ height: MAP_HEIGHT }}>
        {map ? (
          <TourneeMap mapData={map} />
        ) : (
          <View style={styles.emptyMap}>
            <Text style={styles.emptyText}>Aucun rendez-vous aujourd'hui</Text>
          </View>
        )}
      </View>

      {tournee?.metrics && <MetricsBar metrics={tournee.metrics} />}

      {tournee?.inefficiencies && tournee.inefficiencies.length > 0 && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>
            {tournee.inefficiencies[0]}
          </Text>
        </View>
      )}

      <FlatList
        data={stops}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item, index }) => (
          <AppointmentItem stop={item} index={index} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refetch()}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>Aucun rendez-vous pour aujourd'hui</Text>
            <Text style={styles.emptySubtext}>
              Allez dans l'onglet Suggestion pour planifier
            </Text>
          </View>
        }
        contentContainerStyle={stops.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 12,
    color: theme.textSecondary,
    fontSize: 15,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.error,
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  emptyMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FE',
  },
  alertBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  alertText: {
    fontSize: 14,
    color: '#92400E',
  },
  emptyList: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
