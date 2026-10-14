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

  it("removes a deleted post's uploaded images from storage", async () => {
    const { deps, app } = makeApps();
    const removed: string[] = [];
    const P = "https://firebasestorage.googleapis.com/v0/b/test/o/";
    deps.photos = {
      async save(path) { return `${P}${encodeURIComponent(path)}?alt=media`; },
      async remove(path) { removed.push(path); },
      pathFromUrl(url) { return url.startsWith(P) ? decodeURIComponent(url.slice(P.length).split("?")[0]!) : null; },
    };
    const shop = (await request(app).post("/businesses").set(auth("imgA")).send({ name: "Img Wash" })).body.data.id as string;
    const mine = `${P}${encodeURIComponent(`businesses/${shop}/moments/a.jpg`)}?alt=media`;
    const other = `${P}${encodeURIComponent("businesses/someone-else/photos/b.jpg")}?alt=media`;
    const post = await request(app).post("/moments").set(auth("imgA")).send({ op: "post", businessId: shop, body: "hi", images: [mine, other] });
    expect(post.status).toBe(201);
    const id = (await request(app).get("/moments")).body.posts[0].id as string;
    expect((await request(app).post("/moments").set(auth("imgA")).send({ op: "delete", id })).status).toBe(200);
    expect(removed).toEqual([`businesses/${shop}/moments/a.jpg`]);
  });
});
