import { randomBytes } from "node:crypto";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import type { Business } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";

/**
 * Moments: one feed shared by every car wash on Mycarwash.ph (mirrors Barbers.ph
 * community posts). Stored in the top-level `moments` collection, separate from
 * shop photos, so the 6-photo listing limit does not apply.
 */
export interface MomentAuthor {
  name: string;
  meta?: string | null;
  photoUrl?: string | null;
  businessId: string;
}
export interface MomentReply {
  id: string;
  author: MomentAuthor;
  authorUid: string;
  body: string;
  createdAt: number;
}
export interface Moment {
  businessId: string;
  authorUid: string;
  author: MomentAuthor;
  body: string;
  images: string[];
  createdAt: number;
  likedBy: string[];
  repostedBy: string[];
  replies: MomentReply[];
}

const COLLECTION = "moments";
const path = (id: string) => `${COLLECTION}/${id}`;
const shortId = () => randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "x");
export const MAX_MOMENT_IMAGES = 4;
export const MAX_MOMENT_CHARS = 1000;

export function authorFor(business: Doc<Business>): MomentAuthor {
  const area = (business.location?.formattedAddress ?? business.address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    name: business.name,
    meta: area.length ? area[area.length - 1] : null,
    photoUrl: business.logoUrl ?? null,
    businessId: business.id,
  };
}

/** Public view of a post; `liked`, `reposted` and `mine` are for the caller when signed in. */
export function view(m: Doc<Moment>, uid: string | null, myBusinessIds: string[]) {
  return {
    id: m.id,
    author: m.author,
    body: m.body,
    images: m.images ?? [],
    createdAt: m.createdAt,
    likes: (m.likedBy ?? []).length,
    reposts: (m.repostedBy ?? []).length,
    replies: (m.replies ?? []).map((r) => ({ id: r.id, author: r.author, body: r.body, createdAt: r.createdAt })),
    liked: uid ? (m.likedBy ?? []).includes(uid) : false,
    reposted: uid ? (m.repostedBy ?? []).includes(uid) : false,
    mine: myBusinessIds.includes(m.businessId),
  };
}

export async function listMoments(store: DocStore, limit = 60) {
  return store.list<Moment>(COLLECTION, { orderBy: { field: "createdAt", direction: "desc" }, limit });
}

export async function createMoment(store: DocStore, business: Doc<Business>, uid: string, body: string, images: string[], now: Date) {
  const text = body.trim().slice(0, MAX_MOMENT_CHARS);
  const urls = images.filter((u) => /^https:\/\//.test(u)).slice(0, MAX_MOMENT_IMAGES);
  if (!text && !urls.length) throw badRequest("Write something or add a photo.");
  const id = shortId();
  const doc: Moment = {
    businessId: business.id,
    authorUid: uid,
    author: authorFor(business),
    body: text,
    images: urls,
    createdAt: now.getTime(),
    likedBy: [],
    repostedBy: [],
    replies: [],
  };
  await store.create(path(id), doc as unknown as Record<string, unknown>);
  return id;
}

/** Like or repost toggles for the signed-in user. Returns the new state. */
export async function toggleMoment(store: DocStore, id: string, uid: string, field: "likedBy" | "repostedBy") {
  return store.runTransaction(async (tx) => {
    const m = await tx.get<Moment>(path(id));
    if (!m) throw notFound("That post was removed.");
    const list = m[field] ?? [];
    const on = list.includes(uid);
    tx.update(path(id), { [field]: on ? list.filter((x) => x !== uid) : [...list, uid] });
    return !on;
  });
}

export async function replyMoment(store: DocStore, id: string, business: Doc<Business>, uid: string, body: string, now: Date) {
  const text = body.trim().slice(0, MAX_MOMENT_CHARS);
  if (!text) throw badRequest("Write a reply.");
  await store.runTransaction(async (tx) => {
    const m = await tx.get<Moment>(path(id));
    if (!m) throw notFound("That post was removed.");
    const reply: MomentReply = { id: shortId(), author: authorFor(business), authorUid: uid, body: text, createdAt: now.getTime() };
    tx.update(path(id), { replies: [...(m.replies ?? []), reply] });
  });
}

export async function deleteMoment(store: DocStore, id: string, myBusinessIds: string[]) {
  const m = await store.get<Moment>(path(id));
  if (!m) throw notFound("That post was removed.");
  if (!myBusinessIds.includes(m.businessId)) throw forbidden("You can only delete your own shop’s posts.");
  await store.delete(path(id));
  return m;
}
