import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { computeMetrics } from "../src/services/companion/metrics.js";
import type { ChatResult, CompanionModel, ModelResult } from "../src/services/companion/model.js";
import { seedDemoData } from "../src/services/companion/dev-seed.js";
import { findAlerts } from "../src/services/companion/alerts.js";
import { loadShopData, weekIdFor } from "../src/services/companion/store.js";
import { auth, FIXED_NOW, makeDeps } from "./helpers.js";

const usage = { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 };

class FakeModel implements CompanionModel {
  prompts: string[] = [];
  toolOutputs: unknown[] = [];
  async generateJson(input: { user: string }): Promise<ModelResult> {
    this.prompts.push(input.user);
    const tips = [1, 2, 3, 4].map((n) => ({ title: `Tip ${n}`, body: `Body ${n}`, category: "staffing" }));
    return { text: JSON.stringify({ summary: "Good week", language: "en", tips }), model: "gemini-2.5-flash", location: "asia-southeast1", usage };
  }
  async chat(input: Parameters<CompanionModel["chat"]>[0]): Promise<ChatResult> {
    const out = await input.callTool("getSales", { period: "last_7_days" });
    this.toolOutputs.push(out);
    return { text: `Kumita ka ng ₱${(out as { revenuePesos: number }).revenuePesos}`, model: "gemini-2.5-flash", location: "asia-southeast1", usage, toolsUsed: ["getSales"] };
  }
}

async function setup(plan: "partner" | "paid", opts: { enabled?: boolean; devTools?: boolean } = {}) {
  const deps = makeDeps();
  const model = new FakeModel();
  deps.config = { ...deps.config, companionEnabled: opts.enabled ?? true, devTools: opts.devTools ?? true, envName: "test" };
  deps.ai = model;
  const app = createApp(deps);
  const shop = (await request(app).post("/businesses").set(auth("owner")).send({ name: "Seed Wash" })).body.data.id as string;
  await seedDemoData(deps.store, { id: shop, plan: "partner" }, { now: FIXED_NOW, plan });
  return { deps, app, shop, model };
}

describe("AI Companion", () => {
  it("aggregates without customer PII", async () => {
    const { deps, shop } = await setup("paid");
    const m = computeMetrics(await loadShopData(deps.store, shop, FIXED_NOW));
    const json = JSON.stringify(m);
    expect(m.last28.carsServed).toBeGreaterThan(100);
    expect(m.topServices[0]?.name).toBeTruthy();
    expect(json).not.toMatch(/SDR |SDN |Seed customer/);
  });

  it("answers from tools, logs cost, and enforces the Partner monthly quota", async () => {
    const { app, shop, deps } = await setup("partner");
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "Magkano kinita ko?" });
      expect(res.status).toBe(201);
      expect(res.body.data.remaining).toBe(9 - i);
    }
    const blocked = await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "Isa pa" });
    expect(blocked.status).toBe(402);
    const usageDoc = await deps.store.get<{ months: Record<string, { questions: number; costUsd: number; calls: number }> }>(`businesses/${shop}/companion/usage`);
    const month = Object.values(usageDoc!.months)[0]!;
    expect(month.questions).toBe(10);
    expect(month.calls).toBe(10);
    expect(month.costUsd).toBeCloseTo(10 * (1000 * 0.3 + 200 * 2.5) / 1e6, 6);
  });

  it("Pro gets unlimited chat; staff cannot use the companion", async () => {
    const { app, shop } = await setup("paid");
    const res = await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "How much last week?" });
    expect(res.status).toBe(201);
    expect(res.body.data.remaining).toBeNull();
    expect(res.body.data.answer.text).toMatch(/₱\d+/);
    const staff = await request(app).get(`/businesses/${shop}/companion`).set(auth("stranger"));
    expect(staff.status).toBe(403);
  });

  it("weekly tips: saved, posted to chat, gated per tier server-side", async () => {
    const partner = await setup("partner");
    const run = await request(partner.app).post(`/businesses/${partner.shop}/companion/tips/run`).set(auth("owner"));
    expect(run.status).toBe(201);
    expect(run.body.data.insight.tips).toHaveLength(1);
    expect(run.body.data.insight.lockedCount).toBe(3);
    expect(run.body.data.insight.metrics).toBeNull();
    const saved = await partner.deps.store.get<{ costUsd: number; tips: unknown[] }>(`businesses/${partner.shop}/insights/${weekIdFor(FIXED_NOW)}`);
    expect(saved!.tips).toHaveLength(4);
    expect(saved!.costUsd).toBeGreaterThan(0);
    expect(partner.model.prompts[0]).not.toMatch(/SDR |Seed customer/);
    const view = await request(partner.app).get(`/businesses/${partner.shop}/companion`).set(auth("owner"));
    const tipMsg = view.body.data.messages.find((m: { kind: string }) => m.kind === "tip");
    expect(tipMsg.tips).toHaveLength(1);
    expect(view.body.data.quota.remaining).toBe(10);
    expect(view.body.data.goals).toBeNull();

    const pro = await setup("paid");
    const proRun = await request(pro.app).post(`/businesses/${pro.shop}/companion/tips/run`).set(auth("owner"));
    expect(proRun.body.data.insight.tips).toHaveLength(4);
    expect(proRun.body.data.insight.metrics).not.toBeNull();
  });

  it("goals are Pro-only and track progress", async () => {
    const partner = await setup("partner");
    expect((await request(partner.app).put(`/businesses/${partner.shop}/companion/goals`).set(auth("owner")).send({ metric: "revenue", period: "month", target: 50000 })).status).toBe(402);
    const pro = await setup("paid");
    const res = await request(pro.app).put(`/businesses/${pro.shop}/companion/goals`).set(auth("owner")).send({ metric: "revenue", period: "month", target: 50000 });
    expect(res.status).toBe(200);
    expect(res.body.data[0].target).toBe(50000);
    expect(res.body.data[0].actual).toBeGreaterThan(0);
  });

  it("is off when disabled (prod guard) and dev tools are hidden outside dev", async () => {
    const { app, shop } = await setup("paid", { enabled: false, devTools: false });
    expect((await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "hi" })).status).toBe(503);
    expect((await request(app).post(`/businesses/${shop}/dev/seed-companion-demo`).set(auth("owner")).send({})).status).toBe(404);
    expect((await request(app).post(`/businesses/${shop}/companion/tips/run`).set(auth("owner"))).status).toBe(403);
  });

  it("flags a revenue drop vs the 28-day baseline", async () => {
    const { deps, shop } = await setup("paid");
    const data = await loadShopData(deps.store, shop, FIXED_NOW);
    const cutoff = FIXED_NOW.getTime() - 7 * 86_400_000;
    const dropped = { ...data, sales: data.sales.filter((s, i) => Date.parse(s.paidAt) < cutoff || i % 3 === 0) };
    expect(findAlerts(dropped).map((a) => a.key)).toContain("revenue_drop");
  });
});
