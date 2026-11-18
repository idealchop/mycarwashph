import request from "supertest";
import { describe, expect, it } from "vitest";
import { auth, makeApps } from "./helpers.js";

describe("app feedback", () => {
  it("saves one rating per member, replaces it on edit and keeps the summary", async () => {
    const ctx = makeApps();
    const a = (await request(ctx.app).post("/businesses").set(auth("alice")).send({ name: "A Wash" })).body.data.id as string;
    const empty = await request(ctx.app).get(`/businesses/${a}/feedback`).set(auth("alice"));
    expect(empty.body.data).toEqual({ summary: { count: 0, sum: 0 }, mine: null });
    await request(ctx.app).post(`/businesses/${a}/feedback`).set(auth("alice")).send({ rating: 4, comment: " ok " }).expect(200);
    const edit = await request(ctx.app).post(`/businesses/${a}/feedback`).set(auth("alice")).send({ rating: 5 });
    expect(edit.body.data.summary).toEqual({ count: 1, sum: 5 });
    const mine = await request(ctx.app).get(`/businesses/${a}/feedback`).set(auth("alice"));
    expect(mine.body.data.mine).toEqual({ rating: 5, comment: "" });
    expect((await request(ctx.app).post(`/businesses/${a}/feedback`).set(auth("alice")).send({ rating: 6 })).status).toBe(400);
    expect((await request(ctx.app).post(`/businesses/${a}/feedback`).set(auth("bob")).send({ rating: 3 })).status).toBe(403);
  });
});
