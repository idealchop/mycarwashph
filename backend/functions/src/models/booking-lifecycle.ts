import type { BookingStatus, Plan } from "./types.js";

/** Allowed booking transitions (plan §3.6). */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ["accepted", "declined", "cancelled"],
  accepted: ["checked_in", "cancelled", "no_show"],
  declined: [],
  cancelled: [],
  no_show: [],
  checked_in: ["completed", "queued"],
  completed: [],
  queued: ["in_bay", "cancelled"],
  in_bay: ["done"],
  done: ["paid"],
  paid: ["closed"],
  closed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus, plan: Plan): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  // Partner shops stop at checked_in -> completed; Paid shops continue into the queue.
  if (plan === "partner" && ["queued", "in_bay", "done", "paid", "closed"].includes(to)) return false;
  if (plan === "paid" && to === "completed") return false;
  return true;
}
