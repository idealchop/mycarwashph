/**
 * River Bridge prod-key checklist (bridge-kit/conformance/checklist.ts), run against
 * the real Mycarwash /v1 app instead of the kit's reference server: createPublicApp
 * with the vendored verifier, the Firestore-style shared nonce store (on an
 * in-memory DocStore), test-only secrets and a stand-in for Google's OIDC check.
 * Each check sends real HTTP requests to a local listener.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, createPublicApp } from "../src/app.js";
import type { AuthUser, TokenVerifier } from "../src/auth/token-verifier.js";
import type { Deps } from "../src/deps.js";
import { AUTH_LEAK_PATTERN, MemoryNonceStore, signRequest, verifyRequest, type AuthAudit, type OidcVerifier } from "../src/river/bridge-kit/index.js";
import { DEFAULT_SCOPES, DEV_AUDIENCE, PROD_AUDIENCE, RIVER_SECRET_NAMES, type RiverAuthConfig } from "../src/river/config.js";
import { FirestoreNonceStore } from "../src/river/nonce-store.js";
import { deliverWebhook, webhookEventFor, type WebhookTransport } from "../src/river/webhooks.js";
import type { ApiScope, Booking } from "../src/models/types.js";
import { MemoryStore } from "../src/store/memory-store.js";

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

// Test-only values, never real secrets.
const BRIDGE_EMAIL = "river-bridge-dev@rivermobile-dev.iam.gserviceaccount.com";
const OTHER_EMAIL = "someone-else@other-project.iam.gserviceaccount.com";
const CARWASH_SA = "carwash-runtime@mycarwashph.iam.gserviceaccount.com";
const REQUEST_V1 = "bridge-to-carwash-dev-v1";
const REQUEST_V2 = "bridge-to-carwash-dev-v2";
const REQUEST_RETIRED = "bridge-to-carwash-dev-v0";
const SECRET_V1: string = "conformance-request-secret-v1";
const SECRET_V2 = "conformance-request-secret-v2";
const WEBHOOK_KEY = "carwash-to-bridge-dev-v1";
const WEBHOOK_SECRET = "conformance-webhook-secret-different";
const HOOK_URL = "https://asia-southeast1-rivermobile-dev.cloudfunctions.net/bridge/hooks/carwash";

function fakeJwt(payload: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(payload)}.sig`;
}

/** Same contract as google-auth-library verifyIdToken: aud must equal the expected audience. */
const testOidc: OidcVerifier = {
  async verify(idToken, audience) {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { aud?: string; email?: string };
    if (!payload.email || payload.aud !== audience) throw new Error("oidc");
    return { email: payload.email, audience };
  },
};

class OwnerVerifier implements TokenVerifier {
  async verify(token: string): Promise<AuthUser> {
    const [, uid] = token.split(":");
    return { uid: uid ?? "owner", phoneNumber: "+639171234567", email: "owner@example.com", name: "Owner", platformAdmin: false };
  }
}

