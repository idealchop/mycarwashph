import request from "supertest";
import { describe, expect, it } from "vitest";
import { PARTNER_PRICING } from "../src/models/types.js";
import { createApiClient } from "../src/services/api-clients-service.js";
import { auth, FIXED_NOW, makeApps } from "./helpers.js";

describe("location + partner billing", () => {
  it("persists address/location and exposes them on /v1 when listed", async () => {
    const { app, publicApp, deps } = makeApps();
    const created = await request(app).post("/businesses").set(auth("owner1")).send({
      name: "Map Wash",
      address: "123 Maginhawa St, Quezon City",
      location: { lat: 14.65, lng: 121.05, formattedAddress: "123 Maginhawa St, Quezon City", placeId: "ChIJtest" },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    expect(created.body.data.location.lat).toBe(14.65);
    expect(created.body.data.billing.status).toBe("trial");

    const patched = await request(app)
      .patch(`/businesses/${id}`)
      .set(auth("owner1"))
      .send({
        riverMobileListed: true,
        location: { lat: 14.66, lng: 121.06, formattedAddress: "Updated QC", placeId: null },
        address: "Updated QC",
      });
    expect(patched.status).toBe(200);
    expect(patched.body.data.location.lat).toBe(14.66);

    const { apiKey } = await createApiClient(
      deps.store,
      { clientId: "river-mobile", name: "River Mobile", environment: "local", scopes: ["shops:read"] },
      "test-pepper",
      FIXED_NOW,
    );
    const shop = await request(publicApp).get(`/v1/shops/${id}`).set({ Authorization: `Bearer ${apiKey}` });
    expect(shop.status).toBe(200);
    expect(shop.body.location).toEqual({ lat: 14.66, lng: 121.06, formattedAddress: "Updated QC" });
    expect(shop.body.address).toBe("Updated QC");
  });

  it("records Partner package selection and payment intent", async () => {
    const { app } = makeApps();
    const created = await request(app).post("/businesses").set(auth("owner2")).send({ name: "Bill Wash" });
    const id = created.body.data.id as string;

    const pricing = await request(app).get(`/businesses/${id}/billing`).set(auth("owner2"));
    expect(pricing.status).toBe(200);
    expect(pricing.body.data.pricing.partner.monthlyCentavos).toBe(PARTNER_PRICING.monthlyCentavos);
    expect(PARTNER_PRICING.monthlyCentavos).toBe(49_900);
    const tiers = pricing.body.data.pricing.tiers as { id: string; centavos: number; originalCentavos: number; name: string }[];
    expect(tiers.map((t) => [t.id, t.name, t.centavos, t.originalCentavos])).toEqual([
      ["monthly", "Pro", 49_900, 95_000],
      ["lifetime", "Lifetime", 1_000_000, 1_800_000],
      ["lifetime_5plus", "Lifetime", 2_000_000, 3_500_000],
    ]);
    expect(JSON.stringify(pricing.body.data.pricing)).not.toMatch(/free|tbd|chain/i);

    const select = await request(app)
      .post(`/businesses/${id}/billing/select`)
      .set(auth("owner2"))
      .send({ partnerOption: "monthly" });
    expect(select.status).toBe(200);
    expect(select.body.data.billing.partnerOption).toBe("monthly");
    expect(select.body.data.billing.status).toBe("unpaid");

    const pay = await request(app)
      .post(`/businesses/${id}/billing/confirm-payment`)
      .set(auth("owner2"))
      .send({ method: "gcash", paymentRef: "GCASH-123" });
    expect(pay.status).toBe(200);
    expect(pay.body.data.billing.status).toBe("pending");
    expect(pay.body.data.billing.lastPayment.amountCentavos).toBe(PARTNER_PRICING.monthlyCentavos);

    const activate = await request(app)
      .put(`/businesses/${id}/billing/activate`)
      .set(auth("owner2", true))
      .send({ status: "active" });
    expect(activate.status).toBe(200);
    expect(activate.body.data.billing.status).toBe("active");
    expect(activate.body.data.billing.expiresAt).toBeTruthy();
  });

  it("uses lifetime Partner price and blocks Partner select on Paid shops", async () => {
    const { app, deps } = makeApps();
    const created = await request(app).post("/businesses").set(auth("owner3")).send({ name: "Life Wash" });
    const id = created.body.data.id as string;
    await request(app).post(`/businesses/${id}/billing/select`).set(auth("owner3")).send({ partnerOption: "lifetime" });
    const pay = await request(app)
      .post(`/businesses/${id}/billing/confirm-payment`)
      .set(auth("owner3"))
      .send({ method: "bank", paymentRef: "BDO-99" });
    expect(pay.body.data.billing.lastPayment.amountCentavos).toBe(PARTNER_PRICING.lifetimeCentavos);

    const big = await request(app).post(`/businesses/${id}/billing/select`).set(auth("owner3")).send({ partnerOption: "lifetime_5plus" });
    expect(big.status).toBe(200);
    const pay5 = await request(app).post(`/businesses/${id}/billing/confirm-payment`).set(auth("owner3")).send({ method: "bank" });
    expect(pay5.body.data.billing.lastPayment.amountCentavos).toBe(2_000_000);
    const life = await request(app).put(`/businesses/${id}/billing/activate`).set(auth("owner3", true)).send({ status: "active" });
    expect(life.body.data.billing.expiresAt).toBeNull();
    expect((await request(app).post(`/businesses/${id}/billing/select`).set(auth("owner3")).send({ partnerOption: "chain" })).status).toBe(400);

    await deps.store.update(`businesses/${id}`, { plan: "paid" });
    const bad = await request(app)
      .post(`/businesses/${id}/billing/select`)
      .set(auth("owner3"))
      .send({ partnerOption: "monthly" });
    expect(bad.status).toBe(400);
  });
});

describe("shop photos (API upload)", () => {
  it("lets the owner upload and delete photos; staff and bad types are rejected", async () => {
    const { makeDeps } = await import("./helpers.js");
    const { createApp } = await import("../src/app.js");
    const saved = new Map<string, Buffer>();
    const deps = makeDeps();
    deps.photos = {
      async save(path, data) {
        saved.set(path, data);
        return `https://firebasestorage.googleapis.com/v0/b/test/o/${encodeURIComponent(path)}?alt=media&token=t`;
      },
      async remove(path) {
        saved.delete(path);
      },
      pathFromUrl(url) {
        const p = "https://firebasestorage.googleapis.com/v0/b/test/o/";
        return url.startsWith(p) ? decodeURIComponent(url.slice(p.length).split("?")[0]!) : null;
      },
    };
    const app = createApp(deps);
    const created = await request(app).post("/businesses").set(auth("owner1")).send({ name: "Photo Wash" });
    const id = created.body.data.id as string;

    const up = await request(app).post(`/businesses/${id}/photos`).set(auth("owner1")).set("Content-Type", "image/jpeg").send(Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]));
    expect(up.status).toBe(201);
    const url = up.body.data.url as string;
    expect(url).toContain(encodeURIComponent(`businesses/${id}/photos/owner1_`));
    expect(saved.size).toBe(1);

    const bad = await request(app).post(`/businesses/${id}/photos`).set(auth("owner1")).set("Content-Type", "text/plain").send("hi");
    expect(bad.status).toBe(400);
    const stranger = await request(app).post(`/businesses/${id}/photos`).set(auth("other")).set("Content-Type", "image/png").send(Buffer.from([1]));
    expect(stranger.status).toBe(403);

    const del = await request(app).delete(`/businesses/${id}/photos`).set(auth("owner1")).send({ url });
    expect(del.status).toBe(204);
    expect(saved.size).toBe(0);
  });
});
