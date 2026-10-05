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
    expect(pricing.body.data.pricing.paid.status).toBe("tbd");

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

    await deps.store.update(`businesses/${id}`, { plan: "paid" });
    const bad = await request(app)
      .post(`/businesses/${id}/billing/select`)
      .set(auth("owner3"))
      .send({ partnerOption: "monthly" });
    expect(bad.status).toBe(400);
  });
});
