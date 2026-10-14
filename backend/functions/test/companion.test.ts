import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { ChatResult, CompanionModel, ModelResult } from "../src/services/companion/model.js";
import { weekIdFor } from "../src/services/companion/store.js";
import { getBookings, getSales, loadShopData } from "../src/services/companion/tools.js";
import { auth, FIXED_NOW, makeDeps } from "./helpers.js";

const usage = { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 };

class FakeModel implements CompanionModel {
  prompts: string[] = [];
  tool = { name: "getSales", args: { period: "last_7_days" } as Record<string, unknown> };
  lastOutput: unknown = null;
  async generateJson(input: { user: string }): Promise<ModelResult> {
    this.prompts.push(input.user);
    return { text: JSON.stringify({ tips: ["Tip one ₱200", "Tip two", "Tip three", "Tip four"], alerts: ["Sales dipped"] }), model: "gemini-2.5-flash", location: "asia-southeast1", usage };
  }
  async chat(input: Parameters<CompanionModel["chat"]>[0]): Promise<ChatResult> {
    const out = await input.callTool(this.tool.name, this.tool.args);
    this.lastOutput = out;
    return { text: `Answer ${JSON.stringify(out).slice(0, 80)}`, model: "gemini-2.5-flash", location: "asia-southeast1", usage, toolsUsed: [this.tool.name] };
  }
}

async function setup(plan: "partner" | "paid", opts: { enabled?: boolean } = {}) {
  const deps = makeDeps();
  const model = new FakeModel();
  deps.config = { ...deps.config, companionEnabled: opts.enabled ?? true, devTools: true, envName: "test" };
  deps.ai = model;
  const app = createApp(deps);
  const shop = (await request(app).post("/businesses").set(auth("owner")).send({ name: "Seed Wash" })).body.data.id as string;
  if (plan === "paid") await request(app).put(`/businesses/${shop}/plan`).set(auth("ops", true)).send({ plan: "paid" });
  return { deps, app, shop, model };
}

/** Walk-ins today in every status, via the real API. */
async function walkIns(app: ReturnType<typeof createApp>, shop: string) {
  const add = async () => (await request(app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ serviceIds: [], vehicleSize: "medium" })).body.data.id as string;
  const patch = (id: string, body: object) => request(app).patch(`/businesses/${shop}/queue/${id}`).set(auth("owner")).send(body);
  for (let i = 0; i < 3; i++) await add(); // queued
  const bay = await add(); await patch(bay, { status: "in_bay" });
  const done = await add(); await patch(done, { status: "in_bay" }); await patch(done, { status: "done" });
  const paid = await add(); await patch(paid, { status: "in_bay" }); await patch(paid, { status: "done" });
  await patch(paid, { status: "paid", sale: { amountCentavos: 25000, method: "cash" } });
  const gone = await add(); await patch(gone, { status: "cancelled" });
}

