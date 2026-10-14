"use client";
/**
 * Guest browse + login-on-action (River Mobile AuthGate pattern, as in Barbers.ph).
 * Guests can open every page. Controls marked `data-auth="action"` (and forms whose
 * submit button is marked) open the sign-in sheet instead of running; once signed in,
 * the same action is replayed so the guest continues where they were.
 */
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { AuthGateSheet } from "./auth-gate-sheet";

type Ctx = {
  isAuthenticated: boolean;
  /** Runs `after` now when signed in; otherwise opens the sheet and runs it after sign-in. */
  requireAuth: (after?: () => void, opts?: { subtitle?: string }) => void;
  openAuth: (opts?: { subtitle?: string; after?: () => void }) => void;
};
const AuthGateContext = createContext<Ctx | null>(null);

export function useAuthGate(): Ctx {
  const v = useContext(AuthGateContext);
  return v ?? { isAuthenticated: true, requireAuth: (after) => after?.(), openAuth: (o) => o?.after?.() };
}

const SELECTOR = '[data-auth="action"]';
/** Pages that only exist to sign in; after login the user goes Home from these. */
const AUTH_PAGES = ["/", "/sign-in", "/welcome"];

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const authed = Boolean(user);
  const authedRef = useRef(authed);
  useEffect(() => { authedRef.current = authed; }, [authed]);
  const [open, setOpen] = useState(false);
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const pending = useRef<(() => void) | null>(null);
  const replaying = useRef(false);

  // Signed in from a sign-in or welcome page: land on Home. Elsewhere stay put.
  useEffect(() => {
    if (authed && AUTH_PAGES.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)))) router.replace("/home");
  }, [authed, pathname, router]);

  const requireAuth = useCallback((after?: () => void, opts?: { subtitle?: string }) => {
    if (authedRef.current) { after?.(); return; }
    pending.current = after ?? null;
    setSubtitle(opts?.subtitle);
    setOpen(true);
  }, []);
  const openAuth = useCallback((opts?: { subtitle?: string; after?: () => void }) => requireAuth(opts?.after, opts), [requireAuth]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (authedRef.current || replaying.current) return;
      const el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
      if (!el || el.closest('[aria-labelledby="auth-gate-title"]')) return;
      if ((el as HTMLButtonElement).disabled) return;
      e.preventDefault();
      e.stopPropagation();
      requireAuth(() => {
        if (!el.isConnected) return;
        replaying.current = true;
        try { el.click(); } finally { replaying.current = false; }
      });
    }
    function onSubmit(e: SubmitEvent) {
      if (authedRef.current || replaying.current) return;
      const form = e.target as HTMLFormElement;
      const sub = e.submitter as HTMLElement | null;
      if (!(sub?.matches(SELECTOR) || form.matches(SELECTOR))) return;
      e.preventDefault();
      e.stopPropagation();
      requireAuth(() => {
        if (!form.isConnected) return;
        replaying.current = true;
        try { form.requestSubmit(sub && sub.isConnected ? (sub as HTMLButtonElement) : undefined); } finally { replaying.current = false; }
      });
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [requireAuth]);

  const close = useCallback(() => { pending.current = null; setOpen(false); }, []);
  const onAuthenticated = useCallback(() => {
    setOpen(false);
    const next = pending.current;
    pending.current = null;
    if (next) requestAnimationFrame(() => requestAnimationFrame(next));
  }, []);

  return (
    <AuthGateContext.Provider value={{ isAuthenticated: authed, requireAuth, openAuth }}>
      {children}
      <AuthGateSheet open={open} subtitle={subtitle} onClose={close} onAuthenticated={onAuthenticated} />
    </AuthGateContext.Provider>
  );
}
