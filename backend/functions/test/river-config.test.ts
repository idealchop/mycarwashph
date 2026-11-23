import { describe, expect, it } from "vitest";
import { DEFAULT_SCOPES, DEV_AUDIENCE, riverEnv } from "../src/river/config.js";
import { FirestoreNonceStore } from "../src/river/nonce-store.js";
import { MemoryStore } from "../src/store/memory-store.js";

describe("River config", () => {
  it("defaults to the dev origin, no allowlisted callers and no webhook URL", () => {
    const c = riverEnv({});
    expect(c.audience).toBe(DEV_AUDIENCE);
    expect(c.allowedEmails).toEqual([]);
    expect(c.scopes).toEqual(DEFAULT_SCOPES);
    expect(c.requestKeyIds).toEqual(["bridge-to-carwash-dev-v1", "bridge-to-carwash-dev-v2"]);
    expect(c.webhookUrl).toBeNull();
  });

  it("reads emails, scopes and the HTTPS Bridge base", () => {
    const c = riverEnv({ RIVER_DEV_BRIDGE_EMAILS: "a@x.iam.gserviceaccount.com, b@y.iam.gserviceaccount.com", RIVER_DEV_SCOPES: "shops:read,bogus", RIVER_DEV_BRIDGE_BASE_URL: "https://bridge.example/bridge/", RIVER_DEV_WEBHOOK_ACTIVE: "v2" });
    expect(c.allowedEmails).toHaveLength(2);
    expect(c.scopes).toEqual(["shops:read"]);
    expect(c.webhookUrl).toBe("https://bridge.example/bridge/hooks/carwash");
    expect(c.webhookKeyIds[c.webhookActive]).toBe("carwash-to-bridge-dev-v2");
    expect(riverEnv({ RIVER_DEV_BRIDGE_BASE_URL: "http://insecure.example" }).webhookUrl).toBeNull();
  });

  it("shares nonces through the store: second claim is a replay", async () => {
    const store = new MemoryStore();
    const a = new FirestoreNonceStore(store);
    const b = new FirestoreNonceStore(store);
    const now = new Date();
    expect(await a.claim("k1", "n1", now)).toBe("ok");
    expect(await b.claim("k1", "n1", now)).toBe("replay");
    expect(await b.claim("k2", "n1", now)).toBe("ok");
    const [row] = await store.list<{ expireAt: Date }>("river_nonces");
    expect(row!.expireAt.getTime() - now.getTime()).toBe(10 * 60_000);
  });
});
