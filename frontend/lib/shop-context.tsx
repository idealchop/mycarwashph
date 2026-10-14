"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type MeResponse } from "./api";
import { useAuth } from "./auth";
import { currentShop } from "./shop";

type Shop = MeResponse["businesses"][number];
type Ctx = {
  /** True until Firebase Auth has resolved (and /me has loaded for signed-in users). */
  loading: boolean;
  signedIn: boolean;
  me: MeResponse | null;
  shop: Shop | null;
  error: string | null;
  reload: () => void;
};

const ShopContext = createContext<Ctx>({ loading: true, signedIn: false, me: null, shop: null, error: null, reload: () => {} });

/** Loads /me once for every shop page. Guests get no shop and no requests. */
export function ShopProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{ uid: string | null; me: MeResponse | null; error: string | null }>({ uid: null, me: null, error: null });
  const [version, setVersion] = useState(0);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    api<MeResponse>("/me").then(
      (me) => alive && setState({ uid, me, error: null }),
      (err: Error) => alive && setState((s) => ({ ...s, uid, error: err.message })),
    );
    return () => {
      alive = false;
    };
  }, [uid, version]);

  const value = useMemo<Ctx>(() => {
    const me = uid && state.uid === uid ? state.me : null;
    const saved = currentShop.get();
    const shop = me?.businesses.find((b) => b.id === saved) ?? me?.businesses[0] ?? null;
    return {
      loading: authLoading || (!!uid && !me && !(state.uid === uid && state.error)),
      signedIn: !!uid,
      me,
      shop,
      error: uid && state.uid === uid ? state.error : null,
      reload: () => setVersion((v) => v + 1),
    };
  }, [authLoading, uid, state]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
