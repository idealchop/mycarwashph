import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/services/api-clients-service.js";
import { paths } from "../src/services/paths.js";
import { STARTER_SERVICES } from "../src/services/starter-services.js";
import { auth, FIXED_NOW, makeApps } from "./helpers.js";

const list = async (ctx: ReturnType<typeof makeApps>, shop: string) =>
  (await request(ctx.app).get(`/businesses/${shop}/services`).set(auth("owner"))).body.data as { name: string; category: string; listedOnRiverMobile: boolean; pricesBySize: Record<string, number> }[];

/** An old shop: created before starters (no flag), optionally with some services. */
async function legacyShop(names: string[]) {
  const ctx = makeApps();
  const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Old Wash" })).body.data.id as string;
  for (const s of await ctx.deps.store.list(paths.services(shop))) await ctx.deps.store.delete(paths.service(shop, s.id));
  await ctx.deps.store.update(paths.business(shop), { starterServicesAt: null });
  for (const name of names) await ctx.deps.store.create(paths.service(shop, ctx.deps.store.newId()), { name, durationMins: 30, pricesBySize: { small: 20000 }, active: true, listedOnRiverMobile: true, createdAt: "x", updatedAt: "x" });
  return { ctx, shop };
}

describe("starter services and categories", () => {
  it("seeds the starter menu on shop creation, published to River Mobile, Basic Wash at 200/250/300/350", async () => {
    const ctx = makeApps();
    const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "New Wash" })).body.data.id as string;
    const rows = await list(ctx, shop);
    expect(rows).toHaveLength(STARTER_SERVICES.length);
    expect(rows.every((r) => r.listedOnRiverMobile)).toBe(true);
    expect(rows.find((r) => r.name === "Basic Wash")!.pricesBySize).toEqual({ small: 20000, medium: 25000, large: 30000, xl: 35000 });
    expect(new Set(rows.map((r) => r.category)).size).toBe(6);
  });

  it("backfills shops with no services or only Basic Wash, once, without touching Basic Wash", async () => {
    const empty = await legacyShop([]);
    expect(await list(empty.ctx, empty.shop)).toHaveLength(STARTER_SERVICES.length);
    const basic = await legacyShop(["Basic Wash"]);
    const rows = await list(basic.ctx, basic.shop);
    expect(rows).toHaveLength(STARTER_SERVICES.length);
    expect(rows.find((r) => r.name === "Basic Wash")!.pricesBySize).toEqual({ small: 20000 });
    expect(await list(basic.ctx, basic.shop)).toHaveLength(STARTER_SERVICES.length);
  });

  it("leaves shops with their own menu alone", async () => {
    const { ctx, shop } = await legacyShop(["Premium Wash", "Wax"]);
    expect((await list(ctx, shop)).map((r) => r.name).sort()).toEqual(["Premium Wash", "Wax"]);
  });

  it("accepts category and icon, no longer requires minutes, and rejects unknown categories", async () => {
    const ctx = makeApps();
    const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Cat Wash" })).body.data.id as string;
    const ok = await request(ctx.app).post(`/businesses/${shop}/services`).set(auth("owner")).send({ name: "Ceramic", category: "wax-coating", icon: "sparkle", pricesBySize: { small: 500000 } });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ category: "wax-coating", icon: "sparkle" });
    const plain = await request(ctx.app).post(`/businesses/${shop}/services`).set(auth("owner")).send({ name: "Plain" });
    expect(plain.body.data.category).toBe("car-wash");
    expect((await request(ctx.app).post(`/businesses/${shop}/services`).set(auth("owner")).send({ name: "X", category: "spa" })).status).toBe(400);
  });

  it("adds category and icon to /v1 services and keeps durationMins for older clients", async () => {
    const ctx = makeApps();
    const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "V1 Wash" })).body.data.id as string;
    await request(ctx.app).patch(`/businesses/${shop}`).set(auth("owner")).send({ riverMobileListed: true });
    const { apiKey } = await createApiClient(ctx.deps.store, { clientId: "river-mobile", name: "River Mobile", environment: "local", scopes: ["shops:read"] }, "test-pepper", FIXED_NOW);
    const res = await request(ctx.publicApp).get(`/v1/shops/${shop}/services`).set({ Authorization: `Bearer ${apiKey}` });
    expect(res.status).toBe(200);
    expect(res.body.data.find((s: { name: string }) => s.name === "Hand Wax")).toMatchObject({ category: "wax-coating", icon: "shield", durationMins: 30 });
  });
});
