import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../src/services/api-clients-service.js";
import { auth, FIXED_NOW, makeApps } from "./helpers.js";

describe("sales + invites + alerts", () => {
  it("records a sale when a queue item is marked paid and summarises the day", async () => {
    const ctx = makeApps();
    const created = await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Pay Wash" });
    const shop = created.body.data.id as string;
    await request(ctx.app).put(`/businesses/${shop}/plan`).set(auth("ops", true)).send({ plan: "paid" });
    await request(ctx.app).post(`/businesses/${shop}/bays`).set(auth("owner")).send({ name: "Bay 1", sortOrder: 0 });
    const q = await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ plate: "ABC1234", serviceIds: [] });
    const qid = q.body.data.id as string;
    const bay = (await request(ctx.app).get(`/businesses/${shop}/bays`).set(auth("owner"))).body.data[0].id as string;
    await request(ctx.app).patch(`/businesses/${shop}/queue/${qid}`).set(auth("owner")).send({ status: "in_bay", bayId: bay });
    await request(ctx.app).patch(`/businesses/${shop}/queue/${qid}`).set(auth("owner")).send({ status: "done" });
    const paid = await request(ctx.app)
      .patch(`/businesses/${shop}/queue/${qid}`)
      .set(auth("owner"))
      .send({ status: "paid", sale: { amountCentavos: 35000, method: "gcash", paymentRef: "GC-1" } });
    expect(paid.status).toBe(200);
    expect(paid.body.sale.amountCentavos).toBe(35000);
    const summary = await request(ctx.app).get(`/businesses/${shop}/sales/summary`).set(auth("owner"));
    expect(summary.status).toBe(200);
    expect(summary.body.data.totalCentavos).toBe(35000);
    expect(summary.body.data.cars).toBe(1);
  });

  it("lets an invited staff member accept by matching phone", async () => {
    const ctx = makeApps();
    const created = await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Team Wash" });
    const shop = created.body.data.id as string;
    const invite = await request(ctx.app)
      .post(`/businesses/${shop}/members/invites`)
      .set(auth("owner"))
      .send({ email: "staff1@example.com", role: "staff" });
    expect(invite.status).toBe(201);
    const inviteId = invite.body.data.id as string;
    const accept = await request(ctx.app).post(`/invites/${inviteId}/accept`).set(auth("staff1"));
    expect(accept.status).toBe(200);
    expect(accept.body.data.businessId).toBe(shop);
    const me = await request(ctx.app).get("/me").set(auth("staff1"));
    expect(me.body.businesses.some((b: { id: string }) => b.id === shop)).toBe(true);
  });

  it("stores in-app alerts for new River Mobile bookings", async () => {
    const ctx = makeApps();
    const created = await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Alert Wash" });
    const shop = created.body.data.id as string;
    await request(ctx.app).patch(`/businesses/${shop}`).set(auth("owner")).send({ riverMobileListed: true });
    const svc = await request(ctx.app).post(`/businesses/${shop}/services`).set(auth("owner")).send({
      name: "Wash",
      durationMins: 30,
      pricesBySize: { small: 25000 },
      listedOnRiverMobile: true,
    });
    const { apiKey } = await createApiClient(
      ctx.deps.store,
      { clientId: "river-mobile", name: "River Mobile", environment: "local", scopes: ["bookings:write", "shops:read", "bookings:read", "checkin:write"] },
      "test-pepper",
      FIXED_NOW,
    );
    const book = await request(ctx.publicApp)
      .post("/v1/bookings")
      .set({ Authorization: `Bearer ${apiKey}`, "Idempotency-Key": "idem-alert-1" })
      .send({
        shopId: shop,
        serviceIds: [svc.body.data.id],
        vehicleSize: "small",
        slotStart: "2026-10-04T04:00:00.000Z",
        customer: { ref: "c1", name: "Ana", phoneE164: "+639171111111" },
      });
    expect(book.status).toBe(201);
    const alerts = await request(ctx.app).get(`/businesses/${shop}/alerts`).set(auth("owner"));
    expect(alerts.status).toBe(200);
    expect(alerts.body.data[0].type).toBe("booking.requested");
  });
});
