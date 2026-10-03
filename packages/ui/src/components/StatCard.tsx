import type { ReactNode } from "react";
import { cn } from "../cn";
import { Card } from "./Card";

export interface StatCardProps {
  label: ReactNode;
  value?: ReactNode;
  /** Small note under the value, e.g. "of ₱7,500". */
  caption?: ReactNode;
  /** Top-right slot: a Badge ("+12% vs last week"), SegmentedControl or link. */
  trailing?: ReactNode;
  /** Visual body: BarChart, ProgressRing, etc. */
  children?: ReactNode;
  footer?: ReactNode;
  /** "label-first" = small grey label then big value (default); "title" = bold title + grey subtitle. */
  layout?: "label-first" | "title";
  className?: string;
}

/** A white card with a headline number and an optional chart or ring. */
export function StatCard({ label, value, caption, trailing, children, footer, layout = "label-first", className }: StatCardProps) {
  return (
    <Card padding="none" className={cn("flex flex-col px-4 pb-2 pt-3.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col leading-tight">
          {layout === "title" ? (
            <>
              <span className="text-[16px] font-bold">{label}</span>
              {value ? <span className="mt-0.5 text-[12.5px] font-semibold text-muted">{value}</span> : null}
            </>
          ) : (
            <>
              <span className="text-[12px] font-semibold text-muted">{label}</span>
              {value ? <span className="text-[20px] font-extrabold tracking-[-0.02em]">{value}</span> : null}
              {caption ? <span className="text-[12px] font-semibold text-muted">{caption}</span> : null}
            </>
          )}
        </div>
        {trailing}
      </div>
      {children}
      {footer ? <div className="mt-auto flex items-center justify-between gap-3 pb-2">{footer}</div> : null}
    </Card>
  );
}
