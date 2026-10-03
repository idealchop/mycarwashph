import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { createApp, createPublicApp } from "./app.js";
import { FirebaseTokenVerifier } from "./auth/token-verifier.js";
import { brand } from "./config/brand.js";
import { loadConfig } from "./config/env.js";
import type { Deps } from "./deps.js";
import { FirestoreStore } from "./store/firestore-store.js";

const firebaseApp = initializeApp();
const db = getFirestore(firebaseApp);
db.settings({ ignoreUndefinedProperties: true });

const deps: Deps = {
  store: new FirestoreStore(db),
  verifier: new FirebaseTokenVerifier(getAuth(firebaseApp)),
  config: loadConfig(),
  now: () => new Date(),
};

/** Shop web app API. */
export const mycarwashApi = onRequest({ region: brand.region }, createApp(deps));

/** River Mobile partner API (/v1). Served at api.mycarwash.ph in production. */
export const mycarwashPublicApi = onRequest({ region: brand.region }, createPublicApp(deps));
