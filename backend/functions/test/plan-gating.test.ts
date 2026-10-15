import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { planGatingEnabled, setPlanGating } from "../src/config/plan-gating.js";
import type { ChatResult, CompanionModel, ModelResult } from "../src/services/companion/model.js";
import { auth, makeApps, makeDeps, starterId } from "./helpers.js";

const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };
class Model implements CompanionModel {
  async generateJson(): Promise<ModelResult> {
    return { text: JSON.stringify({ tips: ["One", "Two", "Three"], alerts: ["Heads up"] }), model: "m", location: "l", usage };
  }
  async chat(input: Parameters<CompanionModel["chat"]>[0]): Promise<ChatResult> {
    const out = await input.callTool("setGoal", { metric: "revenue", period: "month", target: 50000 });
    return { text: JSON.stringify(out).slice(0, 120), model: "m", location: "l", usage, toolsUsed: ["setGoal"] };
  }
}

async function partnerShop() {
  const ctx = makeApps();
  const shop = (await request(ctx.app).post("/businesses").set(auth("owner")).send({ name: "Partner Wash" })).body.data.id as string;
  return { ctx, shop, basic: await starterId(ctx.app, shop) };
}

describe("PLAN_GATING_ENABLED", () => {
  beforeEach(() => setPlanGating(null));

  it("defaults to off and reads the env", () => {
    const prev = process.env.PLAN_GATING_ENABLED;
    delete process.env.PLAN_GATING_ENABLED;
    expect(planGatingEnabled()).toBe(false);
    process.env.PLAN_GATING_ENABLED = "0";
    expect(planGatingEnabled()).toBe(false);
    process.env.PLAN_GATING_ENABLED = "1";
    expect(planGatingEnabled()).toBe(true);
    if (prev === undefined) delete process.env.PLAN_GATING_ENABLED;
    else process.env.PLAN_GATING_ENABLED = prev;
  });

  for (const on of [false, true]) {
    it(`walk-in cap and Paid-only routes with gating ${on ? "on" : "off"}`, async () => {
      setPlanGating(on);
      const { ctx, shop, basic } = await partnerShop();
      const add = () => request(ctx.app).post(`/businesses/${shop}/queue`).set(auth("owner")).send({ serviceIds: [basic] });
      for (let i = 0; i < 10; i++) expect((await add()).status).toBe(201);
      const eleventh = await add();
      expect(eleventh.status).toBe(on ? 402 : 201);
      const queue = await request(ctx.app).get(`/businesses/${shop}/queue`).set(auth("owner"));
      expect(queue.body.walkIns.limit).toBe(on ? 10 : null);
      expect((await request(ctx.app).get(`/businesses/${shop}/bays`).set(auth("owner"))).status).toBe(on ? 402 : 200);
      expect((await request(ctx.app).get(`/businesses/${shop}/sales`).set(auth("owner"))).status).toBe(on ? 402 : 200);
      // Plan data is untouched either way.
      expect((await request(ctx.app).get(`/businesses/${shop}/billing`).set(auth("owner"))).body.data.plan).toBe("partner");
    });

    it(`companion quota, Pro-only tools and tips with gating ${on ? "on" : "off"}`, async () => {
      setPlanGating(on);
      const deps = makeDeps();
      deps.config = { ...deps.config, companionEnabled: true, devTools: true, envName: "test" };
      deps.ai = new Model();
      const app = createApp(deps);
      const shop = (await request(app).post("/businesses").set(auth("owner")).send({ name: "Chat Wash" })).body.data.id as string;
      const view = (await request(app).get(`/businesses/${shop}/companion`).set(auth("owner"))).body.data;
      expect(view.tier).toBe(on ? "partner" : "full");
      expect(view.quota.limit).toBe(on ? 10 : null);
      const ask = await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "Goal ko 50k" });
      expect(ask.status).toBe(201);
      expect(ask.body.data.answer.text.includes("Pro or Lifetime")).toBe(on);
      for (let i = 0; i < 10; i++) await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: `q${i}` });
      const more = await request(app).post(`/businesses/${shop}/companion/messages`).set(auth("owner")).send({ text: "one more" });
      expect(more.status).toBe(on ? 402 : 201);
    });
  }
});
