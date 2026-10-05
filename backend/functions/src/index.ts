import type { Request, Response } from "express";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { createApp, createPublicApp } from "./app.js";
import { FirebaseTokenVerifier } from "./auth/token-verifier.js";
import { brand } from "./config/brand.js";
import { loadConfig } from "./config/env.js";
import { APP_HOSTING_SERVICE_ACCOUNT, ENVIRONMENTS, type EnvName } from "./config/environments.js";
import type { Deps } from "./deps.js";
import { FirestoreStore } from "./store/firestore-store.js";

const firebaseApp = initializeApp();

const peppers = {
  dev: defineSecret(ENVIRONMENTS.dev.pepperSecret),
  prod: defineSecret(ENVIRONMENTS.prod.pepperSecret),
};

/** Reads the secret at request time; the emulator falls back to a local value. */
function pepper(env: EnvName): string {
  try {
    const value = peppers[env].value();
    if (value) return value;
  } catch {
    // not available (emulator without .secret.local)
  }
  if (process.env.FUNCTIONS_EMULATOR === "true") return process.env.API_KEY_PEPPER ?? "local-dev-pepper";
  throw new Error(`Secret ${ENVIRONMENTS[env].pepperSecret} is not configured.`);
}

const depsCache = new Map<EnvName, Deps>();

/** Builds dependencies once per instance, bound to that environment's Firestore database. */
function depsFor(env: EnvName): Deps {
  let deps = depsCache.get(env);
  if (!deps) {
    const def = ENVIRONMENTS[env];
    const db = getFirestore(firebaseApp, def.databaseId);
    db.settings({ ignoreUndefinedProperties: true });
    deps = {
      store: new FirestoreStore(db),
      verifier: new FirebaseTokenVerifier(getAuth(firebaseApp)),
      config: loadConfig({ allowedOrigins: def.allowedOrigins, apiKeyPepper: pepper(env) }),
      now: () => new Date(),
    };
    depsCache.set(env, deps);
  }
  return deps;
}

type Handler = (req: Request, res: Response) => void;

function lazy(build: () => Handler): Handler {
  let handler: Handler | null = null;
  return (req, res) => {
    handler ??= build();
    handler(req, res);
  };
}

/** Shop API: private, invoked only by the App Hosting backend's /api proxy (org policy forbids allUsers). */
function shopApi(env: EnvName) {
  return onRequest(
    { region: brand.region, invoker: [APP_HOSTING_SERVICE_ACCOUNT], secrets: [peppers[env]], memory: "256MiB", maxInstances: 10 },
    lazy(() => createApp(depsFor(env)) as unknown as Handler),
  );
}

/** Partner API (/v1): private; only App Hosting /v1 proxy may invoke (org policy forbids allUsers). */
function partnerApi(env: EnvName) {
  return onRequest(
    { region: brand.region, invoker: [APP_HOSTING_SERVICE_ACCOUNT], secrets: [peppers[env]], memory: "256MiB", maxInstances: 10 },
    lazy(() => createPublicApp(depsFor(env)) as unknown as Handler),
  );
}

/** Shop web app API, dev database. */
export const mycarwashApiDev = shopApi("dev");
/** River Mobile partner API (/v1), dev database. */
export const mycarwashPublicApiDev = partnerApi("dev");
/** Shop web app API, prod database. */
export const mycarwashApiProd = shopApi("prod");
/** River Mobile partner API (/v1), prod database. */
export const mycarwashPublicApiProd = partnerApi("prod");
