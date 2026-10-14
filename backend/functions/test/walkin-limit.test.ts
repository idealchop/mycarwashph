import request from "supertest";
import { describe, expect, it } from "vitest";
import { auth, makeApps, starterId } from "./helpers.js";

async function shopWith(plan?: "paid") {
  const ctx = makeApps();
  const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Limit Wash" })).body.data.id as string;
  if (plan) await request(ctx.app).put(`/businesses/${shop}/plan`).set(auth("ops", true)).send({ plan });
  return { ctx, shop };
}
const walkIn = async (ctx: ReturnType<typeof makeApps>, shop: string) =>
  request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ serviceIds: [await starterId(ctx.app, shop)], vehicleSize: "medium" });

describe("Partner daily walk-in limit", () => {
  it("lets Partner add 10 walk-ins a Manila day and refuses the 11th with walkin_limit", async () => {
    const { ctx, shop } = await shopWith();
    for (let i = 1; i <= 10; i++) {
      const r = await walkIn(ctx, shop);
      expect(r.status).toBe(201);
      expect(r.body.walkIns).toEqual({ used: i, limit: 10, left: 10 - i });
    }
    const eleventh = await walkIn(ctx, shop);
    expect(eleventh.status).toBe(402);
    const problem = JSON.parse(eleventh.text);
    expect(problem.code).toBe("walkin_limit");
    expect(problem.errors.limit).toBe("walk-ins");
    expect(problem.title).toContain("Pro or Lifetime");
    expect(problem.title).not.toMatch(/free/i);
    const list = await request(ctx.app).get(`/businesses/${shop}/queue`).set(auth("owner"));
    expect(list.body.data).toHaveLength(10);
    expect(list.body.walkIns).toEqual({ used: 10, limit: 10, left: 0 });
  });

  it("resets at Manila midnight", async () => {
    const { ctx, shop } = await shopWith();
    for (let i = 0; i < 10; i++) await walkIn(ctx, shop);
    expect((await walkIn(ctx, shop)).status).toBe(402);
    const base = ctx.deps.now();
    ctx.deps.now = () => new Date(base.getTime() + 24 * 3600 * 1000);
    expect((await walkIn(ctx, shop)).status).toBe(201);
  });

  it("is race-safe: concurrent adds never pass the cap", async () => {
    const { ctx, shop } = await shopWith();
    const results = await Promise.all(Array.from({ length: 15 }, () => walkIn(ctx, shop)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(10);
    expect(results.filter((r) => r.status === 402)).toHaveLength(5);
  });

  it("is unlimited on Pro and Lifetime", async () => {
    const { ctx, shop } = await shopWith("paid");
    for (let i = 0; i < 12; i++) expect((await walkIn(ctx, shop)).status).toBe(201);
    const list = await request(ctx.app).get(`/businesses/${shop}/queue`).set(auth("owner"));
    expect(list.body.walkIns).toEqual({ used: 12, limit: null, left: null });
  });

  it("lets a Partner walk-in run through start, done and paid without a bay", async () => {
    const { ctx, shop } = await shopWith();
    const id = (await walkIn(ctx, shop)).body.data.id as string;
    const path = `/businesses/${shop}/queue/${id}`;
    expect((await request(ctx.app).patch(path).set(auth("owner")).send({ status: "in_bay" })).status).toBe(200);
    expect((await request(ctx.app).patch(path).set(auth("owner")).send({ status: "done" })).status).toBe(200);
    const paid = await request(ctx.app).patch(path).set(auth("owner")).send({ status: "paid", sale: { amountCentavos: 20000, method: "cash" } });
    expect(paid.status).toBe(200);
  });
});

describe("Companion single thread pagination", () => {
  it("returns the newest page and lazy-loads older messages with ?before", async () => {
    const { ctx, shop } = await shopWith();
    const { companionPaths } = await import("../src/services/companion/store.js");
    for (let i = 0; i < 35; i++) {
      const at = new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString();
      await ctx.deps.store.set(`${companionPaths.messages(shop)}/m${String(i).padStart(2, "0")}`, { role: "owner", kind: "chat", text: `q${i}`, createdAt: at });
    }
    const first = await request(ctx.app).get(`/businesses/${shop}/companion`).set(auth("owner"));
    expect(first.body.data.messages).toHaveLength(30);
    expect(first.body.data.messages[0].text).toBe("q5");
    expect(first.body.data.hasMore).toBe(true);
    const older = await request(ctx.app).get(`/businesses/${shop}/companion/messages`).query({ before: first.body.data.messages[0].createdAt }).set(auth("owner"));
    expect(older.body.data.map((m: { text: string }) => m.text)).toEqual(["q0", "q1", "q2", "q3", "q4"]);
    expect(older.body.hasMore).toBe(false);
  });
});
