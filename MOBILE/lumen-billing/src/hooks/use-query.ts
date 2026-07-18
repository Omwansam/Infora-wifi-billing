import { useCallback, useEffect, useRef, useState } from 'react';

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Minimal data-fetching hook (no external deps). Runs `fn` on mount and when
 * `deps` change; exposes loading/error and a manual `refetch` for pull-to-
 * refresh. Ignores results from stale runs so fast filter changes don't race.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const runId = useRef(0);

  const run = useCallback(async () => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (id === runId.current) setData(result);
    } catch (e) {
      if (id === runId.current) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run };
}
