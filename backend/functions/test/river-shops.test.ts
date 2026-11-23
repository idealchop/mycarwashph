import request from "supertest";
import { describe, expect, it } from "vitest";
import { coveringPrefixes, distanceKm, encodeGeohash } from "../src/river/geo.js";
import { auth, makeApps } from "./helpers.js";
import { riverCall } from "./river-helpers.js";

const QC = { lat: 14.676, lng: 121.0437 };

async function shopAt(ctx: ReturnType<typeof makeApps>, uid: string, name: string, lat: number, lng: number, listed = true) {
  const id = (await request(ctx.app).post("/businesses").set(auth(uid)).send({ name })).body.data.id as string;
  await request(ctx.app).patch(`/businesses/${id}`).set(auth(uid)).send({
    riverMobileListed: listed,
    location: { lat, lng, formattedAddress: `${name} address`, placeId: null },
  });
  return id;
}

describe("geohash helpers", () => {
  it("encodes a known point", () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
  });

  it("covers a radius with at most 9 prefixes", () => {
    for (const r of [0.5, 5, 25, 100, 200]) {
      const cells = coveringPrefixes(QC.lat, QC.lng, r);
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.length).toBeLessThanOrEqual(9);
      expect(cells.some((c) => encodeGeohash(QC.lat, QC.lng, 9).startsWith(c))).toBe(true);
    }
  });
});

describe("GET /v1/shops (near me)", () => {
  it("lists listed, active shops nearest first with distanceKm and pages with a cursor", async () => {
    const ctx = makeApps();
    const near = await shopAt(ctx, "o1", "Near Wash", 14.68, 121.045);
    const mid = await shopAt(ctx, "o2", "Mid Wash", 14.7, 121.06);
    const far = await shopAt(ctx, "o3", "Far Wash", 14.55, 121.0);
    await shopAt(ctx, "o4", "Hidden Wash", 14.677, 121.044, false);
    await shopAt(ctx, "o5", "Cebu Wash", 10.3157, 123.8854);

    const res = await riverCall(ctx.publicApp, "GET", `/v1/shops?lat=${QC.lat}&lng=${QC.lng}&radiusKm=25&limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.shops.map((s: { id: string }) => s.id)).toEqual([near, mid]);
    expect(res.body.shops[0].distanceKm).toBeCloseTo(distanceKm(QC.lat, QC.lng, 14.68, 121.045), 1);
    expect(res.body.shops[0]).toMatchObject({ name: "Near Wash", address: "Near Wash address", plan: "partner" });
    expect(res.body.nextCursor).toBeTruthy();

    const page2 = await riverCall(ctx.publicApp, "GET", `/v1/shops?lat=${QC.lat}&lng=${QC.lng}&radiusKm=25&limit=2&cursor=${res.body.nextCursor}`);
    expect(page2.body.shops.map((s: { id: string }) => s.id)).toEqual([far]);
    expect(page2.body.nextCursor).toBeNull();

    const wrongCursor = await riverCall(ctx.publicApp, "GET", `/v1/shops?lat=14.5&lng=${QC.lng}&radiusKm=25&cursor=${res.body.nextCursor}`);
    expect(wrongCursor.status).toBe(400);
  });

  it("drops shops that unlist, are suspended or removed", async () => {
    const ctx = makeApps();
    const a = await shopAt(ctx, "o1", "A Wash", 14.68, 121.045);
    const b = await shopAt(ctx, "o2", "B Wash", 14.681, 121.046);
    const c = await shopAt(ctx, "o3", "C Wash", 14.682, 121.047);
    await request(ctx.app).patch(`/businesses/${a}`).set(auth("o1")).send({ riverMobileListed: false });
    await ctx.deps.store.update(`businesses/${b}`, { planStatus: "suspended" });
    const removed = await request(ctx.app).delete(`/businesses/${c}`).set(auth("o3"));
    expect([200, 204]).toContain(removed.status);
    const res = await riverCall(ctx.publicApp, "GET", `/v1/shops?lat=${QC.lat}&lng=${QC.lng}`);
    expect(res.body.shops).toEqual([]);
  });

  it("validates lat, lng, radiusKm and limit", async () => {
    const ctx = makeApps();
    for (const q of ["", "lat=14.6", "lat=x&lng=121", "lat=14.6&lng=121&radiusKm=500", "lat=14.6&lng=121&limit=51", "lat=14.6&lng=121&limit=0"]) {
      const res = await riverCall(ctx.publicApp, "GET", `/v1/shops?${q}`);
      expect(res.status).toBe(400);
    }
  });
});
