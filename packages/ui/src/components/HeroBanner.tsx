import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export interface HeroBannerProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Small pill above the title, e.g. a date or partner name. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** "display" makes the title a big number (e.g. today's revenue). */
  titleSize?: "md" | "lg" | "display";
  description?: ReactNode;
  /** One white primary action (plus an optional ghost one). */
  actions?: ReactNode;
  /** A colourful illustration, positioned bottom-right. */
  illustration?: ReactNode;
  /** Tailwind classes to place the illustration, e.g. "-right-8 bottom-3". Replaces the default "bottom-2 right-0". */
  illustrationClassName?: string;
  /** Max width of the text column so it never runs under the illustration. */
  contentWidth?: number | string;
  size?: "sm" | "md" | "lg";
}

const titleCls = { md: "text-[20px] leading-[1.12]", lg: "text-[30px] leading-[1.12]", display: "text-[34px] leading-[1.05] tracking-[-0.035em]" };
const sizeCls = { sm: "min-h-[164px] px-5 py-4", md: "min-h-[186px] px-5 py-4", lg: "min-h-[192px] px-8 py-6" };

/** Black hero banner with a bold title, white call to action and a 3D illustration. */
export function HeroBanner({
  eyebrow, title, titleSize = "md", description, actions, illustration, illustrationClassName,
  contentWidth = "55%", size = "md", className, ...rest
}: HeroBannerProps) {
  return (
    <section className={cn("relative isolate overflow-hidden rounded-banner bg-ink text-on-ink", sizeCls[size], className)} {...rest}>
      {/* neutral glows */}
      <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />
      <i aria-hidden className="pointer-events-none absolute -bottom-[140px] right-10 size-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.08),rgba(255,255,255,0)_65%)]" />
      <div className="relative z-10 flex flex-col items-start" style={{ maxWidth: contentWidth }}>
        {eyebrow ? <span className="rounded-pill bg-on-ink-subtle px-2.5 py-[5px] text-[11.5px] font-bold leading-none text-on-ink-muted">{eyebrow}</span> : null}
        <h2 className={cn("font-extrabold tracking-[-0.025em]", eyebrow ? (titleSize === "display" ? "mt-1.5" : "mt-2.5") : "", titleCls[titleSize])}>{title}</h2>
        {description ? <p className={cn("font-medium text-on-ink-muted", size === "lg" ? "mt-2 text-[14.5px]" : titleSize === "display" ? "mt-0.5 text-[13px]" : "mt-1.5 text-[13px]")}>{description}</p> : null}
        {actions ? <div className={cn("flex flex-wrap gap-2.5", size === "lg" ? "mt-5" : size === "sm" ? "mt-2.5" : "mt-3.5")}>{actions}</div> : null}
      </div>
      {illustration ? <div aria-hidden className={cn("pointer-events-none absolute z-0", illustrationClassName ?? "bottom-2 right-0")}>{illustration}</div> : null}
    </section>
  );
}
