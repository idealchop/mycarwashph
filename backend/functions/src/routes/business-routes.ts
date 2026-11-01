import express, { Router } from "express";
import { z } from "zod";
import type { Deps } from "../deps.js";
import { requireMembership, requirePlan, requireRole } from "../middleware/business-middleware.js";
import { getBusiness, getMember, getUser } from "../middleware/context.js";
import { validateBody } from "../middleware/validate.js";
import { feedbackSummary, myFeedback, saveFeedback } from "../services/feedback-service.js";

const feedbackSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }).strict();
import { badRequest, forbidden, HttpError, notFound } from "../lib/errors.js";
import { manilaDayKey } from "../lib/time.js";
import {
  baySchema,
  customerSchema,
  inviteMemberSchema,
  queueCreateSchema,
  queueUpdateSchema,
  activateBillingSchema,
  confirmBillingPaymentSchema,
  recordSaleSchema,
  selectPartnerBillingSchema,
  serviceSchema,
  setPlanSchema,
  updateBaySchema,
  updateBusinessSchema,
  updateServiceSchema,
  verifyScanSchema,
} from "../models/schemas.js";
import { BOOKING_STATUSES, type BookingStatus, type QueueItem } from "../models/types.js";
import { listBookings, getBooking, publicBooking, transitionBooking, verifyScan } from "../services/bookings-service.js";
import {
  activateBilling,
  confirmBillingPayment,
  pricingCatalog,
  requirePlatformAdmin,
  selectPartnerBilling,
} from "../services/billing-service.js";
import { removeBusiness, setPlan, updateBusiness } from "../services/businesses-service.js";
import { createItem, listItems, updateItem } from "../services/catalog-service.js";
import { growthMetrics } from "../services/growth-service.js";
import { createInvite, listInvites, revokeInvite } from "../services/invites-service.js";
import { listMembers, removeMember } from "../services/members-service.js";
import { listAlerts, markAlertRead } from "../services/notify-service.js";
import { paths } from "../services/paths.js";
import { ensureStarterServices } from "../services/starter-services.js";
import { createQueueItem, listQueue, updateQueueItem, walkInAllowance } from "../services/queue-service.js";
import { listSales, recordSale, salesSummary } from "../services/sales-service.js";

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const param = (v: unknown) => {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw badRequest("Invalid id.");
  return v;
};

/**
 * Everything under /businesses/:businessId. `requireMembership` runs first on
 * every route, so no handler can touch another shop's data.
 */
