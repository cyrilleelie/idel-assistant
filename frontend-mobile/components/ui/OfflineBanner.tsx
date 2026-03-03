// Status bar showing connectivity and sync state (hidden when fully synced)

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useSyncStore } from '@/stores/syncStore';
import { Colors } from '@/constants/colors';

const BANNER_HEIGHT = 32;
const FADE_DURATION_MS = 800;
const SYNCED_VISIBLE_MS = 2000;

export default function OfflineBanner() {
  const isOnline = useSyncStore((s) => s.isOnline);
  const pendingCount = useSyncStore((s) => s.pendingOperationsCount);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show synced indicator briefly, then fade out
  useEffect(() => {
    if (isOnline && pendingCount === 0) {
      // Flash "Synchronise" then fade
      fadeAnim.setValue(1);
      syncedTimerRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: FADE_DURATION_MS,
          useNativeDriver: true,
        }).start();
      }, SYNCED_VISIBLE_MS);
    } else {
      // Show banner immediately for offline or pending states
      if (syncedTimerRef.current != null) {
        clearTimeout(syncedTimerRef.current);
      }
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (syncedTimerRef.current != null) {
        clearTimeout(syncedTimerRef.current);
      }
    };
  }, [isOnline, pendingCount, fadeAnim]);

  // Determine display state
  let backgroundColor: string;
  let message: string;

  if (!isOnline) {
    backgroundColor = Colors.error;
    message = 'Hors connexion';
  } else if (pendingCount > 0) {
    backgroundColor = Colors.warning;
    message = `${pendingCount} operation${pendingCount > 1 ? 's' : ''} en attente`;
  } else {
    backgroundColor = Colors.success;
    message = 'Synchronise';
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor, opacity: fadeAnim },
      ]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
});
