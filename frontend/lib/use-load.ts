"use client";

import { useCallback, useEffect, useState } from "react";
import { firebaseAuth } from "./firebase";
import { lastUid, readCache, writeCache } from "./screen-cache";

const cacheable = (key: string) => !key.endsWith("-none");
const uidNow = () => firebaseAuth().currentUser?.uid ?? lastUid();

/**
 * Runs an async loader on mount and whenever `key` changes; `reload()` runs it again.
 * PWA rule: the last saved result for `key` shows at once and the loader refreshes it in the background.
 * Errors keep the data already on screen.
 */
export function useLoad<T>(loader: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    if (cacheable(key)) {
      const cached = readCache<T>(uidNow(), `load.${key}`);
      if (cached != null) queueMicrotask(() => alive && setState((s) => (s.key === key && s.data != null ? s : { key, data: cached, error: null })));
    }
    loader().then(
      (data) => {
        if (!alive) return;
        setState({ key, data, error: null });
        if (cacheable(key) && data != null) writeCache(firebaseAuth().currentUser?.uid ?? null, `load.${key}`, data);
      },
      (err: Error) => alive && setState((s) => ({ key, data: s.key === key ? s.data : null, error: err.message })),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : null, reload };
}
