import { describe, expect, it } from "vitest";
import type { Booking } from "../src/models/types.js";
import { MemoryNonceStore, verifyRequest } from "../src/river/bridge-kit/index.js";
import { deliverWebhook, webhookEventFor, webhookSignaturePath, type WebhookTransport } from "../src/river/webhooks.js";
import { MemoryStore } from "../src/store/memory-store.js";
import { fakeJwt, fakeOidc, SECRET_V1, WEBHOOK_KEY, WEBHOOK_SECRET } from "./river-helpers.js";

const HOOK = "https://asia-southeast1-rivermobile-dev.cloudfunctions.net/bridge/hooks/carwash";
const CARWASH_SA = "carwash-runtime@mycarwashph.iam.gserviceaccount.com";
const ids = { businessId: "shop1", bookingId: "bk1" };
const booking = (status: Booking["status"], source: Booking["source"] = "river_mobile"): Booking => ({
  reference: "CWS-ABC123",
  source,
  status,
  serviceIds: ["s1"],
  vehicleSize: "small",
  plate: null,
  scheduledStart: "2026-10-04T07:00:00.000Z",
  customerSnapshot: { name: "Ana", phoneE164: null },
  verifyCodeHash: "x",
  external: { clientId: "river-mobile", customerRef: "ref-1", externalBookingRef: null },
  notes: null,
  acceptedBy: null,
  checkedInAt: null,
  queueItemId: null,
  createdAt: "2026-10-04T02:00:00.000Z",
  updatedAt: "2026-10-04T02:05:00.000Z",
});

interface Sent { url: string; headers: Record<string, string>; body: string }

function transport(statuses: Array<number | "throw">) {
  const sent: Sent[] = [];
  const t: WebhookTransport = {
    mintIdToken: async (aud) => fakeJwt({ aud, email: CARWASH_SA }),
    fetch: async (url, init) => {
      sent.push({ url, headers: init.headers, body: init.body });
      const next = statuses.shift() ?? 204;
      if (next === "throw") throw new TypeError("fetch failed");
      return { status: next };
    },
    sleep: async () => undefined,
    now: () => new Date(),
  };
  return { t, sent };
}

describe("River status webhooks", () => {
  it("maps booking updates onto shared events and skips no-ops and non-River bookings", () => {
    const now = new Date();
    expect(webhookEventFor(booking("requested"), booking("accepted"), ids, now)).toMatchObject({ id: "mcw.bk1.accepted", type: "order.accepted", data: { orderId: "bk1", status: "accepted", customerRef: "ref-1", shopId: "shop1" } });
    expect(webhookEventFor(booking("accepted"), booking("checked_in"), ids, now)?.type).toBe("order.in_progress");
    expect(webhookEventFor(booking("queued"), booking("in_bay"), ids, now)).toBeNull();
    expect(webhookEventFor(booking("in_bay"), booking("done"), ids, now)?.type).toBe("order.ready");
    expect(webhookEventFor(booking("done"), booking("paid"), ids, now)?.type).toBe("order.completed");
    expect(webhookEventFor(booking("requested"), booking("declined"), ids, now)?.type).toBe("order.declined");
    expect(webhookEventFor(booking("accepted"), booking("no_show"), ids, now)?.type).toBe("order.cancelled");
    expect(webhookEventFor(booking("requested", "river_mobile_api"), booking("accepted", "river_mobile_api"), ids, now)?.type).toBe("order.accepted");
    expect(webhookEventFor(booking("requested", "online_link"), booking("accepted", "online_link"), ids, now)).toBeNull();
  });

  it("signs with OIDC + the webhook secret over /hooks/carwash, which the Bridge verifier accepts", async () => {
    const store = new MemoryStore();
    const ev = webhookEventFor(booking("requested"), booking("accepted"), ids, new Date())!;
    const { t, sent } = transport([204]);
    expect(await deliverWebhook(store, { url: HOOK, keyId: WEBHOOK_KEY, secret: WEBHOOK_SECRET }, ev, t)).toBe("delivered");
    expect(webhookSignaturePath(HOOK)).toBe("/hooks/carwash");
    const msg = sent[0]!;
    expect(msg.headers["Idempotency-Key"]).toBe(ev.id);
    expect(JSON.parse(msg.body)).toEqual(ev);
    const verify = (secret: string) =>
      verifyRequest(
        { method: "POST", pathWithQuery: "/hooks/carwash", headers: msg.headers, rawBody: msg.body, secure: true },
        { audience: HOOK, secrets: [{ keyId: WEBHOOK_KEY, secret }], allowedEmails: [CARWASH_SA], oidc: fakeOidc, nonces: new MemoryNonceStore(), allowKeyFallback: false, requireHttps: true },
      );
    expect((await verify(WEBHOOK_SECRET)).ok).toBe(true);
    expect((await verify(SECRET_V1)).ok).toBe(false);
    const doc = await store.get<Record<string, unknown>>(`river_webhook_deliveries/${ev.id}`);
    expect(doc).toMatchObject({ status: "delivered", attempts: 1, lastHttpStatus: 204 });
    expect(JSON.stringify(doc)).not.toContain(WEBHOOK_SECRET);
    expect(JSON.stringify(doc)).not.toMatch(/eyJ|v1=/);
  });

  it("retries network errors and 5xx up to 3 times, not 4xx, and dedupes by event id", async () => {
    const ev = webhookEventFor(booking("requested"), booking("accepted"), ids, new Date())!;
    const cfg = { url: HOOK, keyId: WEBHOOK_KEY, secret: WEBHOOK_SECRET };

    const s1 = new MemoryStore();
    const a = transport(["throw", 503, 204]);
    expect(await deliverWebhook(s1, cfg, ev, a.t)).toBe("delivered");
    expect(a.sent).toHaveLength(3);
    expect(new Set(a.sent.map((m) => m.headers["X-River-Nonce"])).size).toBe(3);
    expect(await deliverWebhook(s1, cfg, ev, transport([]).t)).toBe("duplicate");

    const s2 = new MemoryStore();
    const b = transport([500, 502, 503, 204]);
    expect(await deliverWebhook(s2, cfg, ev, b.t)).toBe("failed");
    expect(b.sent).toHaveLength(3);
    expect(await s2.get(`river_webhook_deliveries/${ev.id}`)).toMatchObject({ status: "failed", attempts: 3, lastHttpStatus: 503 });

    const s3 = new MemoryStore();
    const c = transport([401]);
    expect(await deliverWebhook(s3, cfg, ev, c.t)).toBe("failed");
    expect(c.sent).toHaveLength(1);
  });

  it("records not_configured and sends nothing without a Bridge URL or secret", async () => {
    const ev = webhookEventFor(booking("accepted"), booking("cancelled"), ids, new Date())!;
    const store = new MemoryStore();
    const { t, sent } = transport([]);
    expect(await deliverWebhook(store, { url: null, keyId: WEBHOOK_KEY, secret: WEBHOOK_SECRET }, ev, t)).toBe("not_configured");
    expect(sent).toHaveLength(0);
    expect(await store.get(`river_webhook_deliveries/${ev.id}`)).toMatchObject({ status: "not_configured" });
  });
});
