"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

/**
 * Firebase web config comes from NEXT_PUBLIC_* env vars (see frontend/.env.example).
 * Defaults target the local emulators with the offline `demo-mycarwash` project,
 * so the app runs without any real Firebase project.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo-mycarwash.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-mycarwash",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:000000000000:web:0000000000000000000000",
};

export const useEmulators = (process.env.NEXT_PUBLIC_USE_EMULATORS ?? "true") === "true";
const authEmulatorUrl = process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL ?? "http://127.0.0.1:9099";

let auth: Auth | null = null;

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export function firebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(firebaseApp());
  auth.languageCode = "en";
  if (useEmulators) {
    connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
    // The Auth emulator does not verify reCAPTCHA; real projects do (invisible verifier).
    auth.settings.appVerificationDisabledForTesting = true;
  }
  return auth;
}
