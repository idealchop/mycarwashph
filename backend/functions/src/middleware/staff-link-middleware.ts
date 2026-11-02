import type { RequestHandler } from "express";
import type { DocStore } from "../store/doc-store.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { resolveStaffLink } from "../services/staff-links-service.js";
import type { Member } from "../models/types.js";
import type { Doc } from "../store/doc-store.js";
import { setContext } from "./context.js";

/**
 * Staff link access (no account), mounted before requireAuth. Applies only when the request has
 * `X-Staff-Link` and no Bearer token. The token must resolve to an active link, the URL must be
 * that link's own shop, and the route must be on the staff allowlist (queue and walk-ins).
 */
const ALLOW: [string, RegExp][] = [
  ["GET", /^\/?$/],
  ["GET", /^\/services$/],
  ["GET", /^\/bays$/],
  ["GET", /^\/bookings$/],
  ["GET", /^\/bookings\/[A-Za-z0-9_-]+$/],
  ["POST", /^\/bookings\/[A-Za-z0-9_-]+\/[a-z_-]+$/],
  ["POST", /^\/bookings\/verify$/],
  ["GET", /^\/queue$/],
  ["GET", /^\/queue\/[A-Za-z0-9_-]+$/],
  ["POST", /^\/queue$/],
  ["PATCH", /^\/queue\/[A-Za-z0-9_-]+$/],
  ["POST", /^\/sales$/],
];

export const STAFF_LINK_MEMBER = "staffLinkMember";

export function staffLinkAuth(store: DocStore): RequestHandler {
  return async (req, res, next) => {
    const token = req.header("x-staff-link");
    if (!token || /^Bearer /i.test(req.header("authorization") ?? "")) return next();
    try {
      const link = await resolveStaffLink(store, token);
      if (!link) throw unauthorized("This staff link was reset or turned off. Ask the owner for the new link.");
      const m = /^\/businesses\/([^/]+)(\/.*)?$/.exec(req.path);
      if (!m || m[1] !== link.businessId) throw forbidden();
      const rest = (m[2] ?? "/").replace(/\/$/, "") || "/";
      if (!ALLOW.some(([method, re]) => method === req.method && re.test(rest))) throw forbidden("Staff links can only use the queue and walk-ins.");
      setContext(res, { user: { uid: link.member.uid, name: link.name, platformAdmin: false } });
      (res.locals as Record<string, unknown>)[STAFF_LINK_MEMBER] = link.member;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const staffLinkMember = (locals: Record<string, unknown>) => locals[STAFF_LINK_MEMBER] as Doc<Member> | undefined;