describe("AI Companion (chat only, Barbers.ph parity)", () => {
  it("counts walk-ins in every status, not just paid sales", async () => {
    const { deps, app, shop } = await setup("partner");
    await walkIns(app, shop);
    const data = await loadShopData(deps.store, shop, FIXED_NOW);
    const b = getBookings(data, { period: "today" });
    expect(b.walkIns.total).toBe(7);
    expect(b.walkIns.byStatus).toMatchObject({ queued: 3, in_bay: 1, done: 1, paid: 1, cancelled: 1 });
    expect(b.queueNow).toEqual({ queued: 3, in_bay: 1 });
    const s = getSales(data, { period: "today" });
    expect(s.salesPhp).toBe(250);
    expect(s.paidCars).toBe(1);
    expect(s.carsServed).toBe(2);
    expect(s.unpaidCars).toBe(1);
  });

  it("answers from tools, logs cost, and enforces the Partner monthly quota", async () => {
    const { app, shop, deps, model } = await setup("partner");
    await walkIns(app, shop);
    model.tool = { name: "getBookings", args: { period: "today" } };
    const first = await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "Ilang walk-ins ko today?" });
    expect(first.status).toBe(201);
    expect((model.lastOutput as { walkIns: { total: number } }).walkIns.total).toBe(7);
    for (let i = 1; i < 10; i++) {
      const res = await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "Magkano kinita ko?" });
      expect(res.body.data.remaining).toBe(9 - i);
    }
    const blocked = await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "Isa pa" });
    expect(blocked.status).toBe(402);
    expect(JSON.parse(blocked.text).title).not.toMatch(/free/i);
    const usageDoc = await deps.store.get<{ months: Record<string, { questions: number; costUsd: number; calls: number }> }>(`businesses/${shop}/companion/usage`);
    const month = Object.values(usageDoc!.months)[0]!;
    expect(month.questions).toBe(10);
    expect(month.calls).toBe(10);
    expect(month.costUsd).toBeCloseTo((10 * (1000 * 0.3 + 200 * 2.5)) / 1e6, 6);
  });

  it("goals and branch comparison are Pro or Lifetime; staff cannot use the companion", async () => {
    const partner = await setup("partner");
    partner.model.tool = { name: "setGoal", args: { metric: "revenue", period: "month", target: 50000 } };
    await request(partner.app).post(`/businesses/${partner.shop}/companion/messages`).set(auth("owner")).send({ text: "Goal ko 50k" });
    expect(partner.model.lastOutput).toMatchObject({ error: expect.stringContaining("Pro or Lifetime") });
    const pro = await setup("paid");
    pro.model.tool = { name: "setGoal", args: { metric: "revenue", period: "month", target: 50000 } };
    const res = await request(pro.app).post(`/businesses/${pro.shop}/companion/messages`).set(auth("owner")).send({ text: "Goal ko 50k" });
    expect(res.body.data.remaining).toBeNull();
    expect((pro.model.lastOutput as { saved: { target: number } }).saved.target).toBe(50000);
    const view = await request(pro.app).get(`/businesses/${pro.shop}/companion`).set(auth("owner"));
    expect(view.body.data.goals).toHaveLength(1);
    expect((await request(pro.app).get(`/businesses/${pro.shop}/companion`).set(auth("stranger"))).status).toBe(403);
  });

  it("Monday tips post one plain message into the thread; Partner sees 1 tip and no alerts", async () => {
    const partner = await setup("partner");
    const run = await request(partner.app).post(`/businesses/${partner.shop}/companion/weekly`).set(auth("owner")).send({});
    expect(run.status).toBe(201);
    expect(run.body.data).toMatchObject({ tips: 1, hiddenTips: 3, alerts: 0 });
    const again = await request(partner.app).post(`/businesses/${partner.shop}/companion/weekly`).set(auth("owner")).send({});
    expect(again.body.data.skipped).toBe("already sent");
    const view = await request(partner.app).get(`/businesses/${partner.shop}/companion`).set(auth("owner"));
    const msgs = view.body.data.messages as { kind: string; text: string; locked: boolean; tips?: unknown }[];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.kind).toBe("tip");
    expect(msgs[0]!.text).toContain("1. Tip one");
    expect(msgs[0]!.text).toContain("3 more tips are waiting for you on Pro or Lifetime");
    expect(msgs[0]!.locked).toBe(true);
    expect(msgs[0]!.tips).toBeUndefined();
    const rec = await partner.deps.store.get<{ tips: string[]; costUsd: number }>(`businesses/${partner.shop}/insights/${weekIdFor(FIXED_NOW)}`);
    expect(rec!.tips).toHaveLength(1);
    expect(rec!.costUsd).toBeGreaterThan(0);

    const pro = await setup("paid");
    await request(pro.app).post(`/businesses/${pro.shop}/companion/weekly`).set(auth("owner")).send({});
    const pv = (await request(pro.app).get(`/businesses/${pro.shop}/companion`).set(auth("owner"))).body.data.messages as { kind: string; text: string }[];
    expect(pv.map((m) => m.kind)).toEqual(["tip", "alert"]);
    expect(pv[0]!.text).toContain("4. Tip four");
  });

  it("removed insight surfaces are gone, and it is off when disabled", async () => {
    const { app, shop } = await setup("paid", { enabled: false });
    expect((await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "hi" })).status).toBe(503);
    expect((await request(app).get(`/businesses/${shop}/companion/insights`).set(auth("owner"))).status).toBe(404);
    expect((await request(app).put(`/businesses/${shop}/companion/goals`).set(auth("owner")).send({})).status).toBe(404);
    expect((await request(app).post(`/businesses/${shop}/companion/tips/run`).set(auth("owner"))).status).toBe(404);
    expect((await request(app).post(`/businesses/${shop}/dev/seed-companion-demo`).set(auth("owner")).send({})).status).toBe(404);
  });
});
