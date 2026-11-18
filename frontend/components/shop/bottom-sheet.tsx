"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/** Bottom sheet (Barbers.ph BottomSheet): dim backdrop, title + subtitle, scrolling body; tall for long lists. */
export function BottomSheet({ title, subtitle, onClose, tall, children }: { title: string; subtitle?: string; onClose: () => void; tall?: boolean; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className={`relative z-[1] flex w-full max-w-[440px] flex-col rounded-t-[28px] bg-surface pb-[max(16px,env(safe-area-inset-bottom))] pt-5 text-left shadow-card sm:rounded-[28px] ${tall ? "h-[85dvh] sm:h-[640px]" : "max-h-[85dvh]"}`}>
        <div className="relative px-5 pr-14">
          <h2 id="sheet-title" className="text-[20px] font-extrabold tracking-[-0.02em]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[13px] font-semibold text-muted">{subtitle}</p> : null}
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-[-4px] inline-flex size-9 items-center justify-center rounded-full bg-grey-100"><X size={18} aria-hidden /></button>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4">{children}</div>
      </div>
    </div>
  );
}