async function listen(handler: Parameters<typeof createServer>[1]) {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

function generic(body: string): boolean {
  return !AUTH_LEAK_PATTERN.test(body);
}

export async function runAppConformance(): Promise<Check[]> {
  const checks: Check[] = [];
  const push = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

  const store = new MemoryStore();
  const audits: AuthAudit[] = [];
  const river = (extra: Partial<RiverAuthConfig> = {}): RiverAuthConfig => ({
    audience: DEV_AUDIENCE,
    allowedEmails: [BRIDGE_EMAIL],
    secrets: [
      { keyId: REQUEST_V1, secret: SECRET_V1 },
      { keyId: REQUEST_V2, secret: SECRET_V2 },
    ],
    scopes: DEFAULT_SCOPES,
    clientId: "river-mobile",
    requireHttps: true,
    oidc: testOidc,
    // Shared store: two app instances below use the same Firestore-style nonce collection.
    nonces: new FirestoreNonceStore(store),
    onAudit: (entry) => audits.push(entry),
    ...extra,
  });
  const deps: Deps = {
    store,
    verifier: new OwnerVerifier(),
    config: { allowedOrigins: [], apiKeyPepper: "unused", disableRateLimit: true },
    now: () => new Date(),
  };
  const ownerApp = createApp(deps);
  const appA = createPublicApp({ ...deps, river: river() });
  const appB = createPublicApp({ ...deps, river: river() });
  const readOnly = createPublicApp({ ...deps, river: river({ scopes: ["shops:read"] as ApiScope[] }) });
  const prodApp = createPublicApp({ ...deps, river: undefined });

  const owner = await listen(ownerApp);
  const a = await listen(appA);
  const b = await listen(appB);
  const ro = await listen(readOnly);
  const prod = await listen(prodApp);

  const goodAuth = `Bearer ${fakeJwt({ aud: DEV_AUDIENCE, email: BRIDGE_EMAIL })}`;
  type Opts = { method?: "GET" | "POST"; path: string; body?: string; keyId?: string; secret?: string; authorization?: string; idem?: string; now?: Date; base?: string; https?: boolean; sendBody?: string; drop?: string[] };
  async function call(o: Opts) {
    const method = o.method ?? "POST";
    const body = o.body ?? (method === "POST" ? "{}" : "");
    const signed = signRequest({ method, pathWithQuery: o.path, body, keyId: o.keyId ?? REQUEST_V1, secret: o.secret ?? SECRET_V1, authorization: o.authorization ?? goodAuth, idempotencyKey: o.idem, now: o.now });
    const headers: Record<string, string> = { ...signed.headers };
    if (o.https !== false) headers["X-Forwarded-Proto"] = "https";
    for (const h of o.drop ?? []) delete headers[h];
    const res = await fetch(`${o.base ?? a.url}${o.path}`, { method, headers, body: method === "POST" ? (o.sendBody ?? body) : undefined });
    return { status: res.status, body: await res.text(), replayed: res.headers.get("idempotent-replayed") === "true", headers, contentType: res.headers.get("content-type") ?? "" };
  }

  try {
    // Fixture: one listed shop in Quezon City with one River-listed service.
    const ownerAuth = { Authorization: "Bearer test:owner", "Content-Type": "application/json" };
    const shop = (await (await fetch(`${owner.url}/businesses`, { method: "POST", headers: ownerAuth, body: JSON.stringify({ name: "Conformance Wash" }) })).json()) as { data: { id: string } };
    const shopId = shop.data.id;
    await fetch(`${owner.url}/businesses/${shopId}`, { method: "PATCH", headers: ownerAuth, body: JSON.stringify({ riverMobileListed: true, location: { lat: 14.68, lng: 121.045, formattedAddress: "QC", placeId: null } }) });
    const svc = (await (await fetch(`${owner.url}/businesses/${shopId}/services`, { method: "POST", headers: ownerAuth, body: JSON.stringify({ name: "Wash", durationMins: 30, listedOnRiverMobile: true }) })).json()) as { data: { id: string } };
    const order = (n: string) => JSON.stringify({ shopId, kind: "booking", source: "river_mobile", lines: [{ id: svc.data.id }], slot: { start: "2026-12-01T10:00:00+08:00" }, vehicleSize: "small", customer: { ref: `ref-${n}`, name: "Conformance Customer" } });

    const none = await fetch(`${a.url}/v1/orders`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" }, body: "{}" });
    const noneBody = await none.text();
    push("rejects a request with no OIDC token", none.status === 401 && generic(noneBody), `${none.status} ${noneBody}`);

    const wrong = await call({ path: "/v1/orders", authorization: `Bearer ${fakeJwt({ aud: "https://other.example", email: BRIDGE_EMAIL })}`, idem: "wrong-aud-0001" });
    const prodAud = await call({ path: "/v1/orders", authorization: `Bearer ${fakeJwt({ aud: PROD_AUDIENCE, email: BRIDGE_EMAIL })}`, idem: "prod-aud-0001" });
    const pathAud = await call({ path: "/v1/orders", authorization: `Bearer ${fakeJwt({ aud: `${DEV_AUDIENCE}/v1`, email: BRIDGE_EMAIL })}`, idem: "path-aud-0001" });
    push("rejects a wrong aud (other host, prod origin, /v1 path)", [wrong, prodAud, pathAud].every((r) => r.status === 401 && generic(r.body)), `${wrong.status} ${prodAud.status} ${pathAud.status}`);

    const other = await call({ path: "/v1/orders", authorization: `Bearer ${fakeJwt({ aud: DEV_AUDIENCE, email: OTHER_EMAIL })}`, idem: "other-sa-0001" });
    push("rejects a token from another service account", other.status === 401 && generic(other.body), `${other.status}`);

    const legacy = await call({ path: "/v1/orders", authorization: "Bearer mcw_river-mobile_0123456789abcdef0123456789abcdef", idem: "legacy-key-01" });
    push("no API-key fallback: a non-JWT bearer (old mcw_ key) is refused", legacy.status === 401, `${legacy.status}`);

    const missingSig = await call({ path: "/v1/orders", idem: "missing-sig-1", drop: ["X-River-Signature"] });
    push("rejects a missing signature", missingSig.status === 401 && generic(missingSig.body), `${missingSig.status}`);

    const badSig = await call({ path: "/v1/orders", secret: "not-the-secret", idem: "bad-sig-0001" });
    push("rejects a wrong signature", badSig.status === 401 && generic(badSig.body), `${badSig.status}`);

    const old = await call({ path: "/v1/orders", now: new Date(Date.now() - 6 * 60_000), idem: "old-ts-00001" });
    push("rejects a timestamp 6 minutes old", old.status === 401 && generic(old.body), `${old.status}`);

    const ahead = await call({ path: "/v1/orders", now: new Date(Date.now() + 6 * 60_000), idem: "ahead-ts-001" });
    push("rejects a timestamp 6 minutes ahead", ahead.status === 401 && generic(ahead.body), `${ahead.status}`);

    const first = await call({ path: "/v1/orders", body: order("nonce"), idem: "nonce-replay-key" });
    const secondSameInstance = await fetch(`${a.url}/v1/orders`, { method: "POST", headers: first.headers, body: order("nonce") });
    const secondOtherInstance = await fetch(`${b.url}/v1/orders`, { method: "POST", headers: first.headers, body: order("nonce") });
    push(
      "rejects the same nonce twice within 10 minutes (shared store, two instances)",
      first.status === 201 && secondSameInstance.status === 401 && secondOtherInstance.status === 401,
      `${first.status} then ${secondSameInstance.status} / other instance ${secondOtherInstance.status}`,
    );

    const original = order("tamper");
    const tampered = await call({ path: "/v1/orders", body: original, sendBody: `${original.slice(0, -1)} }`, idem: "body-tamper-key" });
    push("rejects a body changed by one byte after signing", tampered.status === 401, `${tampered.status}`);

    const v2 = await call({ path: "/v1/orders", body: order("v2"), keyId: REQUEST_V2, secret: SECRET_V2, idem: "rotation-v2-key" });
    const retired = await call({ path: "/v1/orders", body: order("v0"), keyId: REQUEST_RETIRED, secret: SECRET_V1, idem: "rotation-v0-key" });
    push("accepts both active secret versions and rejects a removed version", v2.status === 201 && retired.status === 401, `v2 ${v2.status} retired ${retired.status}`);

    const here = path.dirname(fileURLToPath(import.meta.url));
    const canonical = readFileSync(path.join(here, "../src/river/bridge-kit/canonical.ts"), "utf8");
    push("uses constant-time comparison", canonical.includes("timingSafeEqual") && !canonical.includes("=== header") && !canonical.includes("signature ==="), "vendored canonical.ts uses crypto.timingSafeEqual");

    const webhookOnRequest = await call({ path: "/v1/orders", body: order("wh"), keyId: REQUEST_V1, secret: WEBHOOK_SECRET, idem: "webhook-secret-req" });
    const names = Object.values(RIVER_SECRET_NAMES);
    push(
      "request and webhook secrets differ",
      webhookOnRequest.status === 401 && new Set(names).size === names.length && SECRET_V1 !== WEBHOOK_SECRET,
      `webhook secret on a request: ${webhookOnRequest.status}; separate Secret Manager names: ${names.join(", ")}`,
    );

    const onProd = await call({ base: prod.url, path: "/v1/orders", body: order("prod"), idem: "dev-on-prod-key" });
    push("dev secrets fail on prod (prod partner API has no River config: fail closed)", onProd.status === 401, `${onProd.status}`);

    const leaked = checks.filter((c) => c.name.startsWith("rejects") && !c.pass);
    push("error bodies give no detail on which check failed", leaked.length === 0 && generic(noneBody) && generic(badSig.body) && /problem\+json/.test(badSig.contentType), "problem+json is unauthorized / forbidden only");

    const noKey = await call({ path: "/v1/orders", body: order("nokey") });
    push("writes without Idempotency-Key get 400", noKey.status === 400, `${noKey.status}`);

    const created = await call({ path: "/v1/orders", body: order("same"), idem: "same-body-key" });
    const replayed = await call({ path: "/v1/orders", body: order("same"), idem: "same-body-key" });
    const changed = await call({ path: "/v1/orders", body: order("other"), idem: "same-body-key" });
    const sameOrder = created.status === 201 && replayed.status === 201 && JSON.parse(replayed.body).orderId === JSON.parse(created.body).orderId;
    push(
      "a replay returns the stored response and a different body gets 422",
      sameOrder && replayed.replayed && changed.status === 422,
      `create ${created.status} replay ${replayed.status} replayed=${replayed.replayed} changed ${changed.status}`,
    );

    const joined = JSON.stringify(audits);
    push(
      "every attempt is audited without secrets or tokens",
      audits.length > 5 && !joined.includes(SECRET_V1) && !joined.includes(WEBHOOK_SECRET) && !/Bearer |eyJ|v1=/.test(joined),
      `${audits.length} audit rows`,
    );

    const insecure = await call({ path: "/v1/orders", body: order("http"), idem: "plain-http-key", https: false });
    push("plain HTTP is refused when HTTPS is required", insecure.status === 401, `${insecure.status}`);

    // Webhook direction: this app's sender, checked by the kit's verifier as the Bridge runs it.
    const sent: { headers: Record<string, string>; body: string }[] = [];
    const transport: WebhookTransport = {
      mintIdToken: async (aud) => fakeJwt({ aud, email: CARWASH_SA }),
      fetch: async (_url, init) => {
        sent.push({ headers: init.headers, body: init.body });
        return { status: 204 };
      },
      sleep: async () => undefined,
      now: () => new Date(),
    };
    const base = { reference: "CWS-X", source: "river_mobile", serviceIds: [], vehicleSize: "small", scheduledStart: "", customerSnapshot: { name: "x", phoneE164: null }, verifyCodeHash: "", external: null, notes: null, acceptedBy: null, checkedInAt: null, queueItemId: null, createdAt: "", updatedAt: "" } as unknown as Booking;
    const event = webhookEventFor({ ...base, status: "requested" }, { ...base, status: "accepted" }, { businessId: shopId, bookingId: "bk1" }, new Date())!;
    const delivered = await deliverWebhook(store, { url: HOOK_URL, keyId: WEBHOOK_KEY, secret: WEBHOOK_SECRET }, event, transport);
    const hook = sent[0]!;
    const verifyHook = (secret: string, keyId = WEBHOOK_KEY) =>
      verifyRequest(
        { method: "POST", pathWithQuery: "/hooks/carwash", headers: hook.headers, rawBody: hook.body, secure: true },
        { audience: HOOK_URL, secrets: [{ keyId, secret }], allowedEmails: [CARWASH_SA], oidc: testOidc, nonces: new MemoryNonceStore(), allowKeyFallback: false, requireHttps: true },
      );
    const hookOk = await verifyHook(WEBHOOK_SECRET);
    const hookWithRequestSecret = await verifyHook(SECRET_V1);
    push(
      "webhooks pass the same checks and reject the request-direction secret",
      delivered === "delivered" && hookOk.ok && !hookWithRequestSecret.ok && hook.headers["Idempotency-Key"] === event.id,
      hookOk.ok ? `order.accepted to /hooks/carwash ok, Idempotency-Key=${event.id}` : hookOk.reason,
    );

    const forbidden = await call({ base: ro.url, path: "/v1/orders", body: order("scope"), idem: "scope-check-key" });
    push("a valid caller without the scope gets 403", forbidden.status === 403 && forbidden.body.includes("forbidden") && generic(forbidden.body), `${forbidden.status} ${forbidden.body}`);

    // Carwash-specific contract items.
    const big = await call({ path: "/v1/orders", body: JSON.stringify({ pad: "x".repeat(17 * 1024) }), idem: "too-big-body-1" });
    push("bodies over 16 KB are refused (413)", big.status === 413, `${big.status}`);

    const near = await call({ method: "GET", path: "/v1/shops?lng=121.0437&lat=14.676&radiusKm=10&limit=5" });
    const nearBody = near.status === 200 ? (JSON.parse(near.body) as { shops: { id: string; distanceKm: number }[] }) : { shops: [] };
    push("GET /v1/shops lists listed shops nearest first with distanceKm (signed, unsorted query)", near.status === 200 && nearBody.shops[0]?.id === shopId && typeof nearBody.shops[0]?.distanceKm === "number", `${near.status} ${nearBody.shops.length} shop(s)`);

    const createdId = JSON.parse(created.body).orderId as string;
    const cancel = await call({ path: `/v1/orders/${createdId}/cancel`, body: JSON.stringify({ reason: "conformance" }), idem: "cancel-order-01" });
    push("POST /v1/orders/{id}/cancel cancels a requested order", cancel.status === 200 && JSON.parse(cancel.body).status === "cancelled", `${cancel.status}`);
  } finally {
    await Promise.all([owner.close(), a.close(), b.close(), ro.close(), prod.close()]);
  }
  return checks;
}

export function printChecks(checks: Check[]): number {
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  const failed = checks.filter((check) => !check.pass).length;
  console.log(`${checks.length - failed}/${checks.length} checks passed`);
  return failed === 0 ? 0 : 1;
}
