import request from "supertest";
import { describe, expect, it } from "vitest";
import { auth, makeApps, starterId } from "./helpers.js";

/** References in request bodies (customerId, queueItemId, bookingId) must belong to the route's shop. */
describe("tenant wall on body references", () => {
  async function twoShops() {
    const ctx = makeApps();
    const mk = async (uid: string, name: string) => {
      const id = (await request(ctx.app).post("/businesses").set(auth(uid)).send({ name })).body.data.id as string;
      await request(ctx.app).put(`/businesses/${id}/plan`).set(auth("ops", true)).send({ plan: "paid" });
      return id;
    };
    return { ctx, a: await mk("alice", "A Wash"), b: await mk("bob", "B Wash") };
  }

  it("rejects a sale linked to another shop's queue item or booking", async () => {
    const { ctx, a, b } = await twoShops();
    const foreign = (await request(ctx.app).post(`/businesses/${b}/queue`).set(auth("bob")).send({ serviceIds: [await starterId(ctx.app, b, "bob")] })).body.data.id as string;
    const viaQueue = await request(ctx.app).post(`/businesses/${a}/sales`).set(auth("alice")).send({ amountCentavos: 100, method: "cash", queueItemId: foreign });
    expect(viaQueue.status).toBe(422);
    expect(viaQueue.body.code).toBe("invalid_queue_item");
    const viaBooking = await request(ctx.app).post(`/businesses/${a}/sales`).set(auth("alice")).send({ amountCentavos: 100, method: "cash", bookingId: foreign });
    expect(viaBooking.body.code).toBe("invalid_booking");
    expect((await request(ctx.app).post(`/businesses/${a}/sales`).set(auth("alice")).send({ amountCentavos: 100, method: "cash" })).status).toBe(201);
  });

  it("rejects a walk-in pointing at another shop's customer", async () => {
    const { ctx, a, b } = await twoShops();
    const cust = (await request(ctx.app).post(`/businesses/${b}/customers`).set(auth("bob")).send({ name: "Bob's regular" })).body.data.id as string;
    const res = await request(ctx.app).post(`/businesses/${a}/queue`).set(auth("alice")).send({ serviceIds: [await starterId(ctx.app, a, "alice")], customerId: cust });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("invalid_customer");
  });

  it("never serves another shop's data to a non-member", async () => {
    const { ctx, b } = await twoShops();
    for (const path of ["", "/queue", "/services", "/bookings", "/sales", "/companion"]) {
      expect((await request(ctx.app).get(`/businesses/${b}${path}`).set(auth("alice"))).status).toBe(403);
    }
  });
});
