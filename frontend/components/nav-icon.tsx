import { RiverIcon } from "@/components/river-icon";

/** Carwash River 3D icons for the sidebar and the bottom nav. */
export type Nav3DName = "home" | "queue" | "moments";

export function NavIcon3D({ name, size = 26 }: { name: Nav3DName; size?: number }) {
  return <RiverIcon name={name} size={size} className="nav-icon-3d" />;
}
