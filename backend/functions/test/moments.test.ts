import request from "supertest";
import { describe, expect, it } from "vitest";
import { auth, makeApps } from "./helpers.js";

describe("moments feed", () => {
  it("lets guests read, members post/like/reply, and only the owning shop delete", async () => {
    const { app } = makeApps();
    const a = (await request(app).post("/businesses").set(auth("ownerA")).send({ name: "Shine Wash", address: "Maginhawa, Quezon City" })).body.data.id as string;
    await request(app).post("/businesses").set(auth("ownerB")).send({ name: "Foam Lab" });

    expect((await request(app).get("/moments")).body.posts).toEqual([]);
    expect((await request(app).post("/moments").send({ op: "post", body: "hi" })).status).toBe(401);

    const posted = await request(app).post("/moments").set(auth("ownerA")).send({ op: "post", businessId: a, body: "Fresh foam today", images: ["https://x.test/a.jpg", "http://bad"] });
    expect(posted.status).toBe(201);
    const id = posted.body.id as string;

    expect((await request(app).post("/moments").set(auth("ownerB")).send({ op: "post", businessId: a, body: "x" })).status).toBe(403);
    expect((await request(app).post("/moments").set(auth("ownerB")).send({ op: "like", id })).body.on).toBe(true);
    expect((await request(app).post("/moments").set(auth("ownerB")).send({ op: "reply", id, body: "Nice!" })).status).toBe(200);

    const guest = (await request(app).get("/moments")).body.posts[0];
    expect(guest).toMatchObject({ id, body: "Fresh foam today", images: ["https://x.test/a.jpg"], likes: 1, liked: false, mine: false });
    expect(guest.author).toMatchObject({ name: "Shine Wash", meta: "Quezon City", businessId: a });
    expect(guest.replies[0].author.name).toBe("Foam Lab");

    const asB = (await request(app).get("/moments").set(auth("ownerB"))).body.posts[0];
    expect(asB).toMatchObject({ liked: true, mine: false });
    expect((await request(app).post("/moments").set(auth("ownerB")).send({ op: "delete", id })).status).toBe(403);
    expect((await request(app).post("/moments").set(auth("ownerA")).send({ op: "delete", id })).status).toBe(200);
    expect((await request(app).get("/moments")).body.posts).toEqual([]);
  });
});
