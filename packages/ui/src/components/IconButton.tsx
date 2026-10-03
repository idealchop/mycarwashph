import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";
import { Badge } from "./Badge";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name, e.g. "Notifications". */
  label: string;
  icon: ReactNode;
  variant?: "soft" | "surface" | "ghost" | "white";
  size?: "md" | "lg";
  /** Shows a black count badge (e.g. unread notifications). */
  count?: number;
}

/** Round icon-only button with a 44px+ tap target. */
export function IconButton({ label, icon, variant = "soft", size = "md", count, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={count ? `${label} (${count})` : label}
      className={cn(
        "relative inline-flex flex-none items-center justify-center rounded-full text-ink transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        size === "lg" ? "size-12" : "size-11",
        variant === "soft" && "bg-grey-100 hover:bg-grey-200",
        variant === "surface" && "bg-surface shadow-card hover:bg-grey-50",
        variant === "white" && "bg-surface text-ink",
        variant === "ghost" && "bg-transparent hover:bg-grey-100",
        className,
      )}
      {...rest}
    >
      {icon}
      {count ? <Badge variant="count" className="absolute -right-0.5 -top-0.5" aria-hidden>{count > 99 ? "99+" : count}</Badge> : null}
    </button>
  );
}
