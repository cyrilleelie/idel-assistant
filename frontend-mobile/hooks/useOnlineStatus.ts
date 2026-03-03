import { useEffect, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSyncStore } from '@/stores/syncStore';
import { globalQueue } from '@/services/globalQueue';
import { api } from '@/services/api';

/**
 * Monitors network connectivity via NetInfo.
 * Updates syncStore.isOnline and triggers offline queue processing
 * when transitioning from offline to online.
 *
 * Returns the current online status for convenience (e.g., OfflineBanner).
 */
export function useOnlineStatus(): { isOnline: boolean } {
  const isOnline = useSyncStore((s) => s.isOnline);
  const setOnline = useSyncStore((s) => s.setOnline);
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? false;
      const previouslyOnline = wasOnlineRef.current;

      setOnline(connected);
      wasOnlineRef.current = connected;

      // Transition from offline to online: process pending queue
      if (!previouslyOnline && connected) {
        globalQueue.processQueue(api).catch(() => {
          // Queue processing errors are handled internally
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [setOnline]);

  return { isOnline };
}
