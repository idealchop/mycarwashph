import { RiverIcon } from "@/components/river-icon";

/** Carwash River 3D icons for the sidebar and the bottom nav. Inactive: muted (greyscale, faded), like Barbers.ph. */
export type Nav3DName = "home" | "queue" | "moments";

export function NavIcon3D({ name, size = 26, active = true }: { name: Nav3DName; size?: number; active?: boolean }) {
  return <RiverIcon name={name} size={size} className={`nav-3d block transition-[filter,opacity] ${active ? "" : "opacity-60 grayscale-[0.85]"}`} />;
}
