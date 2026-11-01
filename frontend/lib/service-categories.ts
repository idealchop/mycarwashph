import type { Service, ServiceCategory, ServiceIconName } from "@/lib/api";

/** Service categories (fixed list, like Barbers.ph), each with its carwash 3D icon. */
export const CATEGORIES: { id: ServiceCategory; label: string; icon: ServiceIconName }[] = [
  { id: "car-wash", label: "Car Wash", icon: "carwash" },
  { id: "interior", label: "Interior", icon: "interior" },
  { id: "detailing", label: "Detailing", icon: "detailing" },
  { id: "wax-coating", label: "Wax & Coating", icon: "wax" },
  { id: "engine", label: "Engine", icon: "engine" },
  { id: "add-ons", label: "Add-ons", icon: "tire-shine" },
];

/** 3D icons an owner can pick per service. */
export const SERVICE_ICONS: ServiceIconName[] = ["carwash", "foam", "pressure-washer", "vacuum", "interior", "detailing", "wax", "engine", "tire-shine", "sedan", "suv", "motorcycle"];

export const categoryOf = (s: Pick<Service, "category">): ServiceCategory => s.category ?? "car-wash";
export const iconOf = (s: Pick<Service, "category" | "icon">): ServiceIconName =>
  s.icon ?? CATEGORIES.find((c) => c.id === categoryOf(s))!.icon;

/** Services grouped by category, in category order, empty groups dropped. */
export function groupByCategory<T extends Pick<Service, "category">>(services: T[]) {
  return CATEGORIES.map((c) => ({ ...c, services: services.filter((s) => categoryOf(s) === c.id) })).filter((g) => g.services.length);
}
