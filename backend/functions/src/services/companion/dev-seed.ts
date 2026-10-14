import type { Business, Plan, VehicleSize } from "../../models/types.js";
import type { DocStore } from "../../store/doc-store.js";
import { manilaDayKey } from "../../lib/time.js";
import { paths } from "../paths.js";

/**
 * DEV DATABASE ONLY. Seeds ~30 days of realistic synthetic walk-ins, bookings
 * and sales into the caller's own shop so AI Insights has data to read. The
 * route that calls this is mounted only when config.devTools is true (dev env).
 * All ids start with "seed_" so a re-run overwrites instead of duplicating.
 */
const SERVICES = [
  { id: "seed_svc_basic", name: "Basic Wash", durationMins: 30, pricesBySize: { small: 18000, medium: 22000, large: 28000, xl: 35000 } },
  { id: "seed_svc_wax", name: "Wash & Wax", durationMins: 45, pricesBySize: { small: 35000, medium: 42000, large: 50000, xl: 60000 } },
  { id: "seed_svc_interior", name: "Interior Vacuum", durationMins: 30, pricesBySize: { small: 15000, medium: 18000, large: 22000, xl: 25000 } },
  { id: "seed_svc_engine", name: "Engine Wash", durationMins: 30, pricesBySize: { small: 25000, medium: 25000, large: 30000, xl: 35000 } },
  { id: "seed_svc_detail", name: "Full Detail", durationMins: 120, pricesBySize: { small: 180000, medium: 220000, large: 260000, xl: 300000 } },
] as const;
const BAYS = [
  { id: "seed_bay_1", name: "Bay 1", sortOrder: 0 },
  { id: "seed_bay_2", name: "Bay 2", sortOrder: 1 },
  { id: "seed_bay_3", name: "Bay 3", sortOrder: 2 },
];
// Relative weight of cars per weekday (Sun..Sat) and per hour (8 AM..6 PM).
const DAY_WEIGHT = [1.5, 0.6, 0.7, 0.7, 0.8, 1.1, 1.8];
const HOUR_WEIGHT: Record<number, number> = { 8: 0.5, 9: 0.9, 10: 1.2, 11: 1.1, 12: 0.7, 13: 0.8, 14: 1.1, 15: 1.4, 16: 1.5, 17: 1.0, 18: 0.4 };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export async function seedDemoData(store: DocStore, business: Pick<Business, "plan"> & { id: string }, opts: { now: Date; plan?: Plan; days?: number }) {
  const b = business.id;
  const at = opts.now.toISOString();
  const rand = rng(42);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const writes: [string, Record<string, unknown>][] = [];

  for (const s of SERVICES) writes.push([paths.service(b, s.id), { name: s.name, durationMins: s.durationMins, pricesBySize: s.pricesBySize, active: true, listedOnRiverMobile: true, seed: true, createdAt: at, updatedAt: at }]);
  for (const bay of BAYS) writes.push([paths.bay(b, bay.id), { name: bay.name, active: true, sortOrder: bay.sortOrder, seed: true, createdAt: at, updatedAt: at }]);

  const regulars = Array.from({ length: 40 }, (_, i) => `SDR ${1000 + i}`);
  const sizes: VehicleSize[] = ["small", "medium", "medium", "medium", "large", "large", "xl"];
  let n = 0;
  const days = opts.days ?? 30;
  for (let d = days; d >= 1; d--) {
    const dayStart = new Date(opts.now.getTime() - d * 86_400_000);
    const key = manilaDayKey(dayStart);
    const y = Number(key.slice(0, 4)), mo = Number(key.slice(4, 6)), da = Number(key.slice(6, 8));
    const weekday = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
    let queueNo = 0;
    for (const [hStr, hw] of Object.entries(HOUR_WEIGHT)) {
      const h = Number(hStr);
      const cars = Math.round(DAY_WEIGHT[weekday]! * hw * (1.6 + rand() * 1.2));
      for (let c = 0; c < cars; c++) {
        n++;
        queueNo++;
        const minute = Math.floor(rand() * 60);
        // Manila is UTC+8, no DST.
        const created = new Date(Date.UTC(y, mo - 1, da, h - 8, minute));
        const wait = Math.round(5 + rand() * (hw > 1.2 ? 35 : 15));
        const svc = rand() < 0.5 ? SERVICES[0] : rand() < 0.55 ? SERVICES[1] : rand() < 0.6 ? SERVICES[2] : rand() < 0.75 ? SERVICES[3] : SERVICES[4];
        const addOn = svc.id === "seed_svc_basic" && rand() < 0.2 ? SERVICES[2] : null;
        const started = new Date(created.getTime() + wait * 60_000);
        const done = new Date(started.getTime() + (svc.durationMins + Math.round(rand() * 15 - 5)) * 60_000);
        const size = pick(sizes);
        const plate = rand() < 0.35 ? pick(regulars) : `SDN ${String(n).padStart(4, "0")}`;
        const isBooking = rand() < 0.22;
        const qid = `seed_q_${key}_${queueNo}`;
        const bookingId = isBooking ? `seed_bk_${key}_${queueNo}` : null;
        const serviceIds = addOn ? [svc.id, addOn.id] : [svc.id];
        const amount = serviceIds.reduce((a, id) => a + (SERVICES.find((s) => s.id === id)!.pricesBySize[size] ?? 0), 0);
        const bay = BAYS[Math.min(2, Math.floor(rand() * (rand() < 0.15 ? 3 : 2.4)))]!;
        writes.push([paths.queueItem(b, qid), {
          queueNumber: queueNo, queueDate: key, source: isBooking ? "booking" : rand() < 0.6 ? "walk_in_qr" : "staff", status: "paid",
          bayId: bay.id, serviceIds, vehicleSize: size, plate, customerId: null, bookingId,
          startedAt: started.toISOString(), doneAt: done.toISOString(), createdAt: created.toISOString(), updatedAt: done.toISOString(), seed: true,
        }]);
        writes.push([paths.sale(b, `seed_s_${key}_${queueNo}`), {
          queueItemId: qid, bookingId, amountCentavos: amount, method: rand() < 0.55 ? "cash" : rand() < 0.8 ? "gcash" : "maya",
          paymentRef: null, paymentQrPayload: null, status: "recorded", serviceIds, vehicleSize: size, plate, customerName: null,
          recordedBy: "seed", paidAt: done.toISOString(), createdAt: done.toISOString(), updatedAt: done.toISOString(), seed: true,
        }]);
        if (bookingId) writes.push([paths.booking(b, bookingId), bookingDoc(bookingId, "paid", serviceIds, size, plate, created, "river_mobile_api", qid)]);
      }
    }
    // Missed bookings: a few no-shows and cancellations, more on weekends.
    const missed = Math.round((weekday === 0 || weekday === 6 ? 2 : 1) * rand() * 1.8);
    for (let k = 0; k < missed; k++) {
      const id = `seed_bk_${key}_x${k}`;
      const when = new Date(Date.UTC(y, mo - 1, da, 9 + Math.floor(rand() * 8) - 8, 0));
      writes.push([paths.booking(b, id), bookingDoc(id, rand() < 0.6 ? "no_show" : "cancelled", [pick(SERVICES).id], pick(sizes), null, when, rand() < 0.7 ? "river_mobile_api" : "online_link", null)]);
    }
  }

  for (let i = 0; i < writes.length; i += 100) {
    await Promise.all(writes.slice(i, i + 100).map(([p, data]) => store.set(p, data)));
  }
  if (opts.plan) {
    const billing = opts.plan === "paid"
      ? { partnerOption: "monthly", status: "active", lastPayment: null, activatedAt: at, expiresAt: new Date(opts.now.getTime() + 30 * 86_400_000).toISOString(), checkoutProvider: "manual" }
      : { partnerOption: null, status: "trial", lastPayment: null, activatedAt: null, expiresAt: null, checkoutProvider: "manual" };
    await store.update(paths.business(b), { plan: opts.plan, planStatus: "active", billing, insightsRefreshedAt: null, updatedAt: at });
  }
  return { writes: writes.length, cars: n, days };
}

function bookingDoc(id: string, status: string, serviceIds: string[], size: VehicleSize, plate: string | null, when: Date, source: string, queueItemId: string | null) {
  const iso = when.toISOString();
  return {
    reference: `CWS-${id.slice(-6).toUpperCase()}`, source, status, serviceIds, vehicleSize: size, plate, scheduledStart: iso,
    customerSnapshot: { name: "Seed customer", phoneE164: null }, verifyCodeHash: "seed", external: null, notes: null,
    acceptedBy: null, checkedInAt: queueItemId ? iso : null, queueItemId, createdAt: iso, updatedAt: iso, seed: true,
  };
}
