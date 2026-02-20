import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { theme } from '../utils/colors';
import type { MapData } from '../types/models';

interface TourneeMapProps {
  mapData: MapData;
}

export function TourneeMap({ mapData }: TourneeMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (mapData.stops.length > 0 && mapRef.current) {
      const coords = mapData.stops.map((s) => ({
        latitude: s.lat,
        longitude: s.lon,
      }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    }
  }, [mapData.stops]);

  if (mapData.stops.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucun rendez-vous aujourd'hui</Text>
      </View>
    );
  }

  const polylineCoords = mapData.stops.map((s) => ({
    latitude: s.lat,
    longitude: s.lon,
  }));

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={{
        latitude: mapData.center_lat,
        longitude: mapData.center_lon,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
    >
      {mapData.stops.map((stop, index) => (
        <Marker
          key={index}
          coordinate={{ latitude: stop.lat, longitude: stop.lon }}
          title={`${index + 1}. ${stop.patient_name}`}
          description={`${stop.time} - ${stop.care_type}`}
          pinColor={stop.sector_color || theme.primary}
        />
      ))}
      <Polyline
        coordinates={polylineCoords}
        strokeColor={theme.primary}
        strokeWidth={3}
        lineDashPattern={[8, 4]}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
});
