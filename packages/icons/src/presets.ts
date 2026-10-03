/** Server-safe data (no "use client"), so it can be used in Server Components. */
export type Hair = "short" | "long" | "bun";
/** Colourful illustrated person presets: [background, shirt, skin, hair, hair style]. */
export const AVATAR_PRESETS = {
  sky: ["#E3EEFF", "#3B82F6", "#F1C7A0", "#2B2B33", "short"],
  rose: ["#FFE4EE", "#F472B6", "#E9B48C", "#3A2A22", "long"],
  mint: ["#DDF5EA", "#10B981", "#C98E66", "#1F1F25", "short"],
  butter: ["#FFF2C7", "#F59E0B", "#F3CDA8", "#5B3A29", "bun"],
  lilac: ["#EDE6FF", "#8B5CF6", "#8D5B3E", "#141418", "short"],
  peach: ["#FFE6D9", "#F97316", "#E2A57E", "#2E2018", "long"],
  indigo: ["#E3EEFF", "#6366F1", "#B97A56", "#18181B", "bun"],
} as const satisfies Record<string, readonly [string, string, string, string, Hair]>;
export type AvatarPreset = keyof typeof AVATAR_PRESETS;
export const AVATAR_PRESET_NAMES = Object.keys(AVATAR_PRESETS) as AvatarPreset[];


export const ICON_NAMES = ["bubbles", "vacuum", "sparkle", "tyre", "drop", "car", "chat", "shield", "check", "coin"] as const;
export type IconName = (typeof ICON_NAMES)[number];
