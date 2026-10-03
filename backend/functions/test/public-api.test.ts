import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApiClient } from "../src/services/api-clients-service.js";
import { addMember, auth, FIXED_NOW, makeApps } from "./helpers.js";

describe("River Mobile /v1 API and Scan", () => {
  let ctx: ReturnType<typeof makeApps>;
  let shop: string;
  let serviceId: string;
  let key: string;

  const bookingBody = () => ({
    shopId: shop,
    serviceIds: [serviceId],
    vehicleSize: "medium",
    plate: "NAB 1234",
    slotStart: "2026-10-04T15:00:00+08:00",
    customer: { ref: "rm-cust-001", name: "Juan Dela Cruz", phoneE164: "+639181112222" },
    externalBookingRef: "RM-123",
  });

  async function book(idem = "idem-key-0001") {
    return request(ctx.publicApp).post("/v1/bookings").set({ Authorization: `Bearer ${key}`, "Idempotency-Key": idem }).send(bookingBody());
  }

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
    ({ apiKey: key } = await createApiClient(
      ctx.deps.store,
      { clientId: "river-mobile", name: "River Mobile", environment: "local", scopes: ["shops:read", "bookings:write", "bookings:read", "checkin:write"] },
      "test-pepper",
      FIXED_NOW,
    ));
  });

  it("rejects missing or wrong API keys", async () => {
    expect((await request(ctx.publicApp).get(`/v1/shops/${shop}`)).status).toBe(401);
    const wrong = key.slice(0, -4) + "AAAA";
    expect((await request(ctx.publicApp).get(`/v1/shops/${shop}`).set({ Authorization: `Bearer ${wrong}` })).status).toBe(401);
  });

  it("enforces scopes", async () => {
    const { apiKey } = await createApiClient(ctx.deps.store, { clientId: "readonly", name: "RO", environment: "local", scopes: ["shops:read"] }, "test-pepper", FIXED_NOW);
    const res = await request(ctx.publicApp).post("/v1/bookings").set({ Authorization: `Bearer ${apiKey}`, "Idempotency-Key": "abcdefgh" }).send(bookingBody());
    expect(res.status).toBe(403);
  });

  it("only exposes shops that opted in to River Mobile", async () => {
    expect((await book()).status).toBe(404);
    await request(ctx.app).patch(`/businesses/${shop}`).set(auth("alice")).send({ riverMobileListed: true });
    expect((await request(ctx.publicApp).get(`/v1/shops/${shop}`).set({ Authorization: `Bearer ${key}` })).status).toBe(200);
  });

  describe("with a listed shop", () => {
    beforeEach(async () => {
      await request(ctx.app).patch(`/businesses/${shop}`).set(auth("alice")).send({ riverMobileListed: true });
    });

    it("requires an Idempotency-Key and replays repeats", async () => {
      const noKey = await request(ctx.publicApp).post("/v1/bookings").set({ Authorization: `Bearer ${key}` }).send(bookingBody());
      expect(noKey.status).toBe(400);
      const first = await book();
      expect(first.status).toBe(201);
      expect(first.body.status).toBe("requested");
      expect(first.body.reference).toMatch(/^CWS-/);
      const again = await book();
      expect(again.status).toBe(201);
      expect(again.headers["idempotent-replayed"]).toBe("true");
      expect(again.body.bookingId).toBe(first.body.bookingId);
      const list = await request(ctx.app).get(`/businesses/${shop}/bookings`).set(auth("sam"));
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].verifyCodeHash).toBeUndefined();
    });

    it("runs the Partner flow: requested -> accepted -> Scan verified -> completed", async () => {
      const { body } = await book();
      // Scan before accepting is refused.
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
      const status = await request(ctx.publicApp).get(`/v1/bookings/${body.bookingId}`).set({ Authorization: `Bearer ${key}` });
      expect(status.body.status).toBe("completed");
    });

    it("refuses a check-in QR scanned at a different shop", async () => {
      const { body } = await book();
      const other = await request(ctx.app).post("/businesses").set(auth("bob")).send({ name: "Bob Wash" });
      const res = await request(ctx.app).post(`/businesses/${other.body.data.id}/bookings/verify`).set(auth("bob")).send({ payload: body.checkIn.qrPayload });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("wrong_shop");
    });

    it("on Paid shops, Scan puts the car in the queue with a daily number", async () => {
      await request(ctx.app).put(`/businesses/${shop}/plan`).set(auth("ops", true)).send({ plan: "paid" });
      const { body } = await book();
      await request(ctx.app).post(`/businesses/${shop}/bookings/${body.bookingId}/accept`).set(auth("sam"));
      const walkIn = await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("sam")).send({ plate: "ABC 123" });
      expect(walkIn.body.data.queueNumber).toBe(1);
      const ok = await request(ctx.app).post(`/businesses/${shop}/bookings/verify`).set(auth("sam")).send({ payload: body.checkIn.qrPayload });
      expect(ok.body.data.booking.status).toBe("queued");
      expect(ok.body.data.queueItem.queueNumber).toBe(2);
      const queue = await request(ctx.app).get(`/businesses/${shop}/queue`).set(auth("sam"));
      expect(queue.body.date).toBe("20261004");
      expect(queue.body.data.map((q: { queueNumber: number }) => q.queueNumber)).toEqual([1, 2]);
    });

    it("customer-side check-in via the shop QR, scoped to the creating client", async () => {
      const { body } = await book();
      await request(ctx.app).post(`/businesses/${shop}/bookings/${body.bookingId}/accept`).set(auth("alice"));
      const { apiKey: otherKey } = await createApiClient(ctx.deps.store, { clientId: "other-app", name: "Other", environment: "local", scopes: ["bookings:read", "checkin:write"] }, "test-pepper", FIXED_NOW);
      expect((await request(ctx.publicApp).get(`/v1/bookings/${body.bookingId}`).set({ Authorization: `Bearer ${otherKey}` })).status).toBe(404);
      const wrongShop = await request(ctx.publicApp).post(`/v1/bookings/${body.bookingId}/check-in`).set({ Authorization: `Bearer ${key}` }).send({ shopQr: "MCW-SHOP.someone-else" });
      expect(wrongShop.status).toBe(403);
      const ok = await request(ctx.publicApp).post(`/v1/bookings/${body.bookingId}/check-in`).set({ Authorization: `Bearer ${key}` }).send({ shopQr: `MCW-SHOP.${shop}` });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe("checked_in");
    });
  });
});
