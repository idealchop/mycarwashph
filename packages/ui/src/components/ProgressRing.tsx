import type { ReactNode } from "react";
import { cn } from "../cn";

export interface ProgressRingProps {
  /** 0 to 100. */
  value: number;
  size?: number;
  thickness?: number;
  /** Centre label, e.g. "12m" or "71%". */
  label?: ReactNode;
  labelSize?: number;
  /** "ink" = black arc on grey track; "inverse" = white arc for black surfaces. */
  tone?: "ink" | "inverse";
  /** Accessible description, e.g. "Bay 1, 58% done". */
  ariaLabel?: string;
  className?: string;
}

export function ProgressRing({ value, size = 46, thickness = 5, label, labelSize, tone = "ink", ariaLabel, className }: ProgressRingProps) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const track = tone === "inverse" ? "rgba(255,255,255,0.18)" : "rgba(10,10,10,0.08)";
  const arc = tone === "inverse" ? "#FFFFFF" : "#0A0A0A";
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={ariaLabel}
      className={cn("relative inline-flex flex-none items-center justify-center", tone === "inverse" ? "text-on-ink" : "text-ink", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={arc} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${((c * v) / 100).toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label != null ? (
        <b className="relative font-extrabold tracking-tight" style={{ fontSize: labelSize ?? Math.max(10, Math.round(size * 0.24)) }}>{label}</b>
      ) : null}
    </span>
  );
}
