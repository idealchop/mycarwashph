import type { Business, Service, ServiceCategory, ServiceIcon } from "../models/types.js";
import type { DocStore, Tx } from "../store/doc-store.js";
import { paths } from "./paths.js";

/** Default 3D icon per category (same map as the frontend). */
export const CATEGORY_ICON: Record<ServiceCategory, ServiceIcon> = {
  "car-wash": "bubbles", interior: "vacuum", detailing: "sparkle", "wax-coating": "shield", engine: "car", "add-ons": "tyre",
};

type Starter = Pick<Service, "name" | "category" | "pricesBySize">;
const p = (s: number, m: number, l: number, xl: number) => ({ small: s * 100, medium: m * 100, large: l * 100, xl: xl * 100 });

/** Starter menu every shop gets. Prices are editable PH defaults (₱, Small/Medium/Large/XL). */
export const STARTER_SERVICES: Starter[] = [
  { name: "Basic Wash", category: "car-wash", pricesBySize: p(200, 250, 300, 350) },
  { name: "Wash & Vacuum", category: "car-wash", pricesBySize: p(280, 330, 400, 450) },
  { name: "Interior Vacuum", category: "interior", pricesBySize: p(150, 150, 200, 250) },
  { name: "Interior Detailing", category: "detailing", pricesBySize: p(1500, 1800, 2200, 2500) },
  { name: "Hand Wax", category: "wax-coating", pricesBySize: p(350, 400, 500, 600) },
  { name: "Engine Wash", category: "engine", pricesBySize: p(300, 350, 400, 450) },
  { name: "Tire Black", category: "add-ons", pricesBySize: p(50, 50, 80, 100) },
];

function writeStarters(store: DocStore, tx: Tx, businessId: string, at: string, skip: Set<string>) {
  let added = 0;
  for (const s of STARTER_SERVICES) {
    if (skip.has(s.name.toLowerCase())) continue;
    tx.create(paths.service(businessId, store.newId()), { ...s, icon: null, active: true, listedOnRiverMobile: true, createdAt: at, updatedAt: at });
    added++;
  }
  return added;
}

/** Inside createBusiness: the new shop gets the full starter menu. */
export function seedStarterServices(store: DocStore, tx: Tx, businessId: string, at: string) {
  return writeStarters(store, tx, businessId, at, new Set());
}

/**
 * One-time, additive backfill for shops created before starters existed. Only shops with no
 * services, or only a Basic Wash, get the missing starters; nothing is edited or removed.
 * Runs once per shop (starterServicesAt), so starters an owner deletes do not come back.
 */
export async function ensureStarterServices(store: DocStore, business: { id: string } & Pick<Business, "starterServicesAt">, now: Date) {
  if (business.starterServicesAt) return 0;
  const existing = await store.list<Service>(paths.services(business.id));
  const names = existing.map((s) => s.name.trim().toLowerCase());
  const eligible = existing.length === 0 || (existing.length === 1 && names[0] === "basic wash");
  return store.runTransaction(async (tx) => {
    const b = await tx.get<Business>(paths.business(business.id));
    if (!b || b.starterServicesAt) return 0;
    const at = now.toISOString();
    const added = eligible ? writeStarters(store, tx, business.id, at, new Set(names)) : 0;
    tx.update(paths.business(business.id), { starterServicesAt: at });
    return added;
  });
}
