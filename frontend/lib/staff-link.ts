"use client";

import { useSyncExternalStore } from "react";

/**
 * Staff link (Barbers.ph barber link): staff open /s/{token} and use the shop with no account.
 * The token lives only on this device; the server checks it on every request (X-Staff-Link).
 */
const KEY = "mycarwash.staffLink";
const listeners = new Set<() => void>();

export function staffLinkToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}

export function setStaffLinkToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function useStaffLinkToken() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); window.addEventListener("storage", l); return () => { listeners.delete(l); window.removeEventListener("storage", l); }; },
    staffLinkToken,
    () => null,
  );
}

export const staffLinkPath = (token: string) => `/s/${encodeURIComponent(token)}`;
