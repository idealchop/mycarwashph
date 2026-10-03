import { extendTailwindMerge } from "tailwind-merge";

export type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[];

/** tailwind-merge taught about the kit's custom tokens, so consumer classes reliably override defaults. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["ink", "ink-2", "muted", "subtle", "line", "canvas", "surface", "grey-50", "grey-100", "grey-200", "grey-300", "grey-400", "grey-500", "grey-600", "on-ink", "on-ink-muted", "on-ink-subtle", "on-ink-line", "focus"],
      radius: ["xs", "sm", "control", "tile", "panel", "card", "banner", "device", "pill"],
      shadow: ["card", "tile", "float", "popover", "button", "raised", "button-white"],
      text: ["display", "title-lg", "title", "heading", "body-lg", "body", "label", "small", "caption", "micro"],
      spacing: ["tap-min", "button-lg", "button-md", "button-sm", "tabbar", "sidebar", "phone-width"],
    },
  },
});

function join(values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v || v === true) continue;
    if (Array.isArray(v)) { const s = join(v); if (s) out.push(s); }
    else out.push(String(v));
  }
  return out.join(" ");
}

/** Joins class names (skipping falsy values) and resolves Tailwind conflicts; later classes win. */
export function cn(...values: ClassValue[]): string {
  return twMerge(join(values));
}
