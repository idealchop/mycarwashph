"use client";

/**
 * Last-seen screen data (Jimboy's PWA rule): when the installed app opens, show the last saved data at once
 * and refresh in the background. Stored per signed-in user in localStorage; small JSON only.
 */
const PREFIX = "mcw.cache.";
const LAST_UID = "mcw.cache.uid";

const ls = () => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };

/** The user whose data is cached (lets the first paint use it before Firebase Auth restores the session). */
export const lastUid = () => ls()?.getItem(LAST_UID) ?? null;

export function readCache<T>(uid: string | null, key: string): T | null {
  if (!uid) return null;
  try { const raw = ls()?.getItem(`${PREFIX}${uid}.${key}`); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

export function writeCache(uid: string | null, key: string, data: unknown) {
  if (!uid) return;
  try { ls()?.setItem(LAST_UID, uid); ls()?.setItem(`${PREFIX}${uid}.${key}`, JSON.stringify(data)); } catch { /* full or private mode */ }
}

/** Signed out: forget every cached screen. */
export function clearCache() {
  const s = ls();
  if (!s) return;
  try { for (const k of Object.keys(s)) if (k.startsWith(PREFIX)) s.removeItem(k); } catch { /* ignore */ }
}
