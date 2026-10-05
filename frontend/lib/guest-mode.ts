/**
 * Guest browse (River Mobile–style): navigate the shop UI without Firebase Auth.
 * Mutating actions open the auth gate; real shop data is never loaded without a user.
 */

const GUEST_KEY = "mcw_guest";
const RETURN_KEY = "mcw_auth_return";

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

function notifyGuestChange() {
  try {
    window.dispatchEvent(new Event("mcw-guest-change"));
  } catch {
    /* ignore */
  }
}

export function enterGuestMode() {
  try {
    sessionStorage.setItem(GUEST_KEY, "1");
    notifyGuestChange();
  } catch {
    /* ignore */
  }
}

export function clearGuestMode() {
  try {
    sessionStorage.removeItem(GUEST_KEY);
    notifyGuestChange();
  } catch {
    /* ignore */
  }
}

export function setAuthReturnTo(path: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    /* ignore */
  }
}

export function consumeAuthReturnTo(fallback = "/home"): string {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function peekAuthReturnTo(): string | null {
  try {
    return sessionStorage.getItem(RETURN_KEY);
  } catch {
    return null;
  }
}
