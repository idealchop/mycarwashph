import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../deps.js";
import { limiter } from "../middleware/http-middleware.js";
import { validateBody } from "../middleware/validate.js";
import { VEHICLE_SIZES } from "../models/types.js";
import { createLinkBooking, linkTicket, publicShop } from "../services/link-bookings-service.js";

const id = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : "_");

const linkBookingSchema = z.object({
  serviceIds: z.array(z.string().min(1).max(64)).min(1).max(12),
  vehicleSize: z.enum(VEHICLE_SIZES),
  scheduledStart: z.string().datetime().optional(),
  name: z.string().trim().max(60).optional(),
  contact: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(300).optional(),
  payPref: z.enum(["shop", "online"]).optional(),
}).strict();

/** Booking link (no sign-in): the public /book page behind the shop QR. Mounted before requireAuth. */
export function linkRoutes(deps: Deps) {
  const r = Router();
  const onlineCheckout = process.env.ONLINE_CHECKOUT_ENABLED === "1";
  r.get("/public/shops/:shopId", async (req, res) => {
    res.json({ data: { ...(await publicShop(deps.store, id(req.params.shopId))), onlineCheckout } });
  });
  r.post("/public/shops/:shopId/bookings", limiter(deps.config, 10), validateBody(linkBookingSchema), async (req, res) => {
    res.status(201).json({ data: await createLinkBooking(deps.store, id(req.params.shopId), req.body, deps.now(), onlineCheckout) });
  });
  r.get("/public/shops/:shopId/bookings/:bookingId", async (req, res) => {
    const t = typeof req.query.t === "string" ? req.query.t : "";
    res.json({ data: await linkTicket(deps.store, id(req.params.shopId), id(req.params.bookingId), t) });
  });
  return r;
}
