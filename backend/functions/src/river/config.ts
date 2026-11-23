import type { ApiScope } from "../models/types.js";
import type { ActiveSecret, AuthAudit, NonceStore, OidcVerifier } from "./bridge-kit/index.js";

/**
 * River Bridge two-factor auth for the /v1 partner API (dev only for now).
 *
 * Secret values come from Secret Manager (index.ts binds them to the dev functions
 * only). Everything else is non-secret config read from env vars, with dev defaults:
 *
 *   RIVER_DEV_BRIDGE_EMAILS        Bridge service account email(s), comma-separated. Unset = every call is 401.
 *   RIVER_DEV_AUDIENCE             OIDC audience (default: the dev App Hosting origin).
 *   RIVER_DEV_REQUEST_KEY_ID_V1/2  Key ids for the two active request secrets.
 *   RIVER_DEV_SCOPES               Scopes granted to the Bridge (default: the four below).
 *   RIVER_DEV_CLIENT_ID            Owner id stored on bookings the Bridge creates (default river-mobile).
 *   RIVER_DEV_BRIDGE_BASE_URL      Bridge base URL; webhooks POST to {base}/hooks/carwash. Unset = not sent.
 *   RIVER_DEV_WEBHOOK_KEY_ID_V1/2  Key ids for the two webhook secrets.
 *   RIVER_DEV_WEBHOOK_ACTIVE       Which webhook secret signs: v1 (default) or v2.
 */
export const DEV_AUDIENCE = "https://mycarwash-dev--mycarwashph.asia-southeast1.hosted.app";
export const PROD_AUDIENCE = "https://mycarwash-prod--mycarwashph.asia-southeast1.hosted.app";
export const DEFAULT_SCOPES: ApiScope[] = ["shops:read", "orders:read", "orders:write", "checkin:write"];

/** Secret Manager secret names (values never live in git or env files). */
export const RIVER_SECRET_NAMES = {
  requestV1: "RIVER_BRIDGE_REQUEST_HMAC_DEV_V1",
  requestV2: "RIVER_BRIDGE_REQUEST_HMAC_DEV_V2",
  webhookV1: "RIVER_BRIDGE_WEBHOOK_HMAC_DEV_V1",
  webhookV2: "RIVER_BRIDGE_WEBHOOK_HMAC_DEV_V2",
} as const;

export interface RiverAuthConfig {
  audience: string;
  allowedEmails: string[];
  secrets: ActiveSecret[];
  scopes: ApiScope[];
  clientId: string;
  requireHttps: boolean;
  oidc: OidcVerifier;
  nonces: NonceStore;
  onAudit: (entry: AuthAudit) => void;
}

export interface RiverWebhookConfig {
  /** Full URL `{bridge}/hooks/carwash`; null when the Bridge base URL is not configured. */
  url: string | null;
  keyId: string;
  secret: string;
}

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function riverEnv(env: NodeJS.ProcessEnv = process.env) {
  const scopes = list(env.RIVER_DEV_SCOPES);
  const base = env.RIVER_DEV_BRIDGE_BASE_URL?.trim().replace(/\/+$/, "") || null;
  return {
    audience: env.RIVER_DEV_AUDIENCE?.trim() || DEV_AUDIENCE,
    allowedEmails: list(env.RIVER_DEV_BRIDGE_EMAILS),
    requestKeyIds: [env.RIVER_DEV_REQUEST_KEY_ID_V1?.trim() || "bridge-to-carwash-dev-v1", env.RIVER_DEV_REQUEST_KEY_ID_V2?.trim() || "bridge-to-carwash-dev-v2"] as const,
    scopes: (scopes.length ? scopes : DEFAULT_SCOPES).filter((s): s is ApiScope => (DEFAULT_SCOPES as string[]).includes(s)),
    clientId: env.RIVER_DEV_CLIENT_ID?.trim() || "river-mobile",
    webhookUrl: base && base.startsWith("https://") ? `${base}/hooks/carwash` : null,
    webhookKeyIds: [env.RIVER_DEV_WEBHOOK_KEY_ID_V1?.trim() || "carwash-to-bridge-dev-v1", env.RIVER_DEV_WEBHOOK_KEY_ID_V2?.trim() || "carwash-to-bridge-dev-v2"] as const,
    webhookActive: (env.RIVER_DEV_WEBHOOK_ACTIVE?.trim() === "v2" ? 1 : 0) as 0 | 1,
  };
}

/** One structured log line per auth attempt (allow or deny). No secrets, tokens or signatures. */
export function logAudit(entry: AuthAudit) {
  const line = { severity: entry.result === "allow" ? "INFO" : "WARNING", message: "river_auth", ...entry };
  console.log(JSON.stringify(line));
}
