import { cn } from "@river-apps/ui";
import type { ReactNode } from "react";

/**
 * Shop content width: stacked + padded on phones; fills the AppShell main
 * column on desktop (no phone-width cage). Soft max keeps ultra-wide readable.
 */
export function ShopPageFrame({
  children,
  className,
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  /** Slightly tighter reading column (forms/settings). Still expands past phone width on lg+. */
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-24 pt-4 lg:px-0 lg:pb-10 lg:pt-0",
        narrow ? "max-w-[760px] lg:max-w-[880px]" : "max-w-[720px] lg:max-w-[1280px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
