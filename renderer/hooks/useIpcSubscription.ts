/**
 * IPC Subscription Hook
 * Subscribe to IPC events with automatic cleanup
 */

import { useEffect, useRef } from 'react';

/**
 * Subscribe to IPC events with automatic cleanup
 */
export function useIpcSubscription<T>(
  subscribe: (callback: (data: T) => void) => () => void,
  callback: (data: T) => void,
  deps: React.DependencyList = []
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = subscribe((data) => callbackRef.current(data));
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
