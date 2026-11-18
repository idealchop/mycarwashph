import request from "supertest";
import { describe, expect, it } from "vitest";
import { auth, makeApps, starterId } from "./helpers.js";

describe("staff links (no account)", () => {
  it("gives queue-only access to one shop and can be reset or turned off", async () => {
    const ctx = makeApps();
    const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Link Wash" })).body.data.id as string;
    const other = (await request(ctx.app).post("/businesses").set(auth("other")).send({ name: "Other Wash" })).body.data.id as string;
    expect((await request(ctx.app).post(`/businesses/${shop}/staff-links`).set(auth("other")).send({ name: "X" })).status).toBe(403);
    const created = await request(ctx.app).post(`/businesses/${shop}/staff-links`).set(auth("owner")).send({ name: "Jun" });
    expect(created.status).toBe(201);
    const token = created.body.data.token as string;
    expect(token.length).toBeGreaterThanOrEqual(32);
    const L = { "x-staff-link": token };

    const who = await request(ctx.app).get("/public/staff-link").set(L);
    expect(who.status).toBe(200);
    expect(who.body.data.business.id).toBe(shop);
    expect(who.body.data.business.role).toBe("staff");

    // Allowed: shop, services, queue, walk-in.
    expect((await request(ctx.app).get(`/businesses/${shop}`).set(L)).status).toBe(200);
    expect((await request(ctx.app).get(`/businesses/${shop}/queue`).set(L)).status).toBe(200);
    const walkIn = await request(ctx.app).post(`/businesses/${shop}/queue`).set(L).send({ serviceIds: [await starterId(ctx.app, shop)] });
    expect(walkIn.status).toBe(201);
    // Not allowed: sales, settings, billing, members, other shops.
    for (const p of ["sales", "sales/summary", "billing", "members", "staff-links", "finance/week"]) {
      expect((await request(ctx.app).get(`/businesses/${shop}/${p}`).set(L)).status).toBe(403);
    }
    expect((await request(ctx.app).patch(`/businesses/${shop}`).set(L).send({ name: "Hacked" })).status).toBe(403);
    expect((await request(ctx.app).get(`/businesses/${other}/queue`).set(L)).status).toBe(403);
    expect((await request(ctx.app).get("/me").set(L)).status).toBe(403);
    expect((await request(ctx.app).get(`/businesses/${shop}/queue`).set({ "x-staff-link": "x".repeat(40) })).status).toBe(401);

    // Reset: old token stops, new works.
    const reset = await request(ctx.app).post(`/businesses/${shop}/staff-links/${created.body.data.id}/reset`).set(auth("owner"));
    expect(reset.status).toBe(200);
    expect((await request(ctx.app).get(`/businesses/${shop}/queue`).set(L)).status).toBe(401);
    const L2 = { "x-staff-link": reset.body.data.token as string };
    expect((await request(ctx.app).get(`/businesses/${shop}/queue`).set(L2)).status).toBe(200);
    // Turn off.
    expect((await request(ctx.app).delete(`/businesses/${shop}/staff-links/${created.body.data.id}`).set(auth("owner"))).status).toBe(204);
    expect((await request(ctx.app).get(`/businesses/${shop}/queue`).set(L2)).status).toBe(401);
    expect((await request(ctx.app).get("/public/staff-link").set(L2)).status).toBe(404);
  });
});