export function businessRoutes(deps: Deps) {
  const { store } = deps;
  const r = Router({ mergeParams: true });
  const member = requireMembership(store);
  const owner = requireMembership(store, ["owner"]);
  const paid = requirePlan("paid");
  const user = (res: Parameters<typeof getUser>[0]) => ({ type: "user" as const, id: getUser(res).uid });

  r.put("/plan", validateBody(setPlanSchema), async (req, res) => {
    const u = getUser(res);
    if (!u.platformAdmin) throw forbidden("Only River Apps admins can change a shop's plan.");
    const business = await setPlan(store, param(req.params.businessId), req.body.plan, u.uid, deps.now());
    res.json({ data: business });
  });

  r.get("/", member, (_req, res) => {
    res.json({ data: getBusiness(res), membership: { role: getMember(res).role } });
  });
  r.patch("/", owner, validateBody(updateBusinessSchema), async (req, res) => {
    res.json({ data: await updateBusiness(store, getBusiness(res), getUser(res).uid, req.body, deps.now()) });
  });

  // Shop photos: raw image body (JPEG/PNG/WebP, < 5 MB), owner only. The API writes to
  // Storage because Storage rules cannot check membership in named Firestore databases.
  r.post(
    "/photos",
    owner,
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }),
    async (req, res) => {
      const b = getBusiness(res);
      if (!deps.photos) throw new HttpError(503, "photos_unavailable", "Photo uploads are not configured.");
      const type = (req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      const ext = PHOTO_TYPES[type];
      if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) throw badRequest("Send a JPG, PNG, or WebP image.");
      if ((b.photoUrls ?? []).length >= 6) throw badRequest("A shop can have up to 6 photos.");
      const name = `${getUser(res).uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await deps.photos.save(`businesses/${b.id}/photos/${name}`, req.body, type);
      res.status(201).json({ data: { url } });
    },
  );
  // Moment photos: same upload as shop photos but not counted against the 6 listing photos.
  r.post(
    "/moment-photos",
    member,
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }),
    async (req, res) => {
      const b = getBusiness(res);
      if (!deps.photos) throw new HttpError(503, "photos_unavailable", "Photo uploads are not configured.");
      const type = (req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      const ext = PHOTO_TYPES[type];
      if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) throw badRequest("Send a JPG, PNG, or WebP image.");
      const name = `${getUser(res).uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await deps.photos.save(`businesses/${b.id}/moments/${name}`, req.body, type);
      res.status(201).json({ data: { url } });
    },
  );
  r.delete("/photos", owner, validateBody(z.object({ url: z.string().url() })), async (req, res) => {
    const b = getBusiness(res);
    const path = deps.photos?.pathFromUrl(req.body.url);
    if (deps.photos && path && path.startsWith(`businesses/${b.id}/photos/`) && !path.includes("..")) {
      await deps.photos.remove(path);
    }
    res.status(204).end();
  });

  r.get("/billing", member, (_req, res) => {
    const b = getBusiness(res);
    res.json({ data: { billing: b.billing ?? null, plan: b.plan, planStatus: b.planStatus, pricing: pricingCatalog() } });
  });
  r.post("/billing/select", owner, validateBody(selectPartnerBillingSchema), async (req, res) => {
    res.json({ data: await selectPartnerBilling(store, getBusiness(res), req.body.partnerOption, getUser(res).uid, deps.now()) });
  });
  r.post("/billing/confirm-payment", owner, validateBody(confirmBillingPaymentSchema), async (req, res) => {
    res.json({ data: await confirmBillingPayment(store, getBusiness(res), req.body, getUser(res).uid, deps.now()) });
  });
  r.put("/billing/activate", validateBody(activateBillingSchema), async (req, res) => {
    const u = getUser(res);
    requirePlatformAdmin(!!u.platformAdmin);
    res.json({ data: await activateBilling(store, param(req.params.businessId), req.body, u.uid, deps.now()) });
  });

  r.get("/members", member, async (_req, res) => {
    res.json({ data: await listMembers(store, getBusiness(res).id) });
  });
  r.post("/members/invites", owner, validateBody(inviteMemberSchema), async (req, res) => {
    const b = getBusiness(res);
    const invite = await createInvite(store, b.id, req.body, getUser(res).uid, deps.now());
    res.status(201).json({ data: invite });
  });
  r.get("/members/invites", owner, async (_req, res) => {
    res.json({ data: await listInvites(store, getBusiness(res).id) });
  });
  r.delete("/members/invites/:inviteId", owner, async (req, res) => {
    await revokeInvite(store, getBusiness(res).id, param(req.params.inviteId), getUser(res).uid, deps.now());
    res.status(204).end();
  });
  r.delete("/members/:uid", owner, async (req, res) => {
    await removeMember(store, getBusiness(res).id, param(req.params.uid), getUser(res).uid, deps.now());
    res.status(204).end();
  });

  r.delete("/", owner, async (_req, res) => {
    await removeBusiness(store, getBusiness(res).id, getUser(res).uid, deps.now());
    res.status(204).end();
  });

  r.get("/feedback", member, async (_req, res) => {
    const b = getBusiness(res);
    res.json({ data: { summary: await feedbackSummary(store), mine: await myFeedback(store, b.id, getUser(res).uid) } });
  });
  r.post("/feedback", member, validateBody(feedbackSchema), async (req, res) => {
    const b = getBusiness(res);
    const summary = await saveFeedback(store, b.id, getUser(res).uid, { rating: req.body.rating, comment: (req.body.comment ?? "").trim() }, deps.now());
    res.json({ data: { summary, mine: { rating: req.body.rating, comment: (req.body.comment ?? "").trim() } } });
  });

  r.get("/services", member, async (_req, res) => {
    await ensureStarterServices(store, getBusiness(res), deps.now());
    res.json({ data: await listItems(store, paths.services(getBusiness(res).id), "name") });
  });
  r.post("/services", owner, validateBody(serviceSchema), async (req, res) => {
    const b = getBusiness(res);
    res.status(201).json({ data: await createItem(store, b.id, paths.services(b.id), req.body, getUser(res).uid, "service.create", deps.now()) });
  });
  r.patch("/services/:serviceId", owner, validateBody(updateServiceSchema), async (req, res) => {
    const b = getBusiness(res);
    res.json({ data: await updateItem(store, b.id, paths.service(b.id, param(req.params.serviceId)), req.body, getUser(res).uid, "service.update", deps.now()) });
  });

  r.get("/bays", member, paid, async (_req, res) => {
    res.json({ data: await listItems(store, paths.bays(getBusiness(res).id), "sortOrder") });
  });
  r.post("/bays", owner, paid, validateBody(baySchema), async (req, res) => {
    const b = getBusiness(res);
    res.status(201).json({ data: await createItem(store, b.id, paths.bays(b.id), req.body, getUser(res).uid, "bay.create", deps.now()) });
  });
  r.patch("/bays/:bayId", owner, paid, validateBody(updateBaySchema), async (req, res) => {
    const b = getBusiness(res);
    res.json({ data: await updateItem(store, b.id, paths.bay(b.id, param(req.params.bayId)), req.body, getUser(res).uid, "bay.update", deps.now()) });
  });

  r.get("/customers", member, paid, async (_req, res) => {
    res.json({ data: await listItems(store, paths.customers(getBusiness(res).id), "name") });
  });
  r.post("/customers", member, paid, validateBody(customerSchema), async (req, res) => {
    const b = getBusiness(res);
    res.status(201).json({ data: await createItem(store, b.id, paths.customers(b.id), req.body, getUser(res).uid, "customer.create", deps.now()) });
  });

  r.get("/bookings", member, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (status && !BOOKING_STATUSES.includes(status as BookingStatus)) throw badRequest("Unknown status filter.");
    res.json({ data: await listBookings(store, getBusiness(res).id, status as BookingStatus | undefined) });
  });
  r.post("/bookings/verify", member, validateBody(verifyScanSchema), async (req, res) => {
    res.json({ data: await verifyScan(store, getBusiness(res), req.body.payload, user(res), deps.now()) });
  });
  r.get("/bookings/:bookingId", member, async (req, res) => {
    res.json({ data: publicBooking(await getBooking(store, getBusiness(res).id, param(req.params.bookingId))) });
  });
  for (const [action, to] of [["accept", "accepted"], ["decline", "declined"], ["complete", "completed"]] as const) {
    r.post(`/bookings/:bookingId/${action}`, member, async (req, res) => {
      res.json({ data: await transitionBooking(store, getBusiness(res), param(req.params.bookingId), to, user(res), deps.now()) });
    });
  }

  // The queue is open to every plan; Partner walk-ins are capped per day in createQueueItem.
  r.get("/queue", member, async (req, res) => {
    const b = getBusiness(res);
    const date = typeof req.query.date === "string" && /^\d{8}$/.test(req.query.date) ? req.query.date : manilaDayKey(deps.now());
    const [data, walkIns] = await Promise.all([listQueue(store, b.id, date), walkInAllowance(store, b.id, b.plan, deps.now())]);
    res.json({ data, date, walkIns });
  });
  r.get("/queue/:queueItemId", member, async (req, res) => {
    const item = await store.get<QueueItem>(paths.queueItem(getBusiness(res).id, param(req.params.queueItemId)));
    if (!item) throw notFound("Queue item not found.");
    res.json({ data: item });
  });
  r.post("/queue", member, validateBody(queueCreateSchema), async (req, res) => {
    const b = getBusiness(res);
    const item = await createQueueItem(store, b.id, { ...req.body, source: "staff", bookingId: null }, user(res), deps.now(), b.plan);
    res.status(201).json({ data: item, walkIns: await walkInAllowance(store, b.id, b.plan, deps.now()) });
  });
  r.patch("/queue/:queueItemId", member, validateBody(queueUpdateSchema), async (req, res) => {
    const b = getBusiness(res);
    const result = await updateQueueItem(store, b.id, param(req.params.queueItemId), req.body, getUser(res).uid, deps.now());
    res.json({ data: result.item, sale: result.sale });
  });

  r.get("/sales", member, paid, async (req, res) => {
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
    res.json({ data: await listSales(store, getBusiness(res).id, { limit: Number.isFinite(limit) ? Math.min(limit, 200) : 100 }) });
  });
  r.get("/sales/summary", member, paid, async (req, res) => {
    const date = typeof req.query.date === "string" && /^\d{8}$/.test(req.query.date) ? req.query.date : manilaDayKey(deps.now());
    res.json({ data: await salesSummary(store, getBusiness(res).id, date) });
  });
  r.post("/sales", member, paid, validateBody(recordSaleSchema), async (req, res) => {
    const b = getBusiness(res);
    const sale = await recordSale(store, b.id, req.body, getUser(res).uid, deps.now());
    res.status(201).json({ data: sale });
  });

  r.get("/alerts", member, async (_req, res) => {
    res.json({ data: await listAlerts(store, getBusiness(res).id) });
  });
  r.post("/alerts/:alertId/read", member, async (req, res) => {
    await markAlertRead(store, getBusiness(res).id, param(req.params.alertId));
    res.status(204).end();
  });

  r.get("/growth", member, async (_req, res) => {
    res.json({ data: await growthMetrics(store, getBusiness(res).id, deps.now()) });
  });

  r.get("/audit-logs", owner, requireRole("owner"), async (_req, res) => {
    const b = getBusiness(res);
    res.json({ data: await store.list(paths.auditLogs(b.id), { orderBy: { field: "at", direction: "desc" }, limit: 100 }) });
  });

  return r;
}
