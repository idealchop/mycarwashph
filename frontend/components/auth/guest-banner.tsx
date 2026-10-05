"use client";

import { SampleDataTag } from "@river-apps/ui";
import { useAuthGate } from "@/components/auth/auth-gate";

/** Shown on guest preview screens — River Mobile sample/preview pattern. */
export function GuestBanner({ className }: { className?: string }) {
  const { openAuth } = useAuthGate();
  return (
    <div className={`mx-4 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-grey-200 bg-white px-3 py-2.5 lg:mx-0 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <SampleDataTag>Preview</SampleDataTag>
        <p className="text-[12.5px] font-semibold text-muted">Browsing sample data — not a real shop.</p>
      </div>
      <button type="button" className="text-[13px] font-extrabold underline underline-offset-2" onClick={() => openAuth()}>
        Sign in to use your shop
      </button>
    </div>
  );
}
