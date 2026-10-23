import { Icon3D, type IconName } from "@river-apps/icons";

/**
 * Mycarwash River 3D icons (public/icons3d/carwash, built by /workspace/icons/carwash-pack/build.py, Oct 24, 2026).
 * The 128px WebP is used up to 64px on screen (2x), the 256px above that.
 */
export const CARWASH_ICONS = [
  "carwash", "foam", "pressure-washer", "vacuum", "wax", "tire-shine", "engine", "interior", "detailing",
  "sedan", "suv", "motorcycle", "queue", "home", "ticket", "moments", "empty-queue",
] as const;
export type CarwashIcon = (typeof CARWASH_ICONS)[number];

export const iconSrc = (name: CarwashIcon, size: number) => `/icons3d/carwash/${size <= 64 ? 128 : 256}/${name}.webp`;

export function RiverIcon({ name, size = 40, className = "", label }: { name: CarwashIcon; size?: number; className?: string; label?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static WebP pair picked by size; no optimizer needed
    <img
      src={iconSrc(name, size)}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={`flex-none select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Older generic pack names (still stored on services) mapped to the carwash set. coin/check have no carwash icon yet. */
const LEGACY: Partial<Record<IconName, CarwashIcon>> = {
  bubbles: "carwash", vacuum: "vacuum", sparkle: "detailing", shield: "wax", tyre: "tire-shine", drop: "pressure-washer", car: "sedan",
};
export type ArtName = CarwashIcon | IconName;
const isCarwash = (n: string): n is CarwashIcon => (CARWASH_ICONS as readonly string[]).includes(n);

/** Any icon name: carwash icons (and mapped legacy names) render the carwash set; the rest stay on the generic pack. */
export function Art({ name, size = 40, className }: { name: ArtName; size?: number; className?: string }) {
  if (isCarwash(name)) return <RiverIcon name={name} size={size} className={className} />;
  const mapped = LEGACY[name];
  return mapped ? <RiverIcon name={mapped} size={size} className={className} /> : <Icon3D name={name} size={size} />;
}
