import { CATEGORY_ICON } from "../../services/starter-services.js";
import { Router, type Response } from "express";
import type { Deps } from "../../deps.js";
import { limitBody, requireIdempotencyKey, requireScope, riverPartnerAuth } from "../../middleware/partner-middleware.js";
import { getPartner } from "../../middleware/context.js";
import { validateBody } from "../../middleware/validate.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { v1CancelSchema, v1CheckInSchema, v1CreateBookingSchema, v1CreateOrderSchema } from "../../models/schemas.js";
import type { Business, Service } from "../../models/types.js";
import { apiBookingView, apiCancel, apiCheckIn, apiOrderView, createApiBooking, getApiBooking, type ApiBookingInput } from "../../services/bookings-service.js";
import { withIdempotency } from "../../services/idempotency-service.js";
import { paths } from "../../services/paths.js";
import { listNearbyShops, parseShopsQuery } from "../../river/shops.js";
import { toRiverStatus } from "../../river/status.js";

const id = (v: unknown) => {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw badRequest("Invalid id.");
  return v;
};

/**
 * Versioned partner API for the River Bridge (server to server). See docs/api.md.
 * Every route except /v1/health needs both factors (riverPartnerAuth): Google OIDC
 * ID token + X-River-Signature HMAC. Writes also need an Idempotency-Key.
 * /v1/orders* is the shared River contract; /v1/bookings* stays for the Bridge's
 * current Carwash adapter. Both write businesses/{id}/bookings with source river_mobile.
 */
export function publicRoutes(deps: Deps) {
  const { store } = deps;
  const r = Router();
  r.get("/health", (_req, res) => void res.json({ ok: true, status: "ok", apiVersion: "v1" }));

  r.use(limitBody());
  r.use(riverPartnerAuth(deps.river));
  const clientId = (res: Response) => getPartner(res).id;
  const idem = requireIdempotencyKey();

  async function listedShop(shopId: string) {
    const b = await store.get<Business>(paths.business(shopId));
    if (!b || !b.riverMobile.listed || b.planStatus !== "active" || b.deletedAt) throw notFound("Shop not found or not listed on River Mobile.");
    return b;
  }

  /** Runs a write once per (client, Idempotency-Key); a repeat replays the stored response. */
  async function once(req: Parameters<Parameters<typeof r.post>[1]>[0], res: Response, status: number, run: () => Promise<unknown>) {
    const result = await withIdempotency(store, clientId(res), req.header("idempotency-key")!, { path: req.path, body: req.body }, deps.now(), async () => ({ status, body: await run() }));
    if (result.replayed) res.setHeader("Idempotent-Replayed", "true");
    res.status(result.status).json(result.body);
  }

  r.get("/shops", requireScope("shops:read"), async (req, res) => {
    res.json(await listNearbyShops(store, parseShopsQuery(req.query as Record<string, unknown>)));
  });

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
        .map((s) => {
          const category = s.category ?? "car-wash";
          // durationMins kept for older River Mobile builds (30 when an owner never set one).
          return { serviceId: s.id, name: s.name, durationMins: s.durationMins ?? 30, pricesBySize: s.pricesBySize, category, icon: s.icon ?? CATEGORY_ICON[category] };
        }),
    });
  });

  // ---- Shared contract: /v1/orders ----

  r.post("/orders", requireScope("orders:write"), idem, validateBody(v1CreateOrderSchema), async (req, res) => {
    const body = req.body as import("zod").infer<typeof v1CreateOrderSchema>;
    const input: ApiBookingInput = {
      shopId: body.shopId,
      serviceIds: body.lines.map((l) => l.id),
      vehicleSize: body.vehicleSize,
      slotStart: body.slot.start,
      customer: body.customer,
      externalBookingRef: body.externalRef,
      notes: body.notes,
    };
    await once(req, res, 201, async () => {
      const created = await createApiBooking(store, clientId(res), input, deps.now());
      return {
        orderId: created.bookingId,
        shopId: created.shopId,
        reference: created.reference,
        status: created.riverStatus,
        source: created.source,
        currency: "PHP",
        checkIn: created.checkIn,
        updatedAt: created.createdAt,
      };
    });
  });

  r.get("/orders/:orderId", requireScope("orders:read"), async (req, res) => {
    const { booking, businessId } = await getApiBooking(store, clientId(res), id(req.params.orderId));
    res.json(apiOrderView(booking, businessId));
  });

  r.post("/orders/:orderId/check-in", requireScope("checkin:write"), idem, validateBody(v1CheckInSchema), async (req, res) => {
    const orderId = id(req.params.orderId);
    await once(req, res, 200, async () => {
      const view = await apiCheckIn(store, clientId(res), orderId, req.body.shopQr, deps.now());
      return { orderId: view.bookingId, shopId: view.shopId, reference: view.reference, status: view.riverStatus, source: "river_mobile", updatedAt: view.updatedAt };
    });
  });

  r.post("/orders/:orderId/cancel", requireScope("orders:write"), idem, validateBody(v1CancelSchema), async (req, res) => {
    const orderId = id(req.params.orderId);
    await once(req, res, 200, async () => {
      const { booking, businessId } = await apiCancel(store, clientId(res), orderId, req.body.reason, deps.now());
      return apiOrderView(booking, businessId);
    });
  });

  // ---- Legacy Carwash paths (what the Bridge's carwash adapter calls today) ----

  r.post("/bookings", requireScope("orders:write"), idem, validateBody(v1CreateBookingSchema), async (req, res) => {
    await once(req, res, 201, () => createApiBooking(store, clientId(res), req.body, deps.now()));
  });

  r.get("/bookings/:bookingId", requireScope("orders:read"), async (req, res) => {
    const { booking, businessId } = await getApiBooking(store, clientId(res), id(req.params.bookingId));
    res.json(apiBookingView(booking, businessId));
  });

  r.post("/bookings/:bookingId/check-in", requireScope("checkin:write"), idem, validateBody(v1CheckInSchema), async (req, res) => {
    const bookingId = id(req.params.bookingId);
    await once(req, res, 200, () => apiCheckIn(store, clientId(res), bookingId, req.body.shopQr, deps.now()));
  });

  r.post("/bookings/:bookingId/cancel", requireScope("orders:write"), idem, validateBody(v1CancelSchema), async (req, res) => {
    const bookingId = id(req.params.bookingId);
    await once(req, res, 200, async () => {
      const { booking, businessId } = await apiCancel(store, clientId(res), bookingId, req.body.reason, deps.now());
      return { ...apiBookingView(booking, businessId), riverStatus: toRiverStatus(booking.status) };
    });
  });

  return r;
}
