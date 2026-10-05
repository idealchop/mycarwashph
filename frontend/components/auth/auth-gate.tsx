"use client";

import { Button } from "@river-apps/ui";
import { Smartphone, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GoogleG } from "@/components/brand";
import { authErrorMessage, signInWithGoogle, useAuth } from "@/lib/auth";
import { clearGuestMode, setAuthReturnTo } from "@/lib/guest-mode";

type Pending = (() => void) | null;

type AuthGateContextValue = {
  /** If signed in, runs `action` immediately; otherwise opens the login sheet and runs it after success. */
  requireAuth: (action?: () => void, opts?: { subtitle?: string }) => void;
  openAuth: (opts?: { subtitle?: string; after?: () => void }) => void;
  isAuthenticated: boolean;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

/**
 * Mirrors River Mobile `useAuthGate` + `AuthGateSheet`: browse as guest;
 * mutating actions open a sign-in sheet and resume after login.
 */
export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [wantOpen, setWantOpen] = useState(false);
  const [subtitle, setSubtitle] = useState("Sign in to manage bookings, scan customers, and save changes.");
  const pendingRef = useRef<Pending>(null);
  const prevUser = useRef(user);

  // When auth flips from signed-out → signed-in, clear guest and resume pending action.
  useEffect(() => {
    const was = prevUser.current;
    prevUser.current = user;
    if (!was && user) {
      clearGuestMode();
      setWantOpen(false);
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next) requestAnimationFrame(() => next());
    }
  }, [user]);

  const open = wantOpen && !user;

  const openAuth = useCallback(
    (opts?: { subtitle?: string; after?: () => void }) => {
      if (user) {
        opts?.after?.();
        return;
      }
      pendingRef.current = opts?.after ?? null;
      if (opts?.subtitle) setSubtitle(opts.subtitle);
      setAuthReturnTo(pathname || "/home");
      setWantOpen(true);
    },
    [user, pathname],
  );

  const requireAuth = useCallback(
    (action?: () => void, opts?: { subtitle?: string }) => {
      if (user) {
        action?.();
        return;
      }
      openAuth({ subtitle: opts?.subtitle, after: action });
    },
    [user, openAuth],
  );

  const onClose = useCallback(() => {
    setWantOpen(false);
    pendingRef.current = null;
  }, []);

  return (
    <AuthGateContext.Provider value={{ requireAuth, openAuth, isAuthenticated: !!user }}>
      {children}
      <LoginGateModal open={open} subtitle={subtitle} onClose={onClose} />
    </AuthGateContext.Provider>
  );
}

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within AuthGateProvider");
  return ctx;
}

function LoginGateModal({ open, subtitle, onClose }: { open: boolean; subtitle: string; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function google() {
    setBusy(true);
    setError(null);
    try {
      setAuthReturnTo(pathname || "/home");
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  function phone() {
    setAuthReturnTo(pathname || "/home");
    onClose();
    router.push(`/sign-in/phone?next=${encodeURIComponent(pathname || "/home")}`);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="auth-gate-title">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[28px] bg-white shadow-card sm:rounded-[28px]">
        <div className="relative flex items-center justify-center bg-ink px-5 pb-8 pt-7">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/20 text-white"
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
          <b className="text-[15px] font-extrabold tracking-tight text-white">Mycarwash.ph</b>
        </div>
        <div className="px-6 pb-7 pt-5">
          <h2 id="auth-gate-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
            Sign up or log in
          </h2>
          <p className="mt-1.5 text-[13.5px] font-medium text-muted">{subtitle}</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <Button fullWidth leadingIcon={<Smartphone size={20} strokeWidth={1.75} />} onClick={phone} disabled={busy}>
              Continue with phone number
            </Button>
            <Button fullWidth variant="secondary" leadingIcon={<GoogleG />} onClick={() => void google()} disabled={busy}>
              Continue with Google
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-center text-[13.5px] font-semibold">
              {error}
            </p>
          ) : null}
          <p className="mt-4 text-center text-[12.5px] font-medium text-muted">You can keep browsing the preview after you close this.</p>
        </div>
      </div>
    </div>
  );
}
