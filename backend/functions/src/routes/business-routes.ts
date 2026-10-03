import { Router } from "express";
import type { Deps } from "../deps.js";
import { requireMembership, requirePlan, requireRole } from "../middleware/business-middleware.js";
import { getBusiness, getMember, getUser } from "../middleware/context.js";
import { validateBody } from "../middleware/validate.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { manilaDayKey } from "../lib/time.js";
import {
  baySchema,
  customerSchema,
  queueCreateSchema,
  queueUpdateSchema,
  serviceSchema,
  setPlanSchema,
  updateBaySchema,
  updateBusinessSchema,
  updateServiceSchema,
  verifyScanSchema,
} from "../models/schemas.js";
import { BOOKING_STATUSES, type BookingStatus } from "../models/types.js";
import { listBookings, getBooking, publicBooking, transitionBooking, verifyScan } from "../services/bookings-service.js";
import { setPlan, updateBusiness } from "../services/businesses-service.js";
import { createItem, listItems, updateItem } from "../services/catalog-service.js";
import { listMembers, removeMember } from "../services/members-service.js";
import { paths } from "../services/paths.js";
import { createQueueItem, listQueue, updateQueueItem } from "../services/queue-service.js";

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
  const member = requireMembership(store); // owner or staff
  const owner = requireMembership(store, ["owner"]);
  const paid = requirePlan("paid");
  const user = (res: Parameters<typeof getUser>[0]) => ({ type: "user" as const, id: getUser(res).uid });

  // Platform admin only (River Apps staff): plan changes. Not a shop member route.
  r.put("/plan", validateBody(setPlanSchema), async (req, res) => {
    const u = getUser(res);
    if (!u.platformAdmin) throw forbidden("Only River Apps admins can change a shop's plan.");
    const business = await setPlan(store, param(req.params.businessId), req.body.plan, u.uid, deps.now());
    res.json({ data: business });
  });

  // ---- Business profile
  r.get("/", member, (_req, res) => {
    res.json({ data: getBusiness(res), membership: { role: getMember(res).role } });
  });
  r.patch("/", owner, validateBody(updateBusinessSchema), async (req, res) => {
    res.json({ data: await updateBusiness(store, getBusiness(res), getUser(res).uid, req.body, deps.now()) });
  });

  // ---- Members (invites are Phase 1)
  r.get("/members", member, async (_req, res) => {
    res.json({ data: await listMembers(store, getBusiness(res).id) });
  });
  r.delete("/members/:uid", owner, async (req, res) => {
    await removeMember(store, getBusiness(res).id, param(req.params.uid), getUser(res).uid, deps.now());
    res.status(204).end();
  });

  // ---- Services (menu). Staff can read; only owners edit prices.
  r.get("/services", member, async (_req, res) => {
    res.json({ data: await listItems(store, paths.services(getBusiness(res).id), "name") });
  });
  r.post("/services", owner, validateBody(serviceSchema), async (req, res) => {
    const b = getBusiness(res);
    res.status(201).json({ data: await createItem(store, b.id, paths.services(b.id), req.body, getUser(res).uid, "service.create", deps.now()) });
  });
  r.patch("/services/:serviceId", owner, validateBody(updateServiceSchema), async (req, res) => {
    const b = getBusiness(res);
    const path = paths.service(b.id, param(req.params.serviceId));
    res.json({ data: await updateItem(store, b.id, path, req.body, getUser(res).uid, "service.update", deps.now()) });
  });

  // ---- Bays (Paid)
  r.get("/bays", member, paid, async (_req, res) => {
    res.json({ data: await listItems(store, paths.bays(getBusiness(res).id), "sortOrder") });
  });
  r.post("/bays", owner, paid, validateBody(baySchema), async (req, res) => {
    const b = getBusiness(res);
    res.status(201).json({ data: await createItem(store, b.id, paths.bays(b.id), req.body, getUser(res).uid, "bay.create", deps.now()) });
  });
  r.patch("/bays/:bayId", owner, paid, validateBody(updateBaySchema), async (req, res) => {
    const b = getBusiness(res);
    const path = paths.bay(b.id, param(req.params.bayId));
    res.json({ data: await updateItem(store, b.id, path, req.body, getUser(res).uid, "bay.update", deps.now()) });
  });

  // ---- Customers (Paid)
  r.get("/customers", member, paid, async (_req, res) => {
    res.json({ data: await listItems(store, paths.customers(getBusiness(res).id), "name") });
  });
  r.post("/customers", member, paid, validateBody(customerSchema), async (req, res) => {
    const b = getBusiness(res);
    res.status(201).json({ data: await createItem(store, b.id, paths.customers(b.id), req.body, getUser(res).uid, "customer.create", deps.now()) });
  });

  // ---- Bookings (both plans)
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

  // ---- Queue (Paid)
  r.get("/queue", member, paid, async (req, res) => {
    const date = typeof req.query.date === "string" && /^\d{8}$/.test(req.query.date) ? req.query.date : manilaDayKey(deps.now());
    res.json({ data: await listQueue(store, getBusiness(res).id, date), date });
  });
  r.post("/queue", member, paid, validateBody(queueCreateSchema), async (req, res) => {
    const item = await createQueueItem(store, getBusiness(res).id, { ...req.body, source: "staff", bookingId: null }, user(res), deps.now());
    res.status(201).json({ data: item });
  });
  r.patch("/queue/:queueItemId", member, paid, validateBody(queueUpdateSchema), async (req, res) => {
    const b = getBusiness(res);
    res.json({ data: await updateQueueItem(store, b.id, param(req.params.queueItemId), req.body, getUser(res).uid, deps.now()) });
  });

  // ---- Audit log (owner)
  r.get("/audit-logs", owner, requireRole("owner"), async (_req, res) => {
    const b = getBusiness(res);
    res.json({ data: await store.list(paths.auditLogs(b.id), { orderBy: { field: "at", direction: "desc" }, limit: 100 }) });
  });

  return r;
}
