"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type MeResponse } from "./api";
import { useAuth } from "./auth";
import { currentShop } from "./shop";
import { clearCache, lastUid, readCache, writeCache } from "./screen-cache";
import { setStaffLinkToken, useStaffLinkToken } from "./staff-link";

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

  // PWA rule: the last saved /me shows at once (even before Firebase restores the session); /me refreshes it.
  const [cached, setCached] = useState<{ uid: string; me: MeResponse } | null>(null);
  useEffect(() => {
    const u = lastUid();
    const me = readCache<MeResponse>(u, "me");
    const t = window.setTimeout(() => { if (u && me) setCached({ uid: u, me }); }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const staffLink = useStaffLinkToken();
  const linkMode = !uid && !!staffLink;
  const [linkState, setLinkState] = useState<{ token: string; me: MeResponse | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!authLoading && !uid && !staffLink) clearCache();
  }, [authLoading, uid, staffLink]);
  // Staff link device: the link says which shop; role is always staff (server-enforced).
  useEffect(() => {
    if (!linkMode || !staffLink) return;
    let alive = true;
    api<{ data: { name: string; uid: string; business: MeResponse["businesses"][number] } }>("/public/staff-link").then(
      (r) => alive && setLinkState({ token: staffLink, error: null, me: { user: { uid: r.data.uid, phoneNumber: null, email: null, name: r.data.name }, businesses: [r.data.business] } as MeResponse }),
      (err: Error & { status?: number }) => {
        if (!alive) return;
        if (err.status === 404 || err.status === 401) setStaffLinkToken(null); // reset or turned off
        setLinkState({ token: staffLink, me: null, error: err.message });
      },
    );
    return () => { alive = false; };
  }, [linkMode, staffLink, version]);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    api<MeResponse>("/me").then(
      (me) => { if (!alive) return; setState({ uid, me, error: null }); writeCache(uid, "me", me); },
      (err: Error) => alive && setState((s) => ({ ...s, uid, error: err.message })),
    );
    return () => {
      alive = false;
    };
  }, [uid, version]);

  const value = useMemo<Ctx>(() => {
    if (linkMode) {
      const me = linkState?.token === staffLink ? linkState.me : null;
      return { loading: !me && !(linkState?.token === staffLink && linkState.error), signedIn: true, me, shop: me?.businesses[0] ?? null, error: linkState?.error ?? null, reload: () => setVersion((v) => v + 1) };
    }
    const fresh = uid && state.uid === uid ? state.me : null;
    // Cached copy: while auth restores (assume the same user) or for the signed-in user until /me answers.
    const fromCache = cached && (authLoading || cached.uid === uid) ? cached.me : null;
    const me = fresh ?? fromCache;
    const saved = currentShop.get();
    const shop = me?.businesses.find((b) => b.id === saved) ?? me?.businesses[0] ?? null;
    return {
      loading: !me && (authLoading || (!!uid && !(state.uid === uid && state.error))),
      signedIn: !!uid || (authLoading && !!fromCache),
      me,
      shop,
      error: uid && state.uid === uid ? state.error : null,
      reload: () => setVersion((v) => v + 1),
    };
  }, [authLoading, uid, state, cached, linkMode, linkState, staffLink]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
