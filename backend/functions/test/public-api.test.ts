import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createPublicApp } from "../src/app.js";
import { AUTH_LEAK_PATTERN, signRequest, type AuthAudit } from "../src/river/bridge-kit/index.js";
import { PROD_AUDIENCE } from "../src/river/config.js";
import { addMember, auth, makeApps } from "./helpers.js";
import { BRIDGE_EMAIL, bridgeToken, KEY_V2, OTHER_EMAIL, riverCall, riverConfig, SECRET_V1, SECRET_V2 } from "./river-helpers.js";

describe("River Mobile /v1 API and Scan", () => {
  let ctx: ReturnType<typeof makeApps>;
  let shop: string;
  let serviceId: string;

  const bookingBody = () => ({
    shopId: shop,
    serviceIds: [serviceId],
    vehicleSize: "medium",
    plate: "NAB 1234",
    slotStart: "2026-10-04T15:00:00+08:00",
    customer: { ref: "rm-cust-001", name: "Juan Dela Cruz", phoneE164: "+639181112222" },
    externalBookingRef: "RM-123",
  });

  const book = (idem = "idem-key-0001") => riverCall(ctx.publicApp, "POST", "/v1/bookings", { idem, body: bookingBody() });

  beforeEach(async () => {
    ctx = makeApps();
    const created = await request(ctx.app).post("/businesses").set(auth("alice")).send({ name: "Alice Wash" });
    shop = created.body.data.id;
    await addMember(ctx.deps.store, shop, "sam", "staff");
    const svc = await request(ctx.app)
      .post(`/businesses/${shop}/services`)
      .set(auth("alice"))
      .send({ name: "Basic wash", durationMins: 30, listedOnRiverMobile: true });
    serviceId = svc.body.data.id;
  });

  describe("two-factor auth", () => {
    const get = (opts = {}) => riverCall(ctx.publicApp, "GET", `/v1/shops/${shop}`, opts);

    it("health needs no auth", async () => {
      const res = await request(ctx.publicApp).get("/v1/health");
      expect(res.status).toBe(200);
      expect(res.body.apiVersion).toBe("v1");
    });

    it("rejects missing token, legacy mcw_ keys, wrong audience (incl. prod) and other service accounts, generically", async () => {
      const bodies: string[] = [];
      const none = await request(ctx.publicApp).get(`/v1/shops/${shop}`).set("X-Forwarded-Proto", "https");
      const legacy = await get({ authorization: "Bearer mcw_river-mobile_0123456789abcdef0123456789abcdef" });
      const prodAud = await get({ authorization: bridgeToken(PROD_AUDIENCE) });
      const v1Path = await get({ authorization: bridgeToken("https://mycarwash-dev--mycarwashph.asia-southeast1.hosted.app/v1") });
      const other = await get({ authorization: bridgeToken(undefined, OTHER_EMAIL) });
      for (const res of [none, legacy, prodAud, v1Path, other]) {
        expect(res.status).toBe(401);
        expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
        expect(res.body.code).toBe("unauthorized");
        bodies.push(res.text);
      }
      expect(bodies.join("\n")).not.toMatch(AUTH_LEAK_PATTERN);
    });

    it("rejects a bad or missing signature, a stale or future timestamp, a replayed nonce and an unknown key id", async () => {
      expect((await get({ secret: "not-the-secret" })).status).toBe(401);
      expect((await get({ now: new Date(Date.now() - 6 * 60_000) })).status).toBe(401);
      expect((await get({ now: new Date(Date.now() + 6 * 60_000) })).status).toBe(401);
      expect((await get({ keyId: "bridge-to-carwash-dev-v0" })).status).toBe(401);
      // Same signed headers twice: first passes auth (404, not listed), second is a replay.
      const signed = signRequest({ method: "GET", pathWithQuery: `/v1/shops/${shop}`, body: "", keyId: "bridge-to-carwash-dev-v1", secret: SECRET_V1, authorization: bridgeToken() });
      const headers = { ...signed.headers, "X-Forwarded-Proto": "https" };
      expect((await request(ctx.publicApp).get(`/v1/shops/${shop}`).set(headers)).status).toBe(404);
      expect((await request(ctx.publicApp).get(`/v1/shops/${shop}`).set(headers)).status).toBe(401);
    });

    it("accepts both active secret versions and refuses plain HTTP", async () => {
      await request(ctx.app).patch(`/businesses/${shop}`).set(auth("alice")).send({ riverMobileListed: true });
      expect((await get()).status).toBe(200);
      expect((await get({ keyId: KEY_V2, secret: SECRET_V2 })).status).toBe(200);
      expect((await get({ keyId: KEY_V2, secret: SECRET_V1 })).status).toBe(401);
      expect((await get({ https: false })).status).toBe(401);
    });

    it("fails closed when River auth is not configured (prod today)", async () => {
      const app = createPublicApp({ ...ctx.deps, river: undefined });
      expect((await riverCall(app, "GET", `/v1/shops/${shop}`)).status).toBe(401);
    });

    it("enforces scopes with a generic 403", async () => {
      const app = createPublicApp({ ...ctx.deps, river: riverConfig(ctx.deps.store, [], ["shops:read"]) });
      const res = await riverCall(app, "POST", "/v1/bookings", { idem: "abcdefgh", body: bookingBody() });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("forbidden");
    });

    it("audits every attempt without secrets or tokens", async () => {
      const audits: AuthAudit[] = [];
      const app = createPublicApp({ ...ctx.deps, river: riverConfig(ctx.deps.store, audits) });
      await riverCall(app, "GET", `/v1/shops/${shop}`);
      await riverCall(app, "GET", `/v1/shops/${shop}`, { secret: "wrong" });
      expect(audits.map((a) => a.result)).toEqual(["allow", "deny"]);
      expect(audits[0]!.caller).toBe(BRIDGE_EMAIL);
      expect(audits[1]!.reason).toBe("bad_signature");
      const text = JSON.stringify(audits);
      expect(text).not.toContain(SECRET_V1);
      expect(text).not.toMatch(/Bearer |eyJ|v1=/);
    });

    it("rejects bodies over 16 KB and a body changed after signing", async () => {
      await request(ctx.app).patch(`/businesses/${shop}`).set(auth("alice")).send({ riverMobileListed: true });
      const big = await riverCall(ctx.publicApp, "POST", "/v1/bookings", { idem: "big-body-key", body: { ...bookingBody(), notes: "x".repeat(17_000) } });
      expect(big.status).toBe(413);
      const raw = JSON.stringify(bookingBody());
      const tampered = await riverCall(ctx.publicApp, "POST", "/v1/bookings", { idem: "tamper-key-1", body: bookingBody(), sendRaw: raw.replace("medium", "large ") });
      expect(tampered.status).toBe(401);
    });
  });

  it("only exposes shops that opted in to River Mobile", async () => {
    expect((await book()).status).toBe(404);
    await request(ctx.app).patch(`/businesses/${shop}`).set(auth("alice")).send({ riverMobileListed: true });
    expect((await riverCall(ctx.publicApp, "GET", `/v1/shops/${shop}`)).status).toBe(200);
  });

  describe("with a listed shop", () => {
    beforeEach(async () => {
      await request(ctx.app).patch(`/businesses/${shop}`).set(auth("alice")).send({ riverMobileListed: true });
    });

    it("requires a well-formed Idempotency-Key and replays repeats", async () => {
      expect((await riverCall(ctx.publicApp, "POST", "/v1/bookings", { body: bookingBody() })).status).toBe(400);
      expect((await riverCall(ctx.publicApp, "POST", "/v1/bookings", { idem: "short", body: bookingBody() })).status).toBe(400);
      expect((await riverCall(ctx.publicApp, "POST", "/v1/bookings", { idem: "bad key with spaces", body: bookingBody() })).status).toBe(400);
      const first = await book();
      expect(first.status).toBe(201);
      expect(first.body.status).toBe("requested");
      expect(first.body.riverStatus).toBe("requested");
      expect(first.body.source).toBe("river_mobile");
      expect(first.body.reference).toMatch(/^CWS-/);
      const again = await book();
      expect(again.status).toBe(201);
      expect(again.headers["idempotent-replayed"]).toBe("true");
      expect(again.body.bookingId).toBe(first.body.bookingId);
      const changed = await riverCall(ctx.publicApp, "POST", "/v1/bookings", { idem: "idem-key-0001", body: { ...bookingBody(), notes: "different" } });
      expect(changed.status).toBe(422);
      const list = await request(ctx.app).get(`/businesses/${shop}/bookings`).set(auth("sam"));
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].verifyCodeHash).toBeUndefined();
      expect(list.body.data[0].source).toBe("river_mobile");
      expect(list.body.data[0].plate).toBeNull();
    });

    it("runs the Partner flow: requested -> accepted -> Scan verified -> completed", async () => {
      const { body } = await book();
      const early = await request(ctx.app).post(`/businesses/${shop}/bookings/verify`).set(auth("sam")).send({ payload: body.checkIn.qrPayload });
      expect(early.status).toBe(409);
      expect((await request(ctx.app).post(`/businesses/${shop}/bookings/${body.bookingId}/accept`).set(auth("sam"))).status).toBe(200);
      const tampered = body.checkIn.qrPayload.slice(0, -1) + (body.checkIn.qrPayload.endsWith("A") ? "B" : "A");
      const bad = await request(ctx.app).post(`/businesses/${shop}/bookings/verify`).set(auth("sam")).send({ payload: tampered });
      expect(bad.status).toBe(422);
      const ok = await request(ctx.app).post(`/businesses/${shop}/bookings/verify`).set(auth("sam")).send({ payload: body.checkIn.qrPayload });
      expect(ok.status).toBe(200);
      expect(ok.body.data.booking.status).toBe("checked_in");
      expect(ok.body.data.queueItem).toBeNull();
      const twice = await request(ctx.app).post(`/businesses/${shop}/bookings/verify`).set(auth("sam")).send({ payload: body.checkIn.qrPayload });
      expect(twice.status).toBe(409);
      const done = await request(ctx.app).post(`/businesses/${shop}/bookings/${body.bookingId}/complete`).set(auth("sam"));
      expect(done.body.data.status).toBe("completed");
      const status = await riverCall(ctx.publicApp, "GET", `/v1/bookings/${body.bookingId}`);
      expect(status.body.status).toBe("completed");
      expect(status.body.riverStatus).toBe("completed");
      const order = await riverCall(ctx.publicApp, "GET", `/v1/orders/${body.bookingId}`);
      expect(order.body).toMatchObject({ orderId: body.bookingId, status: "completed", source: "river_mobile" });
    });

    it("refuses a check-in QR scanned at a different shop", async () => {
      const { body } = await book();
      const other = await request(ctx.app).post("/businesses").set(auth("bob")).send({ name: "Bob Wash" });
      const res = await request(ctx.app).post(`/businesses/${other.body.data.id}/bookings/verify`).set(auth("bob")).send({ payload: body.checkIn.qrPayload });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("wrong_shop");
    });

    it("on Paid shops, Scan puts the car in the queue and the booking follows the queue", async () => {
      await request(ctx.app).put(`/businesses/${shop}/plan`).set(auth("ops", true)).send({ plan: "paid" });
      const { body } = await book();
      await request(ctx.app).post(`/businesses/${shop}/bookings/${body.bookingId}/accept`).set(auth("sam"));
      const walkIn = await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("sam")).send({ serviceIds: [serviceId] });
      expect(walkIn.body.data.queueNumber).toBe(1);
      const ok = await request(ctx.app).post(`/businesses/${shop}/bookings/verify`).set(auth("sam")).send({ payload: body.checkIn.qrPayload });
      expect(ok.body.data.booking.status).toBe("queued");
      expect(ok.body.data.queueItem.queueNumber).toBe(2);
      const queue = await request(ctx.app).get(`/businesses/${shop}/queue`).set(auth("sam"));
      expect(queue.body.date).toBe("20261004");
      expect(queue.body.data.map((q: { queueNumber: number }) => q.queueNumber)).toEqual([1, 2]);
      const qid = ok.body.data.queueItem.id as string;
      await request(ctx.app).patch(`/businesses/${shop}/queue/${qid}`).set(auth("sam")).send({ status: "in_bay" });
      await request(ctx.app).patch(`/businesses/${shop}/queue/${qid}`).set(auth("sam")).send({ status: "done" });
      const ready = await riverCall(ctx.publicApp, "GET", `/v1/orders/${body.bookingId}`);
      expect(ready.body.status).toBe("ready");
    });

    it("customer-side check-in via the shop QR, scoped to the creating client", async () => {
      const { body } = await book();
      await request(ctx.app).post(`/businesses/${shop}/bookings/${body.bookingId}/accept`).set(auth("alice"));
      const otherClient = createPublicApp({ ...ctx.deps, river: { ...riverConfig(ctx.deps.store), clientId: "other-app" } });
      expect((await riverCall(otherClient, "GET", `/v1/bookings/${body.bookingId}`)).status).toBe(404);
      const wrongShop = await riverCall(ctx.publicApp, "POST", `/v1/bookings/${body.bookingId}/check-in`, { idem: "checkin-key-1", body: { shopQr: "MCW-SHOP.someone-else" } });
      expect(wrongShop.status).toBe(403);
      const ok = await riverCall(ctx.publicApp, "POST", `/v1/bookings/${body.bookingId}/check-in`, { idem: "checkin-key-2", body: { shopQr: `MCW-SHOP.${shop}` } });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe("checked_in");
      expect(ok.body.riverStatus).toBe("in_progress");
    });

    it("creates, reads and cancels through the shared /v1/orders contract", async () => {
      const created = await riverCall(ctx.publicApp, "POST", "/v1/orders", {
        idem: "order-key-0001",
        body: {
          shopId: shop,
          kind: "booking",
          source: "river_mobile",
          lines: [{ id: serviceId }],
          slot: { start: "2026-10-04T15:00:00+08:00" },
          vehicleSize: "small",
          plate: "ABC 123",
          customer: { ref: "rm-cust-002", name: "Maria Santos", phoneE164: "+639181113333" },
          externalRef: "RM-456",
        },
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ shopId: shop, status: "requested", source: "river_mobile" });
      const orderId = created.body.orderId as string;
      const owner = await request(ctx.app).get(`/businesses/${shop}/bookings/${orderId}`).set(auth("alice"));
      expect(owner.body.data).toMatchObject({ source: "river_mobile", status: "requested", plate: null });

      const cancel = await riverCall(ctx.publicApp, "POST", `/v1/orders/${orderId}/cancel`, { idem: "cancel-key-0001", body: { reason: "Change of plans" } });
      expect(cancel.status).toBe(200);
      expect(cancel.body.status).toBe("cancelled");
      const again = await riverCall(ctx.publicApp, "POST", `/v1/orders/${orderId}/cancel`, { idem: "cancel-key-0002", body: {} });
      expect(again.status).toBe(200);
      expect(again.body.status).toBe("cancelled");
      expect((await riverCall(ctx.publicApp, "POST", `/v1/orders/${orderId}/cancel`, { body: {} })).status).toBe(400);
      const alerts = await request(ctx.app).get(`/businesses/${shop}/alerts`).set(auth("alice"));
      expect(alerts.body.data.some((a: { title: string }) => a.title === "Booking cancelled")).toBe(true);
    });

    it("refuses to cancel once the car is checked in", async () => {
      const { body } = await book();
      await request(ctx.app).post(`/businesses/${shop}/bookings/${body.bookingId}/accept`).set(auth("sam"));
      await request(ctx.app).post(`/businesses/${shop}/bookings/verify`).set(auth("sam")).send({ payload: body.checkIn.qrPayload });
      const res = await riverCall(ctx.publicApp, "POST", `/v1/bookings/${body.bookingId}/cancel`, { idem: "cancel-late-1", body: {} });
      expect(res.status).toBe(409);
    });
  });
});
