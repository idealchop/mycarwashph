import request from "supertest";
import { describe, expect, it } from "vitest";
import { auth, makeApps } from "./helpers.js";

describe("expenses + finance week", () => {
  it("adds expenses, computes profit per day, and walls tenants", async () => {
    const ctx = makeApps();
    const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Exp Wash" })).body.data.id as string;
    const other = (await request(ctx.app).post("/businesses").set(auth("other")).send({ name: "Other Wash" })).body.data.id as string;
    for (const id of [shop, other]) await request(ctx.app).put(`/businesses/${id}/plan`).set(auth("ops", true)).send({ plan: "paid" });
    const bad = await request(ctx.app).post(`/businesses/${shop}/expenses`).set(auth("owner")).send({ amountCentavos: 0, note: "x" });
    expect(bad.status).toBe(400);
    const e = await request(ctx.app).post(`/businesses/${shop}/expenses`).set(auth("owner")).send({ amountCentavos: 12000, note: "Soap" });
    expect(e.status).toBe(201);
    const week = (await request(ctx.app).get(`/businesses/${shop}/finance/week`).set(auth("owner"))).body.data;
    expect(week.days).toHaveLength(7);
    expect(week.days[0].dow).toBe("Mon");
    expect(week.totals.expensesCentavos).toBe(12000);
    expect(week.totals.profitCentavos).toBe(week.totals.salesCentavos - 12000);
    expect(week.expenses).toHaveLength(1);
    // Other shop: can't read or delete this shop's expenses.
    expect((await request(ctx.app).get(`/businesses/${shop}/finance/week`).set(auth("other"))).status).toBe(403);
    expect((await request(ctx.app).delete(`/businesses/${other}/expenses/${e.body.data.id}`).set(auth("other"))).status).toBe(404);
    expect((await request(ctx.app).delete(`/businesses/${shop}/expenses/${e.body.data.id}`).set(auth("owner"))).status).toBe(204);
  });
});
