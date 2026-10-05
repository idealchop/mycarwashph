import { cn } from "@river-apps/ui";
import type { ReactNode } from "react";

/**
 * Shared page gutter — copied from Laundry.ph owner pages
 * (`OrderBoard`, Messages, Online, Settings):
 *   max-w-[560px] px-4 … lg:max-w-[880px] lg:px-[30px]
 *
 * Horizontal inset lives HERE (not on AppShell main), so every shop route
 * inherits the same left/right breathing room as Laundry Orders.
 */
export function ShopPageFrame({
  children,
  className,
  /** Wider main column for Paid desktop dashboard (still same px gutters). */
  wide = false,
  /** Settings / forms — same gutters, 880px cap on lg. */
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-28 pt-4 lg:px-[30px] lg:pb-10 lg:pt-6",
        wide ? "max-w-none" : narrow ? "max-w-[560px] lg:max-w-[880px]" : "max-w-[560px] lg:max-w-[880px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
