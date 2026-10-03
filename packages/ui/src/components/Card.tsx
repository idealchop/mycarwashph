import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** "surface" = white card with soft shadow; "inverse" = black; "muted" = light grey, no shadow. */
  tone?: "surface" | "inverse" | "muted";
  padding?: "none" | "sm" | "md" | "lg";
  radius?: "panel" | "card" | "banner";
  as?: "div" | "section" | "article" | "li";
  children?: ReactNode;
}
const pad = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;

export function Card({ tone = "surface", padding = "md", radius = "card", as: As = "div", className, children, ...rest }: CardProps) {
  return (
    <As
      className={cn(
        radius === "panel" ? "rounded-panel" : radius === "banner" ? "rounded-banner" : "rounded-card",
        tone === "surface" && "bg-surface shadow-card",
        tone === "inverse" && "bg-ink text-on-ink shadow-raised",
        tone === "muted" && "bg-grey-100",
        pad[padding], className,
      )}
      {...(rest as HTMLAttributes<HTMLElement>)}
    >
      {children}
    </As>
  );
}

export interface CardHeaderProps { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }
/** Title row used inside cards: bold title, grey subtitle, optional action on the right. */
export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[16px] font-bold">{title}</span>
        {subtitle ? <span className="mt-0.5 text-[12.5px] font-semibold text-muted">{subtitle}</span> : null}
      </div>
      {action}
    </div>
  );
}
