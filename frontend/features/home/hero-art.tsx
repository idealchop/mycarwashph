import { cn } from "@river-apps/ui";

/**
 * River Apps standard hero art: a photoreal studio shot on pure black that sits on the right of a
 * black card and fades into it (mask on the left edge, so there is no visible box or seam).
 */
export function HeroArt({ className, fade = 38 }: { className?: string; fade?: number }) {
  const mask = `linear-gradient(to right, transparent 0%, #000 ${fade}%)`;
  return (
    <picture className={cn("pointer-events-none absolute inset-y-0 right-0 block", className)}>
      <source srcSet="/hero/car-hero.webp" type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative art; <picture> gives the webp + png fallback */}
      <img
        src="/hero/car-hero.png"
        alt=""
        aria-hidden
        decoding="async"
        className="size-full object-cover object-right"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      />
    </picture>
  );
}
