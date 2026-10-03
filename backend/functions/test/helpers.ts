import type { AuthUser, TokenVerifier } from "../src/auth/token-verifier.js";
import { createApp, createPublicApp } from "../src/app.js";
import type { Deps } from "../src/deps.js";
import type { Member, Role } from "../src/models/types.js";
import { paths } from "../src/services/paths.js";
import { MemoryStore } from "../src/store/memory-store.js";

/** Test tokens look like "test:<uid>" or "test:<uid>:admin". */
export class FakeVerifier implements TokenVerifier {
  async verify(token: string): Promise<AuthUser> {
    const [prefix, uid, flag] = token.split(":");
    if (prefix !== "test" || !uid) throw new Error("bad token");
    return { uid, phoneNumber: "+639171234567", platformAdmin: flag === "admin" };
  }
}

export const FIXED_NOW = new Date("2026-10-04T02:00:00.000Z"); // 10:00 PHT

export function makeDeps(): Deps & { store: MemoryStore } {
  return {
    store: new MemoryStore(),
    verifier: new FakeVerifier(),
    config: { allowedOrigins: ["http://localhost:3000"], apiKeyPepper: "test-pepper", disableRateLimit: true },
    now: () => FIXED_NOW,
  };
}

export function makeApps() {
  const deps = makeDeps();
  return { deps, app: createApp(deps), publicApp: createPublicApp(deps) };
}

export const auth = (uid: string, admin = false) => ({ Authorization: `Bearer test:${uid}${admin ? ":admin" : ""}` });

/** Directly seeds a membership (invites are Phase 1). */
export async function addMember(store: MemoryStore, businessId: string, uid: string, role: Role, status: Member["status"] = "active") {
  const at = FIXED_NOW.toISOString();
  await store.set(paths.member(businessId, uid), {
    uid, businessId, role, status, displayName: uid, phoneE164: null, email: null, invitedBy: "owner", createdAt: at, updatedAt: at,
  });
}
