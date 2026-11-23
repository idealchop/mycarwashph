import type { Request, Response } from "express";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { GoogleAuth } from "google-auth-library";
import { createApp, createPublicApp } from "./app.js";
import { FirebaseTokenVerifier } from "./auth/token-verifier.js";
import { brand } from "./config/brand.js";
import { loadConfig } from "./config/env.js";
import { APP_HOSTING_SERVICE_ACCOUNT, ENVIRONMENTS, type EnvName } from "./config/environments.js";
import type { Deps } from "./deps.js";
import { VertexCompanionModel } from "./services/companion/model.js";
import { runWeeklyCompanion } from "./services/companion/tips-service.js";
import { FirebasePhotoStore } from "./services/photo-store.js";
import { FirestoreStore } from "./store/firestore-store.js";
import type { Booking } from "./models/types.js";
import type { DocStore } from "./store/doc-store.js";
import { googleOidcVerifier } from "./river/bridge-kit/index.js";
import { logAudit, RIVER_SECRET_NAMES, riverEnv, type RiverAuthConfig } from "./river/config.js";
import { FirestoreNonceStore } from "./river/nonce-store.js";
import { deliverWebhook, webhookEventFor } from "./river/webhooks.js";

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
      config: loadConfig({ allowedOrigins: def.allowedOrigins, apiKeyPepper: pepper(env), envName: env, companionEnabled: def.companionEnabled, devTools: def.devTools }),
      ai: new VertexCompanionModel(),
      now: () => new Date(),
      photos: new FirebasePhotoStore(getStorage(firebaseApp).bucket(process.env.SHOP_PHOTOS_BUCKET || "mycarwashph.firebasestorage.app")),
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

/**
 * River Bridge secrets (Secret Manager on mycarwashph). Dev only: they are bound to
 * the dev partner API and the dev webhook trigger, never to a prod function.
 */
const riverSecrets = {
  requestV1: defineSecret(RIVER_SECRET_NAMES.requestV1),
  requestV2: defineSecret(RIVER_SECRET_NAMES.requestV2),
  webhookV1: defineSecret(RIVER_SECRET_NAMES.webhookV1),
  webhookV2: defineSecret(RIVER_SECRET_NAMES.webhookV2),
};

const secretValue = (s: ReturnType<typeof defineSecret>) => {
  try {
    return s.value() || "";
  } catch {
    return "";
  }
};

/**
 * /v1 two-factor config. Prod has none yet, so the prod partner API answers 401 to
 * everything except /v1/health (fail closed) until River Mobile goes live on prod.
 */
function riverAuthFor(env: EnvName, store: DocStore): RiverAuthConfig | undefined {
  if (env !== "dev") return undefined;
  const cfg = riverEnv();
  return {
    audience: cfg.audience,
    allowedEmails: cfg.allowedEmails,
    secrets: [
      { keyId: cfg.requestKeyIds[0], secret: secretValue(riverSecrets.requestV1) },
      { keyId: cfg.requestKeyIds[1], secret: secretValue(riverSecrets.requestV2) },
    ].filter((s) => s.secret),
    scopes: cfg.scopes,
    clientId: cfg.clientId,
    requireHttps: process.env.FUNCTIONS_EMULATOR !== "true",
    oidc: googleOidcVerifier(),
    nonces: new FirestoreNonceStore(store),
    onAudit: logAudit,
  };
}

/** Partner API (/v1): private; only App Hosting /v1 proxy may invoke (org policy forbids allUsers). */
function partnerApi(env: EnvName) {
  const secrets = env === "dev" ? [peppers[env], riverSecrets.requestV1, riverSecrets.requestV2] : [peppers[env]];
  return onRequest(
    { region: brand.region, invoker: [APP_HOSTING_SERVICE_ACCOUNT], secrets, memory: "256MiB", maxInstances: 10 },
    lazy(() => {
      const deps = depsFor(env);
      return createPublicApp({ ...deps, river: riverAuthFor(env, deps.store) }) as unknown as Handler;
    }),
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

/** Firestore store for scheduled jobs (no secrets needed). */
function jobStore(env: EnvName) {
  const db = getFirestore(firebaseApp, ENVIRONMENTS[env].databaseId);
  return new FirestoreStore(db);
}

/**
 * AI Companion Monday tips, 07:00 Asia/Manila. Prod is guarded: unless
 * ENVIRONMENTS.prod.companionEnabled (COMPANION_ENABLED=1 or INSIGHTS_PROD_ENABLED=true) the job logs
 * and exits without reading shops or calling Gemini.
 */
function weeklyTips(env: EnvName) {
  return onSchedule(
    { schedule: "0 7 * * 1", timeZone: brand.timeZone, region: brand.region, memory: "512MiB", timeoutSeconds: 540, maxInstances: 1, retryCount: 0 },
    async () => {
      if (!ENVIRONMENTS[env].companionEnabled) {
        logger.info("companion_weekly_disabled", { env });
        return;
      }
      await runWeeklyCompanion(jobStore(env), new VertexCompanionModel(), { now: new Date(), env });
    },
  );
}

/** AI Companion weekly tips, dev database. */
export const mycarwashCompanionWeeklyDev = weeklyTips("dev");
/** AI Companion weekly tips, prod database (guarded off until approved). */
export const mycarwashCompanionWeeklyProd = weeklyTips("prod");

/**
 * River Mobile status webhooks, dev database only. Fires on booking updates (no
 * polling); sends order.<status> to {RIVER_DEV_BRIDGE_BASE_URL}/hooks/carwash signed
 * with this function's service-account OIDC token + the webhook HMAC. Bounded
 * in-process retries; outcome in river_webhook_deliveries/{eventId}.
 */
export const mycarwashRiverWebhookDev = onDocumentUpdated(
  {
    document: "businesses/{businessId}/bookings/{bookingId}",
    database: ENVIRONMENTS.dev.databaseId,
    region: brand.region,
    secrets: [riverSecrets.webhookV1, riverSecrets.webhookV2],
    retry: false,
    memory: "256MiB",
    timeoutSeconds: 60,
    maxInstances: 5,
  },
  async (event) => {
    const now = new Date();
    const ev = webhookEventFor(
      event.data?.before.data() as Booking | undefined,
      event.data?.after.data() as Booking | undefined,
      { businessId: event.params.businessId, bookingId: event.params.bookingId },
      now,
    );
    if (!ev) return;
    const cfg = riverEnv();
    const secret = secretValue(cfg.webhookActive === 1 ? riverSecrets.webhookV2 : riverSecrets.webhookV1);
    const auth = new GoogleAuth();
    await deliverWebhook(jobStore("dev"), { url: cfg.webhookUrl, keyId: cfg.webhookKeyIds[cfg.webhookActive], secret }, ev, {
      mintIdToken: async (audience) => (await auth.getIdTokenClient(audience)).idTokenProvider.fetchIdToken(audience),
      fetch: async (url, init) => {
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), redirect: "manual" });
        return { status: res.status };
      },
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => new Date(),
    });
  },
);
