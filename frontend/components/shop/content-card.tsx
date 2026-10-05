import { Card, cn } from "@river-apps/ui";
import type { ReactNode } from "react";

/** White rounded list surface — Laundry Orders: Card padding="none" className="mt-4 px-4 py-1.5" */
export function ShopContentCard({
  children,
  className,
  hidden,
}: {
  children: ReactNode;
  className?: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <Card padding="none" className={cn("mt-4 px-4 py-1.5", className)}>
      {children}
    </Card>
  );
}
