"use client";

import { useSyncExternalStore } from "react";

/** Partner shops add up to 10 walk-ins per Manila day; Pro and Lifetime are unlimited (limit null). */
export interface WalkInAllowance { used: number; limit: number | null; left: number | null }

const EVENT = "mcw-walkin-limit";
const cache = new Map<string, WalkInAllowance>();

/** Called with the server's count (GET/POST /queue) so every screen shows the same number. */
export function publishWalkIns(shopId: string, a: WalkInAllowance) {
  cache.set(shopId, a);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: shopId }));
}

/** Server limit message when a Partner shop has used today's walk-ins (402 walkin_limit). */
export const WALKIN_LIMIT_CODE = "walkin_limit";

/** "7 of 10 walk-ins left today" for Partner; null label on Pro and Lifetime. */
export function useWalkInAllowance(shopId: string | null | undefined) {
  const a = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    () => (shopId ? cache.get(shopId) ?? null : null),
    () => null,
  );
  const limited = a?.limit != null;
  const left = a?.left ?? null;
  return {
    allowance: a,
    limited,
    atLimit: limited && left === 0,
    label: limited ? `${left} of ${a!.limit} walk-ins left today` : null,
  };
}
