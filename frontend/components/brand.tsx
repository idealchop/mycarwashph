// Official River smile mark: exact vector paths from river-mobile-ui/repo/src/components/ui/riverLogoPaths.ts
// (the same source Barbers.ph uses). Coordinate space of the 900x238 logo; the mark spans x 0..458, y 0..238.
const SMILE_PATH =
  "M33.6,56.0 C90.7,68.0 134.0,128.5 198.0,128.5 C285.4,128.5 338.7,24.9 423.4,31.0 C337.1,78.3 294.2,204.5 185.0,204.5 C110.5,204.5 83.4,104.6 33.6,56.0Z";
const UNDERLINE_PATH = "M179.9,234.0 C235.3,235.5 284.7,195.8 323.0,157.0 C292.0,200.9 237.7,247.7 179.9,234.0Z";
const LEFTCORNER_PATH = "M5.0,67.8 C-7.5,54.2 3.3,24.4 24.0,28.8 C18.5,39.2 7.0,54.2 5.0,67.8Z";
const RIGHTCORNER_PATH = "M433.0,-0.2 C435.8,11.4 448.5,28.8 449.0,41.0 C460.7,27.6 455.3,-4.5 433.0,-0.2Z";
const PATHS = [SMILE_PATH, UNDERLINE_PATH, LEFTCORNER_PATH, RIGHTCORNER_PATH];

/** The River smile as inline SVG (crisp at any size). */
export function RiverSmile({ color = "#0A0A0A", className, width }: { color?: string; className?: string; width?: number }) {
  return (
    <svg viewBox="-10 -6 472 256" fill={color} aria-hidden className={className} width={width} height={width ? Math.round((width * 256) / 472) : undefined}>
      {PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** In-app logo: the River smile in black, no background tile. `size` is the box it sits in. */
export function RiverIcon({ size = 34 }: { size?: number }) {
  return (
    <span aria-hidden className="inline-flex flex-none items-center justify-center" style={{ width: size, height: size }}>
      <RiverSmile width={size} />
    </span>
  );
}

/** Mycarwash.ph wordmark with the River app icon. */
export function MycarwashBrand({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <RiverIcon size={size} />
      <span className="text-[19px] font-extrabold tracking-[-0.02em]">
        Mycarwash<span className="font-semibold text-subtle">.ph</span>
      </span>
    </span>
  );
}

export function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
