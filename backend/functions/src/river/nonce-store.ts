import { sha256 } from "../lib/crypto.js";
import type { DocStore } from "../store/doc-store.js";
import { NONCE_TTL_MS, type NonceStore } from "./bridge-kit/index.js";

/**
 * Shared single-use nonce store: river_nonces/{sha256(keyId\nnonce)} is created
 * (never overwritten), so a second claim from any instance fails as a replay.
 * `expireAt` is a Firestore Timestamp; a TTL policy on river_nonces.expireAt
 * deletes rows after 10 minutes (see firestore.indexes.json fieldOverrides).
 */
export class FirestoreNonceStore implements NonceStore {
  constructor(private readonly store: DocStore, private readonly ttlMs = NONCE_TTL_MS) {}

  async claim(keyId: string, nonce: string, now: Date): Promise<"ok" | "replay"> {
    const path = `river_nonces/${sha256(`${keyId}\n${nonce}`)}`;
    try {
      await this.store.create(path, { keyId, createdAt: now.toISOString(), expireAt: new Date(now.getTime() + this.ttlMs) });
      return "ok";
    } catch (err) {
      if (isAlreadyExists(err)) return "replay";
      throw err;
    }
  }
}

function isAlreadyExists(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown };
  return e?.code === 6 || e?.code === "already-exists" || (typeof e?.message === "string" && /ALREADY_EXISTS/i.test(e.message));
}
