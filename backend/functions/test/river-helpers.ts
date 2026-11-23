import request from "supertest";
import { signRequest, type AuthAudit, type OidcVerifier } from "../src/river/bridge-kit/index.js";
import { DEFAULT_SCOPES, DEV_AUDIENCE, type RiverAuthConfig } from "../src/river/config.js";
import { FirestoreNonceStore } from "../src/river/nonce-store.js";
import type { ApiScope } from "../src/models/types.js";
import type { DocStore } from "../src/store/doc-store.js";

/** Test-only values. Not real secrets. */
export const BRIDGE_EMAIL = "river-bridge-dev@rivermobile-dev.iam.gserviceaccount.com";
export const OTHER_EMAIL = "someone-else@other-project.iam.gserviceaccount.com";
export const KEY_V1 = "bridge-to-carwash-dev-v1";
export const KEY_V2 = "bridge-to-carwash-dev-v2";
export const SECRET_V1 = "test-request-secret-v1";
export const SECRET_V2 = "test-request-secret-v2";
export const WEBHOOK_KEY = "carwash-to-bridge-dev-v1";
export const WEBHOOK_SECRET = "test-webhook-secret-different";

/** Unsigned JWT-shaped token; only the fake verifier below accepts it. */
export function fakeJwt(payload: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(payload)}.sig`;
}

/** Stands in for Google's verifier: checks aud like OAuth2Client.verifyIdToken does. */
export const fakeOidc: OidcVerifier = {
  async verify(idToken, audience) {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { aud?: string; email?: string };
    if (!payload.email || payload.aud !== audience) throw new Error("oidc");
    return { email: payload.email, audience };
  },
};

export const bridgeToken = (aud = DEV_AUDIENCE, email = BRIDGE_EMAIL) => `Bearer ${fakeJwt({ aud, email })}`;

export function riverConfig(store: DocStore, audits: AuthAudit[] = [], scopes: ApiScope[] = DEFAULT_SCOPES): RiverAuthConfig {
  return {
    audience: DEV_AUDIENCE,
    allowedEmails: [BRIDGE_EMAIL],
    secrets: [
      { keyId: KEY_V1, secret: SECRET_V1 },
      { keyId: KEY_V2, secret: SECRET_V2 },
    ],
    scopes,
    clientId: "river-mobile",
    requireHttps: true,
    oidc: fakeOidc,
    nonces: new FirestoreNonceStore(store),
    onAudit: (entry) => audits.push(entry),
  };
}

export interface CallOptions {
  body?: unknown;
  idem?: string;
  keyId?: string;
  secret?: string;
  authorization?: string;
  now?: Date;
  https?: boolean;
  /** Bytes actually sent, when different from the signed body (tamper tests). */
  sendRaw?: string;
}

/** One River Bridge call against the app: OIDC (fake) + HMAC + optional Idempotency-Key, over "HTTPS". */
export function riverCall(app: Parameters<typeof request>[0], method: "GET" | "POST", pathWithQuery: string, opts: CallOptions = {}) {
  const raw = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const signed = signRequest({
    method,
    pathWithQuery,
    body: raw,
    keyId: opts.keyId ?? KEY_V1,
    secret: opts.secret ?? SECRET_V1,
    authorization: opts.authorization ?? bridgeToken(),
    idempotencyKey: opts.idem,
    now: opts.now,
  });
  const headers: Record<string, string> = { ...signed.headers };
  if (opts.https !== false) headers["X-Forwarded-Proto"] = "https";
  const req = method === "GET" ? request(app).get(pathWithQuery) : request(app).post(pathWithQuery);
  req.set(headers);
  if (method === "POST") return req.send(opts.sendRaw ?? raw);
  return req;
}
