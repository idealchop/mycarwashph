
import type { LatLng } from './types';

export const toLngLat = (c: LatLng): [number, number] => [c.longitude, c.latitude];

/** Great-circle distance in km */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough city-driving ETA for the straight-line fallback (~18 km/h incl. stops) */
export function straightEta(km: number): number {
  return Math.max(2, Math.round((km / 18) * 60));
}


