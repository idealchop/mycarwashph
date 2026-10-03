import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export type BadgeVariant = "count" | "solid" | "soft" | "outline" | "inverse" | "on-ink";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  children?: ReactNode;
}

const v: Record<BadgeVariant, string> = {
  count: "min-w-[19px] h-[19px] px-[5px] justify-center bg-ink text-on-ink text-[11px] font-extrabold ring-2 ring-surface",
  solid: "bg-ink text-on-ink",
  soft: "bg-grey-100 text-ink",
  outline: "bg-surface text-ink ring-1 ring-inset ring-grey-200",
  inverse: "bg-surface text-ink",
  "on-ink": "bg-on-ink-subtle text-on-ink-muted",
};

/** Small pill label. Monochrome only: black, white or grey. Use variant="count" for notification counts. */
export function Badge({ variant = "soft", size = "md", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-pill font-bold leading-none",
        variant !== "count" && (size === "sm" ? "px-2 py-[3px] text-[11px]" : "px-2.5 py-1 text-[12px]"),
        v[variant], className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export type StatusTone = "active" | "waiting" | "idle" | "inverse";
export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  /** Visible status text. Always pair the dot with words. */
  children?: ReactNode;
}
const dot: Record<StatusTone, string> = { active: "bg-ink", waiting: "bg-grey-400", idle: "bg-grey-300", inverse: "bg-on-ink" };

/** A small dot plus a word ("New", "Waiting"). Colour is never the only signal. */
export function StatusDot({ tone = "active", className, children, ...rest }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2", className)} {...rest}>
      <i aria-hidden className={cn("block size-[7px] rounded-full", dot[tone])} />
      {children}
    </span>
  );
}
