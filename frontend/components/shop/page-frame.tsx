import { cn } from "@river-apps/ui";
import type { ReactNode } from "react";

/**
 * Shop content width — Laundry.ph rhythm: phone column ~560px with px-5;
 * desktop fills AppShell main with generous bottom padding.
 */
export function ShopPageFrame({
  children,
  className,
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  /** Forms/settings reading column. */
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 pb-28 pt-5 lg:px-0 lg:pb-12 lg:pt-0",
        narrow ? "max-w-[560px] lg:max-w-[880px]" : "max-w-[560px] lg:max-w-[1200px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
