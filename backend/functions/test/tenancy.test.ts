import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { addMember, auth, makeApps } from "./helpers.js";

/**
 * The tenancy fix: every /businesses/:businessId route checks the caller's
 * membership and role before touching data, and never auto-creates a business.
 */
describe("business tenancy", () => {
  let ctx: ReturnType<typeof makeApps>;
  let shopA: string;
  let shopB: string;

  beforeEach(async () => {
    ctx = makeApps();
    const a = await request(ctx.app).post("/businesses").set(auth("alice")).send({ name: "Alice Wash" });
    const b = await request(ctx.app).post("/businesses").set(auth("bob")).send({ name: "Bob Wash" });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    shopA = a.body.data.id;
    shopB = b.body.data.id;
    await addMember(ctx.deps.store, shopA, "sam", "staff");
  });

  it("requires a signed-in user", async () => {
    const res = await request(ctx.app).get(`/businesses/${shopA}`);
    expect(res.status).toBe(401);
    expect(res.headers["content-type"]).toContain("application/problem+json");
  });

  it("rejects an invalid token", async () => {
    const res = await request(ctx.app).get(`/businesses/${shopA}`).set({ Authorization: "Bearer nope" });
    expect(res.status).toBe(401);
  });

  it("creates the owner membership with the business, on the Partner plan", async () => {
    const res = await request(ctx.app).get(`/businesses/${shopA}`).set(auth("alice"));
    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe("partner");
    expect(res.body.membership.role).toBe("owner");
  });

  it("blocks a signed-in non-member from another shop (read and write)", async () => {
    const endpoints = [
      ["get", `/businesses/${shopB}`],
      ["patch", `/businesses/${shopB}`],
      ["get", `/businesses/${shopB}/members`],
      ["get", `/businesses/${shopB}/services`],
      ["post", `/businesses/${shopB}/services`],
      ["get", `/businesses/${shopB}/bookings`],
      ["post", `/businesses/${shopB}/bookings/verify`],
      ["get", `/businesses/${shopB}/queue`],
      ["get", `/businesses/${shopB}/audit-logs`],
    ] as const;
    for (const [method, url] of endpoints) {
      const res = await request(ctx.app)[method](url).set(auth("alice")).send({});
      expect(res.status, `${method} ${url}`).toBe(403);
    }
  });

  it("returns the same 403 for unknown businesses and never auto-creates them", async () => {
    const before = ctx.deps.store.paths().length;
    const res = await request(ctx.app).get("/businesses/does-not-exist").set(auth("alice"));
    expect(res.status).toBe(403);
    expect(ctx.deps.store.paths().length).toBe(before);
    expect(ctx.deps.store.paths().some((p) => p.includes("does-not-exist"))).toBe(false);
  });

  it("lets staff read but not do owner-only actions", async () => {
    expect((await request(ctx.app).get(`/businesses/${shopA}`).set(auth("sam"))).status).toBe(200);
    expect((await request(ctx.app).get(`/businesses/${shopA}/services`).set(auth("sam"))).status).toBe(200);
    const edit = await request(ctx.app).patch(`/businesses/${shopA}`).set(auth("sam")).send({ name: "Hacked" });
    expect(edit.status).toBe(403);
    const price = await request(ctx.app)
      .post(`/businesses/${shopA}/services`)
      .set(auth("sam"))
      .send({ name: "Basic wash", durationMins: 30, pricesBySize: { small: 15000 } });
    expect(price.status).toBe(403);
    expect((await request(ctx.app).get(`/businesses/${shopA}/audit-logs`).set(auth("sam"))).status).toBe(403);
  });

  it("revokes access immediately when the owner removes a staff member", async () => {
    const del = await request(ctx.app).delete(`/businesses/${shopA}/members/sam`).set(auth("alice"));
    expect(del.status).toBe(204);
    expect((await request(ctx.app).get(`/businesses/${shopA}`).set(auth("sam"))).status).toBe(403);
  });

  it("does not let the owner be removed", async () => {
    const res = await request(ctx.app).delete(`/businesses/${shopA}/members/alice`).set(auth("alice"));
    expect(res.status).toBe(409);
  });

  it("ignores a membership doc that points at a different business", async () => {
    // A forged/misfiled membership must not grant access.
    await ctx.deps.store.set(`businesses/${shopB}/members/alice`, {
      uid: "alice", businessId: shopA, role: "owner", status: "active",
    });
    expect((await request(ctx.app).get(`/businesses/${shopB}`).set(auth("alice"))).status).toBe(403);
  });

  it("lists only my own businesses in /me", async () => {
    const res = await request(ctx.app).get("/me").set(auth("sam"));
    expect(res.status).toBe(200);
    expect(res.body.businesses).toEqual([{
      id: shopA, name: "Alice Wash", plan: "partner", planStatus: "active", role: "staff",
      address: null, location: null, phoneE164: expect.any(String), riverMobileListed: false,
      settings: { dailyTargetCentavos: null },
      billing: expect.objectContaining({ status: "trial", partnerOption: null }),
    }]);
  });

  it("gates Paid features by plan and only lets platform admins change the plan", async () => {
    expect((await request(ctx.app).get(`/businesses/${shopA}/bays`).set(auth("alice"))).status).toBe(402);
    const selfUpgrade = await request(ctx.app).put(`/businesses/${shopA}/plan`).set(auth("alice")).send({ plan: "paid" });
    expect(selfUpgrade.status).toBe(403);
    const admin = await request(ctx.app).put(`/businesses/${shopA}/plan`).set(auth("ops", true)).send({ plan: "paid" });
    expect(admin.status).toBe(200);
    expect((await request(ctx.app).get(`/businesses/${shopA}/bays`).set(auth("alice"))).status).toBe(200);
  });

  it("writes audit logs for mutations", async () => {
    await request(ctx.app).patch(`/businesses/${shopA}`).set(auth("alice")).send({ name: "Alice Wash 2" });
    const res = await request(ctx.app).get(`/businesses/${shopA}/audit-logs`).set(auth("alice"));
    expect(res.body.data.map((l: { action: string }) => l.action)).toEqual(
      expect.arrayContaining(["business.create", "business.update"]),
    );
  });

  it("validates bodies with problem+json errors", async () => {
    const res = await request(ctx.app).post("/businesses").set(auth("alice")).send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("bad_request");
    expect(res.body.errors[0].path).toBe("name");
  });
});
