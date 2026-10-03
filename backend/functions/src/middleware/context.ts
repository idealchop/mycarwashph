import type { Response } from "express";
import type { AuthUser } from "../auth/token-verifier.js";
import type { Doc } from "../store/doc-store.js";
import type { ApiClient, Business, Member } from "../models/types.js";

/** Typed accessors for values middleware stores on res.locals. */
export interface RequestContext {
  user?: AuthUser;
  member?: Doc<Member>;
  business?: Doc<Business>;
  apiClient?: Doc<ApiClient>;
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

export function getApiClient(res: Response): Doc<ApiClient> {
  const client = ctx(res).apiClient;
  if (!client) throw new Error("requireApiClient middleware missing");
  return client;
}

export function setContext(res: Response, values: Partial<RequestContext>) {
  Object.assign(res.locals, values);
}
