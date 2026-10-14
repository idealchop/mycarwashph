import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { TokenVerifier } from "../auth/token-verifier.js";
import type { Deps } from "../deps.js";
import { getUser, setContext } from "../middleware/context.js";
import { validateBody } from "../middleware/validate.js";
import { badRequest, forbidden, unauthorized } from "../lib/errors.js";
import { listMyBusinesses } from "../services/businesses-service.js";
import {
  createMoment,
  deleteMoment,
  listMoments,
  MAX_MOMENT_CHARS,
  MAX_MOMENT_IMAGES,
  replyMoment,
  toggleMoment,
  view,
} from "../services/moments-service.js";

/** Reads the Firebase ID token when present; guests continue without a user. */
export function optionalAuth(verifier: TokenVerifier): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer (.+)$/i.exec(req.header("authorization") ?? "");
    if (match) {
      try {
        setContext(res, { user: await verifier.verify(match[1]!) });
      } catch {
        /* expired token: treat as a guest for reads */
      }
    }
    next();
  };
}

const opSchema = z.object({
  op: z.enum(["post", "like", "repost", "reply", "delete"]),
  /** Shop posting or replying (must be a member). Defaults to the caller's first shop. */
  businessId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  body: z.string().max(MAX_MOMENT_CHARS + 200).optional(),
  images: z.array(z.string().url().max(1000)).max(MAX_MOMENT_IMAGES).optional(),
});

/** Moments feed: public GET, signed-in POST ops (same shape as Barbers.ph /api/community). */
export function momentsRoutes(deps: Deps) {
  const r = Router();
  r.get("/moments", optionalAuth(deps.verifier), async (_req, res) => {
    const uid = (res.locals as { user?: { uid: string } }).user?.uid ?? null;
    const mine = uid ? (await listMyBusinesses(deps.store, uid)).map((b) => b.business.id) : [];
    const rows = await listMoments(deps.store);
    res.json({ posts: rows.map((m) => view(m, uid, mine)) });
  });

  r.post("/moments", optionalAuth(deps.verifier), validateBody(opSchema), async (req, res) => {
    if (!(res.locals as { user?: unknown }).user) throw unauthorized();
    const uid = getUser(res).uid;
    const b = req.body as z.infer<typeof opSchema>;
    const shops = await listMyBusinesses(deps.store, uid);
    const ids = shops.map((s) => s.business.id);
    const shop = b.businessId ? shops.find((s) => s.business.id === b.businessId)?.business : shops[0]?.business;
    if (b.businessId && !shop) throw forbidden();
    const now = deps.now();

    if (b.op === "post") {
      if (!shop) throw badRequest("Set up your shop in Settings before posting.");
      const id = await createMoment(deps.store, shop, uid, b.body ?? "", b.images ?? [], now);
      res.status(201).json({ id });
      return;
    }
    if (!b.id) throw badRequest("id is required");
    if (b.op === "like" || b.op === "repost") {
      const on = await toggleMoment(deps.store, b.id, uid, b.op === "like" ? "likedBy" : "repostedBy");
      res.json({ ok: true, on });
      return;
    }
    if (b.op === "reply") {
      if (!shop) throw badRequest("Set up your shop in Settings before replying.");
      await replyMoment(deps.store, b.id, shop, uid, b.body ?? "", now);
      res.json({ ok: true });
      return;
    }
    const gone = await deleteMoment(deps.store, b.id, ids);
    // Remove the post's uploaded images too (only files under that shop's moments/ folder).
    if (deps.photos) {
      for (const url of gone.images ?? []) {
        const file = deps.photos.pathFromUrl(url);
        if (file?.startsWith(`businesses/${gone.businessId}/moments/`)) await deps.photos.remove(file).catch(() => undefined);
      }
    }
    res.json({ ok: true });
  });
  return r;
}
