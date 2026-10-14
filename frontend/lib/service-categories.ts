import type { Service, ServiceCategory, ServiceIconName } from "@/lib/api";

/** Service categories (fixed list, like Barbers.ph), each with its 3D icon. */
export const CATEGORIES: { id: ServiceCategory; label: string; icon: ServiceIconName }[] = [
  { id: "car-wash", label: "Car Wash", icon: "bubbles" },
  { id: "interior", label: "Interior", icon: "vacuum" },
  { id: "detailing", label: "Detailing", icon: "sparkle" },
  { id: "wax-coating", label: "Wax & Coating", icon: "shield" },
  { id: "engine", label: "Engine", icon: "car" },
  { id: "add-ons", label: "Add-ons", icon: "tyre" },
];

/** 3D icons an owner can pick per service. */
export const SERVICE_ICONS: ServiceIconName[] = ["bubbles", "vacuum", "sparkle", "shield", "drop", "car", "tyre", "coin", "check"];

export const categoryOf = (s: Pick<Service, "category">): ServiceCategory => s.category ?? "car-wash";
export const iconOf = (s: Pick<Service, "category" | "icon">): ServiceIconName =>
  s.icon ?? CATEGORIES.find((c) => c.id === categoryOf(s))!.icon;

/** Services grouped by category, in category order, empty groups dropped. */
export function groupByCategory<T extends Pick<Service, "category">>(services: T[]) {
  return CATEGORIES.map((c) => ({ ...c, services: services.filter((s) => categoryOf(s) === c.id) })).filter((g) => g.services.length);
}
