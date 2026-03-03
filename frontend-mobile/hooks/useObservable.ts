import { useState, useEffect } from 'react';

/**
 * Minimal interface for WatermelonDB observables.
 *
 * WatermelonDB returns RxJS-like observables from .observe() calls.
 * We type only the subset we use (subscribe) to avoid pulling in
 * RxJS types and to keep this hook compatible with any observable
 * that follows this contract.
 */
interface WatermelonObservable<T> {
  subscribe(observer: {
    next: (value: T) => void;
    error?: (err: unknown) => void;
  }): { unsubscribe: () => void };
}

/**
 * Subscribes to a WatermelonDB observable and returns its current value
 * as React state. Cleans up the subscription when the component unmounts
 * or when the observable reference changes.
 *
 * Usage:
 *   const appointments = useObservable(
 *     database.get('appointments').query(...).observe(),
 *     [],
 *   );
 *
 * @param observable    - A WatermelonDB observable (from .observe() calls)
 * @param initialValue  - Value to use before the first emission
 */
export function useObservable<T>(
  observable: WatermelonObservable<T>,
  initialValue: T,
): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const subscription = observable.subscribe({
      next: (newValue: T) => {
        setValue(newValue);
      },
      error: () => {
        // Observable errors are swallowed; the initial value is retained.
        // In production, consider logging to an error reporting service.
      },
    });

    return () => {
      subscription.unsubscribe();
    };
    // observable reference is the dependency: if the query changes,
    // we re-subscribe. The caller must memoize if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observable]);

  return value;
}
