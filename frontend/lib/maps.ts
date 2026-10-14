import { RIVER_STYLE_URL_V2026_10 } from "@river/map/theme";

/** Shop location stored on businesses/{id}.location (also returned by GET /v1/shops/:id). */
export type ShopLocationValue = {
  lat: number;
  lng: number;
  formattedAddress: string | null;
  placeId: string | null;
};

/**
 * River Maps style (MapLibre + self-hosted Philippines PMTiles on River's GCS bucket).
 * Pinned to a release; switching releases is a config change (NEXT_PUBLIC_MAP_STYLE_URL).
 */
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || RIVER_STYLE_URL_V2026_10;

/** Default centre: Metro Manila. */
export const PH_DEFAULT = { lat: 14.5995, lng: 120.9842 };

/** Rough Philippines bounding box, used to reject obviously wrong pins. */
export function inPhilippines(lat: number, lng: number): boolean {
  return lat >= 4 && lat <= 21.5 && lng >= 116 && lng <= 127.5;
}
