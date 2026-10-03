import { randomBytes } from "node:crypto";
import { hashSecret } from "../lib/crypto.js";
import type { ApiClient, ApiScope } from "../models/types.js";
import type { DocStore } from "../store/doc-store.js";
import { paths } from "./paths.js";

/**
 * Placeholder API-key auth for the River Mobile /v1 API.
 * Key format: mcw_<clientId>_<secret>. Only sha256(pepper:secret) is stored.
 * Phase 1 replaces this with OAuth 2.0 client credentials (short-lived tokens).
 */
export function parseApiKey(key: string) {
  const m = /^mcw_([a-z0-9-]{3,40})_([A-Za-z0-9]{32,64})$/.exec(key);
  return m ? { clientId: m[1]!, secret: m[2]! } : null;
}

export async function createApiClient(
  store: DocStore,
  input: { clientId: string; name: string; environment: ApiClient["environment"]; scopes: ApiScope[] },
  pepper: string,
  now: Date,
) {
  const secret = randomBytes(24).toString("hex");
  const client: ApiClient = {
    name: input.name,
    environment: input.environment,
    scopes: input.scopes,
    secretHash: hashSecret(secret, pepper),
    status: "active",
    createdAt: now.toISOString(),
  };
  await store.set(paths.apiClient(input.clientId), { ...client });
  return { apiKey: `mcw_${input.clientId}_${secret}`, client };
}
