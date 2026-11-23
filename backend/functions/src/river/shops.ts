import { createHash } from "node:crypto";
import { HttpError } from "../lib/errors.js";
import type { Business } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import { coveringPrefixes, distanceKm } from "./geo.js";

export const SHOPS_DEFAULT_LIMIT = 20;
export const SHOPS_MAX_LIMIT = 50;
export const SHOPS_DEFAULT_RADIUS_KM = 10;
export const SHOPS_MAX_RADIUS_KM = 200;
/** Reads per geohash cell, and at most this many cells: ≤ 9 × 60 = 540 docs per request. */
export const SHOPS_PER_CELL_CAP = 60;
export const SHOPS_MAX_CELLS = 9;

const invalid = (message: string) => new HttpError(400, "invalid_request", message);

export interface ShopsQuery {
  lat: number;
  lng: number;
  radiusKm: number;
  limit: number;
  offset: number;
}

const num = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const queryKey = (lat: number, lng: number, radiusKm: number) =>
  createHash("sha256").update(`${lat}|${lng}|${radiusKm}`).digest("hex").slice(0, 12);

/** Parses lat/lng/radiusKm/limit/cursor. lat and lng are required (the list is "near a point"). */
export function parseShopsQuery(q: Record<string, unknown>): ShopsQuery {
  const lat = num(q.lat);
  const lng = num(q.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw invalid("Send lat and lng.");
  }
  const radiusKm = q.radiusKm === undefined ? SHOPS_DEFAULT_RADIUS_KM : num(q.radiusKm);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > SHOPS_MAX_RADIUS_KM) throw invalid(`radiusKm must be between 0 and ${SHOPS_MAX_RADIUS_KM}.`);
  const limit = q.limit === undefined ? SHOPS_DEFAULT_LIMIT : num(q.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > SHOPS_MAX_LIMIT) throw invalid(`limit must be 1 to ${SHOPS_MAX_LIMIT}.`);
  let offset = 0;
  if (q.cursor !== undefined) {
    try {
      const c = JSON.parse(Buffer.from(String(q.cursor), "base64url").toString("utf8")) as { o?: unknown; k?: unknown };
      if (typeof c.o !== "number" || !Number.isInteger(c.o) || c.o < 0 || c.k !== queryKey(lat, lng, radiusKm)) throw new Error("cursor");
      offset = c.o;
    } catch {
      throw invalid("cursor is not valid for this query.");
    }
  }
  return { lat, lng, radiusKm, limit, offset };
}

/** Shared-contract Shop (openapi.yaml `Shop`) plus `shopId` for older callers. */
export function shopView(b: Doc<Business>, distance?: number) {
  return {
    id: b.id,
    shopId: b.id,
    name: b.name,
    address: b.address ?? b.location?.formattedAddress ?? null,
    location: b.location ? { lat: b.location.lat, lng: b.location.lng, formattedAddress: b.location.formattedAddress ?? null } : null,
    hours: b.hours ?? null,
    photos: Array.isArray(b.photoUrls) ? b.photoUrls.filter((u) => typeof u === "string" && u.startsWith("https://")).slice(0, 6) : [],
    plan: b.plan,
    phone: b.phoneE164 ?? null,
    ...(distance === undefined ? {} : { distanceKm: Math.round(distance * 10) / 10 }),
  };
}

/**
 * GET /v1/shops: listed + active shops with a map pin and an address, nearest first.
 * One indexed range query per covering geohash cell (planStatus == active,
 * riverGeo in [prefix, prefix~)), each capped, so a request reads at most
 * SHOPS_MAX_CELLS × SHOPS_PER_CELL_CAP docs. Cursor = offset into the sorted result.
 */
export async function listNearbyShops(store: DocStore, q: ShopsQuery) {
  const prefixes = coveringPrefixes(q.lat, q.lng, q.radiusKm, SHOPS_MAX_CELLS);
  const pages = await Promise.all(
    prefixes.map((prefix) =>
      store.list<Business>("businesses", {
        where: [
          ["planStatus", "==", "active"],
          ["riverGeo", ">=", prefix],
          ["riverGeo", "<", `${prefix}~`],
        ],
        orderBy: { field: "riverGeo" },
        limit: SHOPS_PER_CELL_CAP,
      }),
    ),
  );
  const seen = new Set<string>();
  const rows: { b: Doc<Business>; d: number }[] = [];
  for (const b of pages.flat()) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    if (!b.riverMobile?.listed || b.deletedAt || !b.location || !(b.address || b.location.formattedAddress)) continue;
    const d = distanceKm(q.lat, q.lng, b.location.lat, b.location.lng);
    if (d <= q.radiusKm) rows.push({ b, d });
  }
  rows.sort((a, z) => a.d - z.d || a.b.id.localeCompare(z.b.id));
  const page = rows.slice(q.offset, q.offset + q.limit);
  const next = q.offset + q.limit;
  return {
    shops: page.map(({ b, d }) => shopView(b, d)),
    nextCursor: next < rows.length ? Buffer.from(JSON.stringify({ o: next, k: queryKey(q.lat, q.lng, q.radiusKm) })).toString("base64url") : null,
  };
}
