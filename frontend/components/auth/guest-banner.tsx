"use client";

import { Button } from "@river-apps/ui";
import { useAuthGate } from "@/components/auth/auth-gate";

/** Laundry.ph GuestBrowseBanner rhythm — light strip, not a cramped dashed chip. */
export function GuestBanner({ className }: { className?: string }) {
  const { openAuth } = useAuthGate();
  return (
    <div className={`border-b border-grey-200 bg-grey-100 px-5 py-3 lg:rounded-card lg:border lg:px-5 lg:py-3.5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink">
          Browsing as guest · sample data. Sign in to save changes to your shop.
        </p>
        <Button size="sm" variant="secondary" onClick={() => openAuth()}>
          Sign up or log in
        </Button>
      </div>
    </div>
  );
}
