import type { HTMLAttributes } from "react";
import { PersonAvatar, type AvatarPreset } from "@river-apps/icons";
import { cn } from "../cn";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Person or business name; used for the accessible label and initials fallback. */
  name: string;
  /** Illustrated avatar preset (colourful). */
  preset?: AvatarPreset;
  /** Photo URL. Takes precedence over preset. */
  src?: string;
  size?: number;
  /** Decorative avatars (name already shown next to it) are hidden from screen readers. */
  decorative?: boolean;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

/** Illustrated, photo or initials avatar. Initials fall back to black on light grey. */
export function Avatar({ name, preset, src, size = 40, decorative = true, className, ...rest }: AvatarProps) {
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": name };
  return (
    <span className={cn("inline-flex flex-none overflow-hidden rounded-full", className)} style={{ width: size, height: size }} {...a11y} {...rest}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="size-full object-cover" />
      ) : preset ? (
        <PersonAvatar preset={preset} size={size} />
      ) : (
        <span className="flex size-full items-center justify-center bg-grey-200 font-extrabold text-ink" style={{ fontSize: Math.round(size * 0.38) }}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
