"use client";

import { useCallback, useEffect, useState } from "react";

/** Runs an async loader on mount and whenever `key` changes; `reload()` runs it again. */
export function useLoad<T>(loader: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    loader().then(
      (data) => alive && setState({ data, error: null }),
      (err: Error) => alive && setState((s) => ({ data: s.data, error: err.message })),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
