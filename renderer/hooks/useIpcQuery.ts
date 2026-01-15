/**
 * IPC Query Hook
 * Query data via IPC with loading/error states
 */

import { useState, useEffect, useCallback } from 'react';
import type { IpcResult } from '../../shared/types';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Query data via IPC with loading/error states
 */
export function useIpcQuery<T>(
  queryFn: () => Promise<IpcResult<T>>,
  deps: React.DependencyList = []
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await queryFn();
      if (result.success) {
        setData(result.data ?? null);
      } else {
        setError(result.error?.message ?? 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
