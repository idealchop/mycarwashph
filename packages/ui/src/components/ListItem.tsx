import type { ReactNode } from "react";
import { cn } from "../cn";

export interface ListItemProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Extra row under a dashed divider, e.g. who requested it plus Accept / Decline. */
  footer?: ReactNode;
  /** Render as a white card (default) or a plain row for use inside another card. */
  variant?: "card" | "row";
  as?: "div" | "li";
  className?: string;
}

export function ListItem({ leading, title, subtitle, trailing, footer, variant = "card", as: As = "div", className }: ListItemProps) {
  const card = variant === "card";
  return (
    <As className={cn(card ? "rounded-card bg-surface py-3 pl-3 pr-3.5 shadow-card" : "py-[7px]", className)}>
      <div className={cn("flex items-center", card ? "gap-3" : "gap-3")}>
        {leading}
        <div className="flex min-w-0 flex-1 flex-col leading-[1.3]">
          <b className={cn("truncate tracking-[-0.01em]", card ? "text-[15.5px]" : "text-[14px]")}>{title}</b>
          {subtitle ? <span className={cn("truncate font-medium text-muted", card ? "mt-0.5 text-[13px]" : "text-[12.5px]")}>{subtitle}</span> : null}
        </div>
        {trailing}
      </div>
      {footer ? <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-[#E8E8EC] pt-3">{footer}</div> : null}
    </As>
  );
}
