import type { Response } from "express";
import type { AuthUser } from "../auth/token-verifier.js";
import type { Doc } from "../store/doc-store.js";
import type { ApiScope, Business, Member } from "../models/types.js";

/** Typed accessors for values middleware stores on res.locals. */
export interface RequestContext {
  user?: AuthUser;
  member?: Doc<Member>;
  business?: Doc<Business>;
  /** River Bridge caller on /v1, set after both auth factors pass. */
  partner?: PartnerCaller;
}

const ctx = (res: Response) => res.locals as RequestContext;

export function getUser(res: Response): AuthUser {
  const user = ctx(res).user;
  if (!user) throw new Error("requireAuth middleware missing");
  return user;
}

export function getMember(res: Response): Doc<Member> {
  const member = ctx(res).member;
  if (!member) throw new Error("requireMembership middleware missing");
  return member;
}

export function getBusiness(res: Response): Doc<Business> {
  const business = ctx(res).business;
  if (!business) throw new Error("requireMembership middleware missing");
  return business;
}

export interface PartnerCaller {
  /** Owner id stored on bookings this caller creates (api_booking_index.clientId). */
  id: string;
  scopes: ApiScope[];
  /** Verified service-account email (never a token). */
  caller: string;
  keyId: string;
}

export function getPartner(res: Response): PartnerCaller {
  const partner = ctx(res).partner;
  if (!partner) throw new Error("riverPartnerAuth middleware missing");
  return partner;
}

export function setContext(res: Response, values: Partial<RequestContext>) {
  Object.assign(res.locals, values);
}
