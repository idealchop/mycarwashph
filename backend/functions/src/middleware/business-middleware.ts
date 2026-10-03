import type { RequestHandler } from "express";
import type { DocStore } from "../store/doc-store.js";
import { forbidden, HttpError } from "../lib/errors.js";
import type { Business, Member, Plan, Role } from "../models/types.js";
import { paths } from "../services/paths.js";
import { getBusiness, getMember, getUser, setContext } from "./context.js";

/**
 * Tenancy guard (fixes River Kit's gap where the workspace id was trusted as-is).
 *
 * For every route under /businesses/:businessId it:
 *   1. reads businesses/{businessId}/members/{uid} for the signed-in user,
 *   2. rejects with 403 unless the membership exists, is active and has one of `roles`,
 *   3. only then loads the business (never auto-creates it).
 *
 * Unknown businesses and businesses you are not a member of both return the same
 * 403, so ids cannot be probed.
 */
export function requireMembership(store: DocStore, roles: readonly Role[] = ["owner", "staff"]): RequestHandler {
  return async (req, res, next) => {
    try {
      const businessId = req.params.businessId;
      if (typeof businessId !== "string" || !businessId) throw forbidden();
      const user = getUser(res);
      const member = await store.get<Member>(paths.member(businessId, user.uid));
      if (!member || member.status !== "active" || member.businessId !== businessId) throw forbidden();
      if (!roles.includes(member.role)) {
        throw forbidden(`This action needs the ${roles.join(" or ")} role.`);
      }
      const business = await store.get<Business>(paths.business(businessId));
      if (!business) throw forbidden();
      setContext(res, { member, business });
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Requires an already-authorized membership with a specific role (use after requireMembership). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => {
    const member = getMember(res);
    if (!roles.includes(member.role)) return next(forbidden(`This action needs the ${roles.join(" or ")} role.`));
    next();
  };
}

/** Plan gating: Paid-only features return 402 on Partner shops. */
export function requirePlan(plan: Plan): RequestHandler {
  return (_req, res, next) => {
    const business = getBusiness(res);
    if (business.plan !== plan || business.planStatus !== "active") {
      return next(new HttpError(402, "plan_required", `This feature needs the ${plan} plan.`));
    }
    next();
  };
}
