import type { BookingStatus } from "../models/types.js";

/** Shared River status set (docs/partner-api/openapi.yaml `Status`). */
export const RIVER_STATUSES = ["requested", "accepted", "in_progress", "ready", "completed", "declined", "cancelled"] as const;
export type RiverStatus = (typeof RIVER_STATUSES)[number];

/** Current spelling for orders placed through the River Bridge. */
export const RIVER_SOURCE = "river_mobile" as const;

/** Every spelling that means "came from River Mobile" (older rows keep theirs). */
export const RIVER_SOURCES: ReadonlySet<string> = new Set([RIVER_SOURCE, "river_mobile_api", "river-mobile", "river"]);

export const isRiverSource = (source: string | null | undefined) => !!source && RIVER_SOURCES.has(source);

/** Carwash booking status -> shared River status. Same table as the Bridge's LEGACY.carwash map. */
const MAP: Record<BookingStatus, RiverStatus> = {
  requested: "requested",
  accepted: "accepted",
  declined: "declined",
  cancelled: "cancelled",
  no_show: "cancelled",
  checked_in: "in_progress",
  queued: "in_progress",
  in_bay: "in_progress",
  done: "ready",
  completed: "completed",
  paid: "completed",
  closed: "completed",
};

export function toRiverStatus(status: BookingStatus): RiverStatus {
  return MAP[status];
}
