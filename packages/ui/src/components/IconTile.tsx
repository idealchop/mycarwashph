import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export interface IconTileProps extends HTMLAttributes<HTMLSpanElement> {
  /** Usually a colourful 3D icon from @river-apps/icons. */
  children: ReactNode;
  size?: number;
  /** Tile background: light grey (default), white, black or dark (for use on black cards). */
  tone?: "grey" | "white" | "ink" | "dark";
}

/** Neutral rounded tile behind a coloured icon. Tiles never carry colour themselves. */
export function IconTile({ children, size = 52, tone = "grey", className, style, ...rest }: IconTileProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center",
        tone === "grey" && "bg-grey-100",
        tone === "white" && "bg-surface shadow-tile",
        tone === "ink" && "bg-ink",
        tone === "dark" && "bg-[#1C1C1F]",
        className,
      )}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}
