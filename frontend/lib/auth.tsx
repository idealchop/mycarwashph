"use client";

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { firebaseAuth } from "./firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  useEffect(() => onAuthStateChanged(firebaseAuth(), (user) => setState({ user, loading: false })), []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/* ---------- Phone (SMS code) sign-in ---------- */

// Kept in memory between the phone-number and code screens (client-side navigation).
let pending: { phoneE164: string; confirmation: ConfirmationResult; sentAt: number } | null = null;
let verifier: RecaptchaVerifier | null = null;

/** Sends the SMS code using an invisible reCAPTCHA attached to the Send button. */
export async function sendPhoneCode(phoneE164: string, buttonId: string) {
  const auth = firebaseAuth();
  verifier?.clear();
  verifier = new RecaptchaVerifier(auth, buttonId, { size: "invisible" });
  const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
  pending = { phoneE164, confirmation, sentAt: Date.now() };
}

export const pendingPhone = () => pending;

export async function confirmPhoneCode(code: string) {
  if (!pending) throw new Error("Your code expired. Please request a new one.");
  await pending.confirmation.confirm(code);
  pending = null;
}

/* ---------- Google sign-in ---------- */

/** Popup on desktop; redirect on phones where popups are often blocked. */
export async function signInWithGoogle() {
  const auth = firebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const isPhone = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  if (isPhone) await signInWithRedirect(auth, provider);
  else await signInWithPopup(auth, provider);
}

export const signOut = () => fbSignOut(firebaseAuth());

/** Friendly messages for common Firebase Auth errors. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("invalid-verification-code")) return "That code is not right. Please check and try again.";
  if (code.includes("code-expired")) return "That code expired. Please request a new one.";
  if (code.includes("invalid-phone-number")) return "Please enter a valid PH mobile number.";
  if (code.includes("too-many-requests")) return "Too many tries. Please wait a few minutes.";
  if (code.includes("popup-closed")) return "Google sign-in was closed before finishing.";
  if (code.includes("network-request-failed")) return "No connection. Check your internet and try again.";
  return "Something went wrong. Please try again.";
}
