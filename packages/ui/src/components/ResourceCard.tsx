import type { ReactNode } from "react";
import { cn } from "../cn";
import { ProgressRing } from "./ProgressRing";

export interface ResourceCardProps {
  /** A colourful 3D icon (wrap in IconTile for desktop density). */
  icon: ReactNode;
  title: ReactNode;
  /** Small grey line above the title, e.g. "Room 2 · In use". */
  eyebrow?: ReactNode;
  /** Monospace reference under the title, e.g. a plate, order or ticket number. */
  meta?: ReactNode;
  /** Shows a ProgressRing top-right. */
  progress?: { value: number; label?: ReactNode; ariaLabel?: string };
  /** Replaces the ring top-right (e.g. an "Assign" button or a badge). */
  action?: ReactNode;
  /** "inverse" = the black highlighted tile (e.g. the free resource). */
  variant?: "default" | "inverse";
  density?: "compact" | "comfortable";
  className?: string;
}

/** A visual card for a resource with live progress: a room, bay, desk, machine or table. */
export function ResourceCard({ icon, title, eyebrow, meta, progress, action, variant = "default", density = "compact", className }: ResourceCardProps) {
  const inv = variant === "inverse";
  const comfy = density === "comfortable";
  return (
    <article
      className={cn(
        "flex flex-col rounded-card",
        comfy ? "min-h-[134px] px-4 py-3.5" : "min-h-[108px] px-3.5 pb-2 pt-2.5",
        inv ? "bg-ink text-on-ink shadow-raised" : "bg-surface shadow-card",
        className,
      )}
    >
      <div className="mb-auto flex shrink-0 items-start justify-between gap-2">
        {icon}
        {action ?? (progress ? (
          <ProgressRing value={progress.value} label={progress.label} ariaLabel={progress.ariaLabel}
            size={comfy ? 54 : 44} thickness={comfy ? 6 : 5} labelSize={comfy ? 12 : 11} tone={inv ? "inverse" : "ink"} />
        ) : null)}
      </div>
      {eyebrow ? <span className={cn("shrink-0 font-semibold", comfy ? "mt-1 text-[12px]" : "mt-0.5 text-[11.5px] leading-tight", inv ? "text-on-ink-muted" : "text-muted")}>{eyebrow}</span> : null}
      <b className={cn("shrink-0 truncate leading-[1.25] tracking-[-0.01em]", comfy ? "text-[15.5px]" : "text-[14.5px]")}>{title}</b>
      {meta ? <span className={cn("shrink-0 truncate font-mono font-medium", comfy ? "text-[12.5px] leading-[1.35]" : "text-[12px] leading-tight", inv ? "text-on-ink-muted" : "text-ink-2")}>{meta}</span> : null}
    </article>
  );
}
