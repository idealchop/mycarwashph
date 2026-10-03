import { Router } from "express";
import type { Deps } from "../deps.js";
import { getUser } from "../middleware/context.js";
import { validateBody } from "../middleware/validate.js";
import { createBusinessSchema } from "../models/schemas.js";
import { createBusiness, listMyBusinesses } from "../services/businesses-service.js";

/** Routes about the signed-in user (no business scope yet). */
export function meRoutes(deps: Deps) {
  const r = Router();

  r.get("/me", async (_req, res) => {
    const user = getUser(res);
    const businesses = await listMyBusinesses(deps.store, user.uid);
    res.json({
      user: { uid: user.uid, phoneNumber: user.phoneNumber ?? null, email: user.email ?? null, name: user.name ?? null },
      businesses: businesses.map(({ business, role }) => ({ id: business.id, name: business.name, plan: business.plan, role })),
    });
  });

  // Dual-endpoint rule: GET /businesses lists what POST /businesses creates.
  r.get("/businesses", async (_req, res) => {
    const businesses = await listMyBusinesses(deps.store, getUser(res).uid);
    res.json({ data: businesses.map(({ business, role }) => ({ ...business, role })) });
  });

  r.post("/businesses", validateBody(createBusinessSchema), async (req, res) => {
    const { business, member } = await createBusiness(deps.store, getUser(res), req.body, deps.now());
    res.status(201).json({ data: business, membership: { role: member.role } });
  });

  return r;
}
