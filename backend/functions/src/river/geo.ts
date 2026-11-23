/** Geohash helpers for the River Mobile near-me shop list (GET /v1/shops). */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encodeGeohash(lat: number, lng: number, precision = 9): string {
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; minLng = mid; } else { ch <<= 1; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; minLat = mid; } else { ch <<= 1; maxLat = mid; }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/** Cell size in degrees for a geohash precision. */
function cellDegrees(precision: number) {
  const bits = precision * 5;
  const lngBits = Math.ceil(bits / 2);
  const latBits = Math.floor(bits / 2);
  return { lat: 180 / 2 ** latBits, lng: 360 / 2 ** lngBits };
}

const KM_PER_DEG_LAT = 111.32;

/**
 * Geohash prefixes that cover the circle's bounding box, at the finest precision
 * that needs at most `maxCells` prefixes. Each prefix becomes one capped range query.
 */
export function coveringPrefixes(lat: number, lng: number, radiusKm: number, maxCells = 9): string[] {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / (KM_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const minLat = Math.max(lat - dLat, -90), maxLat = Math.min(lat + dLat, 90);
  const minLng = Math.max(lng - dLng, -180), maxLng = Math.min(lng + dLng, 180);
  for (let precision = 6; precision >= 1; precision--) {
    const step = cellDegrees(precision);
    const cells = new Set<string>();
    for (let y = minLat; ; y = Math.min(y + step.lat, maxLat)) {
      for (let x = minLng; ; x = Math.min(x + step.lng, maxLng)) {
        cells.add(encodeGeohash(y, x, precision));
        if (cells.size > maxCells || x >= maxLng) break;
      }
      if (cells.size > maxCells || y >= maxLat) break;
    }
    if (cells.size <= maxCells) return [...cells].sort();
  }
  return [""];
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Denormalized `riverGeo` on businesses/{id}: the shop's geohash while it is listed on
 * River Mobile, has a map pin and is not removed; null otherwise. Only shops with a
 * riverGeo can appear in GET /v1/shops.
 */
export function riverGeoFor(b: {
  riverMobile?: { listed: boolean } | null;
  location?: { lat: number; lng: number } | null;
  deletedAt?: string | null;
}): string | null {
  if (!b.riverMobile?.listed || b.deletedAt || !b.location) return null;
  const { lat, lng } = b.location;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return encodeGeohash(lat, lng, 9);
}
