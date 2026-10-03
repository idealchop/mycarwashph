"use client";
import { useId, type SVGProps } from "react";
import { a11yProps } from "./Graphic";
import { AVATAR_PRESETS, type AvatarPreset, type Hair } from "./presets";

const HAIR: Record<Hair, string> = {
  short: "M12.2 15.2c0-5 3.4-8 7.8-8s7.8 3 7.8 8c-1.2-1.8-3.6-3-7.8-3s-6.6 1.2-7.8 3Z",
  long: "M11.6 22c-.6-9 2.8-14.6 8.4-14.6s9 5.6 8.4 14.6c-1-.5-1.6-2.4-1.8-6-1.6-1.6-3.8-2.6-6.6-2.6s-5 1-6.6 2.6c-.2 3.6-.8 5.5-1.8 6Z",
  bun: "M12.4 15.6c0-5 3.3-7.8 7.6-7.8s7.6 2.8 7.6 7.8c-1.4-2-3.8-3.2-7.6-3.2s-6.2 1.2-7.6 3.2Z",
};

export interface PersonAvatarProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  preset?: AvatarPreset;
  size?: number;
  title?: string;
}

/** Abstract illustrated person (no real likeness). */
export function PersonAvatar({ preset = "sky", size = 40, title, style, ...rest }: PersonAvatarProps) {
  const id = "ra" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [bg, shirt, skin, hair, style_] = AVATAR_PRESETS[preset];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} style={{ display: "block", flex: "none", borderRadius: "50%", ...style }} {...a11yProps(title)} {...rest}>
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={`${id}c`}><circle cx="20" cy="20" r="20" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="40" height="40" fill={bg} />
        <path d="M5 42c1-8.5 7-13 15-13s14 4.5 15 13Z" fill={shirt} />
        <rect x="17" y="22" width="6" height="8" rx="3" fill={skin} />
        <circle cx="20" cy="16.5" r="7.6" fill={skin} />
        <g fill={hair}>
          {style_ === "bun" ? <circle cx="20" cy="6.2" r="3.4" /> : null}
          <path d={HAIR[style_]} />
        </g>
      </g>
    </svg>
  );
}
