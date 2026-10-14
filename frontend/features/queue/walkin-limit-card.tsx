"use client";

import { Button, cn } from "@river-apps/ui";

/** Shown when a Partner shop has used today's walk-ins: server message + upgrade. */
export function WalkInLimitCard({ message, className }: { message?: string; className?: string }) {
  return (
    <div role="alert" className={cn("mt-5 rounded-card bg-grey-100 px-4 py-3.5", className)}>
      <b className="block text-[14.5px]">Today’s walk-ins are used up</b>
      <p className="mt-0.5 text-[13px] font-medium text-ink-2">
        {message || "You’ve added 10 walk-ins today, the Partner limit. Upgrade to Pro or Lifetime for unlimited walk-ins."}
      </p>
      <Button href="/settings/billing" size="sm" className="mt-3">Upgrade</Button>
    </div>
  );
}
