import { sha256 } from "../lib/crypto.js";
import { unprocessable } from "../lib/errors.js";
import type { DocStore } from "../store/doc-store.js";
import { paths } from "./paths.js";

interface StoredResponse {
  requestHash: string;
  status: number;
  body: unknown;
  createdAt: string;
}

/**
 * Replays the stored response for a repeated Idempotency-Key from the same client.
 * A reused key with a different body is rejected. (Stub: no TTL cleanup yet and the
 * check-then-store is not atomic; Phase 1 moves it into a transaction with expiry.)
 */
export async function withIdempotency(
  store: DocStore,
  clientId: string,
  key: string,
  requestBody: unknown,
  now: Date,
  run: () => Promise<{ status: number; body: unknown }>,
) {
  const path = paths.idempotency(sha256(`${clientId}:${key}`));
  const requestHash = sha256(JSON.stringify(requestBody ?? null));
  const existing = await store.get<StoredResponse>(path);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw unprocessable("This Idempotency-Key was already used with a different request.", "idempotency_key_reused");
    }
    return { status: existing.status, body: existing.body, replayed: true };
  }
  const result = await run();
  await store.set(path, { requestHash, status: result.status, body: result.body as Record<string, unknown>, createdAt: now.toISOString() });
  return { ...result, replayed: false };
}
