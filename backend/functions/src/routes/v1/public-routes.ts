import { Router } from "express";
import type { Deps } from "../../deps.js";
import { requireApiClient, requireIdempotencyKey, requireScope } from "../../middleware/api-key-middleware.js";
import { getApiClient } from "../../middleware/context.js";
import { validateBody } from "../../middleware/validate.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { v1CheckInSchema, v1CreateBookingSchema } from "../../models/schemas.js";
import type { Business, Service } from "../../models/types.js";
import { apiBookingView, apiCheckIn, createApiBooking, getApiBooking } from "../../services/bookings-service.js";
import { withIdempotency } from "../../services/idempotency-service.js";
import { paths } from "../../services/paths.js";

const id = (v: unknown) => {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw badRequest("Invalid id.");
  return v;
};

/**
 * Versioned public API for River Mobile (server to server). See docs/api.md.
 * Auth is a placeholder API key; Phase 1 moves to OAuth client credentials.
 */
export function publicRoutes(deps: Deps) {
  const { store } = deps;
  const r = Router();
  r.get("/health", (_req, res) => void res.json({ ok: true, apiVersion: "v1" }));

  r.use(requireApiClient(store, deps.config.apiKeyPepper));
  const clientId = (res: Parameters<typeof getApiClient>[0]) => getApiClient(res).id;

  async function listedShop(shopId: string) {
    const b = await store.get<Business>(paths.business(shopId));
    if (!b || !b.riverMobile.listed || b.planStatus !== "active") throw notFound("Shop not found or not listed on River Mobile.");
    return b;
  }

  r.get("/shops/:shopId", requireScope("shops:read"), async (req, res) => {
    const b = await listedShop(id(req.params.shopId));
    res.json({
      shopId: b.id,
      name: b.name,
      address: b.address ?? null,
      phoneE164: b.phoneE164 ?? null,
      location: b.location
        ? { lat: b.location.lat, lng: b.location.lng, formattedAddress: b.location.formattedAddress ?? null }
        : null,
      photoUrls: Array.isArray(b.photoUrls) ? b.photoUrls.filter((u) => typeof u === "string" && u.startsWith("https://")).slice(0, 6) : [],
    });
  });

  r.get("/shops/:shopId/services", requireScope("shops:read"), async (req, res) => {
    const b = await listedShop(id(req.params.shopId));
    const rows = await store.list<Service>(paths.services(b.id), { orderBy: { field: "name" } });
    res.json({
      data: rows
        .filter((s) => s.active && s.listedOnRiverMobile)
        .map((s) => ({ serviceId: s.id, name: s.name, durationMins: s.durationMins, pricesBySize: s.pricesBySize })),
    });
  });

  r.post("/bookings", requireScope("bookings:write"), requireIdempotencyKey(), validateBody(v1CreateBookingSchema), async (req, res) => {
    const result = await withIdempotency(store, clientId(res), req.header("idempotency-key")!, req.body, deps.now(), async () => ({
      status: 201,
      body: await createApiBooking(store, clientId(res), req.body, deps.now()),
    }));
    if (result.replayed) res.setHeader("Idempotent-Replayed", "true");
    res.status(result.status).json(result.body);
  });

  r.get("/bookings/:bookingId", requireScope("bookings:read"), async (req, res) => {
    const { booking, businessId } = await getApiBooking(store, clientId(res), id(req.params.bookingId));
    res.json(apiBookingView(booking, businessId));
  });

  r.post("/bookings/:bookingId/check-in", requireScope("checkin:write"), validateBody(v1CheckInSchema), async (req, res) => {
    res.json(await apiCheckIn(store, clientId(res), id(req.params.bookingId), req.body.shopQr, deps.now()));
  });

  return r;
}
