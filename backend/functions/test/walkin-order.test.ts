import request from "supertest";
import { describe, expect, it } from "vitest";
import { auth, makeApps } from "./helpers.js";

async function shopWithServices() {
  const ctx = makeApps();
  const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Order Wash" })).body.data.id as string;
  const svc = async (name: string, prices: Record<string, number>, mins: number) =>
    (await request(ctx.app).post(`/businesses/${shop}/services`).set(auth("owner")).send({ name, durationMins: mins, pricesBySize: prices })).body.data.id as string;
  const basic = await svc("Basic Wash", { small: 20000, medium: 25000, large: 30000, xl: 35000 }, 30);
  const wax = await svc("Wax", { small: 15000, medium: 15000, large: 20000, xl: 20000 }, 20);
  return { ctx, shop, basic, wax };
}

describe("Walk-in orders: services from Settings, server-side price, no plate", () => {
  it("prices the picked services by size and ignores a plate number", async () => {
    const { ctx, shop, basic, wax } = await shopWithServices();
    const res = await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner"))
      .send({ serviceIds: [basic, wax], vehicleSize: "large", customerName: "Ana", notes: "Extra tires", plate: "ABC 123", totalCentavos: 1 });
    expect(res.status).toBe(201);
    const item = res.body.data;
    expect(item.lines).toEqual([
      { serviceId: basic, name: "Basic Wash", priceCentavos: 30000, durationMins: 30 },
      { serviceId: wax, name: "Wax", priceCentavos: 20000, durationMins: 20 },
    ]);
    expect(item.totalCentavos).toBe(50000);
    expect(item.durationMins).toBe(50);
    expect(item.customerName).toBe("Ana");
    expect(item.plate).toBeUndefined();
    const one = await request(ctx.app).get(`/businesses/${shop}/queue/${item.id}`).set(auth("owner"));
    expect(one.body.data.totalCentavos).toBe(50000);
  });

  it("refuses unknown services and requires one when the shop has services", async () => {
    const { ctx, shop } = await shopWithServices();
    const bad = await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ serviceIds: ["nope"] });
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe("invalid_service");
    const none = await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ serviceIds: [] });
    expect(none.body.code).toBe("service_required");
  });

  it("edits services afterwards (price recomputed), then pays the order total by default", async () => {
    const { ctx, shop, basic, wax } = await shopWithServices();
    const id = (await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ serviceIds: [basic] })).body.data.id as string;
    const path = `/businesses/${shop}/queue/${id}`;
    const edited = await request(ctx.app).patch(path).set(auth("owner")).send({ serviceIds: [basic, wax], vehicleSize: "small", notes: "Rush" });
    expect(edited.status).toBe(200);
    expect(edited.body.data.totalCentavos).toBe(35000);
    await request(ctx.app).patch(path).set(auth("owner")).send({ status: "in_bay" });
    await request(ctx.app).patch(path).set(auth("owner")).send({ status: "done" });
    const paid = await request(ctx.app).patch(path).set(auth("owner")).send({ status: "paid", sale: { method: "gcash" } });
    expect(paid.status).toBe(200);
    expect(paid.body.sale.amountCentavos).toBe(35000);
    expect(paid.body.data.paymentMethod).toBe("gcash");
    expect(paid.body.data.paidAt).toBeTruthy();
    const late = await request(ctx.app).patch(path).set(auth("owner")).send({ notes: "x" });
    expect(late.body.code).toBe("order_closed");
  });

  it("keeps the Partner 10/day limit with priced walk-ins", async () => {
    const { ctx, shop, basic } = await shopWithServices();
    for (let i = 0; i < 10; i++) expect((await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ serviceIds: [basic] })).status).toBe(201);
    const eleventh = await request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ serviceIds: [basic] });
    expect(eleventh.status).toBe(402);
    expect(JSON.parse(eleventh.text).code).toBe("walkin_limit");
  });
});
