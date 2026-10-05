"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { isGuestMode } from "@/lib/guest-mode";
import { Spinner } from "./screen";

function subscribeGuest(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("mcw-guest-change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("mcw-guest-change", cb);
  };
}

function getGuestSnapshot() {
  return isGuestMode();
}

/**
 * River Mobile–style browse gate: signed-in users and guests may view shop screens.
 * Unauthenticated non-guests go to the welcome screen. The API still enforces auth
 * on every mutating call.
 */
export function BrowseGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const guest = useSyncExternalStore(subscribeGuest, getGuestSnapshot, () => false);

  useEffect(() => {
    if (!loading && !user && !guest) router.replace("/");
  }, [loading, user, guest, router]);

  if (loading || (!user && !guest)) return <Spinner />;
  return <>{children}</>;
}
