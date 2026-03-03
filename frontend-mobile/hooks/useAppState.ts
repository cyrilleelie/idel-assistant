import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSecurityStore } from '@/stores/securityStore';

/**
 * Monitors React Native AppState transitions (active / background / inactive).
 *
 * On background: records last activity timestamp for lock timeout calculation.
 * On foreground: checks whether the elapsed time exceeds the lock timeout
 * and locks the app if necessary.
 */
export function useAppState(): void {
  const updateLastActivity = useSecurityStore((s) => s.updateLastActivity);
  const lock = useSecurityStore((s) => s.lock);
  const checkShouldLock = useSecurityStore((s) => s.checkShouldLock);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const previousState = appStateRef.current;

        if (nextAppState === 'background' || nextAppState === 'inactive') {
          // Going to background: record the current time
          updateLastActivity();
        }

        if (
          (previousState === 'background' || previousState === 'inactive') &&
          nextAppState === 'active'
        ) {
          // Returning to foreground: check if we should lock
          if (checkShouldLock()) {
            lock();
          }
        }

        appStateRef.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [updateLastActivity, lock, checkShouldLock]);
}
