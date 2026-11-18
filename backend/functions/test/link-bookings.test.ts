import request from "supertest";
import { describe, expect, it } from "vitest";
import { auth, makeApps, starterId } from "./helpers.js";

describe("booking link (/book)", () => {
  it("shows the shop, takes a request without sign-in, and the ticket follows it", async () => {
    const ctx = makeApps();
    const a = (await request(ctx.app).post("/businesses").set(auth("alice")).send({ name: "A Wash" })).body.data.id as string;
    const shop = await request(ctx.app).get(`/public/shops/${a}`);
    expect(shop.status).toBe(200);
    expect(shop.body.data.name).toBe("A Wash");
    expect(shop.body.data.services.length).toBeGreaterThan(3);
    expect(shop.body.data.onlineCheckout).toBe(false);
    const svc = await starterId(ctx.app, a, "alice");
    const res = await request(ctx.app).post(`/public/shops/${a}/bookings`).send({ serviceIds: [svc], vehicleSize: "large", name: "Ana", contact: "0917 123 4567", payPref: "online" });
    expect(res.status).toBe(201);
    const { bookingId, token, ticket } = res.body.data;
    expect(ticket.stage).toBe("sent");
    expect(ticket.payPref).toBe("shop"); // checkout is off
    expect(ticket.totalCentavos).toBe(30000);
    expect((await request(ctx.app).get(`/public/shops/${a}/bookings/${bookingId}?t=wrong`)).status).toBe(404);
    const owner = await request(ctx.app).get(`/businesses/${a}/bookings`).set(auth("alice"));
    const bk = owner.body.data.find((x: { id: string }) => x.id === bookingId);
    expect(bk.source).toBe("online_link");
    expect(bk.customerSnapshot).toEqual({ name: "Ana", phoneE164: "+639171234567" });
    expect(bk.linkTokenHash).toBeDefined();
    expect(bk.plate).toBeNull();
    const t = await request(ctx.app).get(`/public/shops/${a}/bookings/${bookingId}?t=${token}`);
    expect(t.body.data.reference).toMatch(/^CWS-/);
  });

  it("rejects unknown shops and removed shops", async () => {
    const ctx = makeApps();
    expect((await request(ctx.app).get(`/public/shops/nope`)).status).toBe(404);
    const a = (await request(ctx.app).post("/businesses").set(auth("alice")).send({ name: "A Wash" })).body.data.id as string;
    expect((await request(ctx.app).delete(`/businesses/${a}`).set(auth("alice"))).status).toBe(204);
    expect((await request(ctx.app).get(`/public/shops/${a}`)).status).toBe(404);
    expect((await request(ctx.app).get(`/businesses/${a}`).set(auth("alice"))).status).toBe(403);
    expect((await request(ctx.app).get(`/me`).set(auth("alice"))).body.businesses).toEqual([]);
  });

  it("only the owner can remove a shop", async () => {
    const ctx = makeApps();
    const a = (await request(ctx.app).post("/businesses").set(auth("alice")).send({ name: "A Wash" })).body.data.id as string;
    expect((await request(ctx.app).delete(`/businesses/${a}`).set(auth("bob"))).status).toBe(403);
  });
});
