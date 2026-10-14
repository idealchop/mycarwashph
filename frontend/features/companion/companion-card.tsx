"use client";

import { MarkdownLite, stripMarkdown } from "@/components/markdown-lite";
import { SparkleIcon } from "@river-apps/icons";
import { ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { useLoad } from "@/lib/use-load";
import { getCompanion } from "@/lib/companion";
import { useShop } from "@/lib/shop-context";

/** Home card: latest weekly tip from the AI Companion, links to /companion. Owners only; guests see a locked state. */
export function CompanionCard({ className }: { className?: string }) {
  const { shop, signedIn } = useShop();
  const isOwner = shop?.role === "owner";
  const { data } = useLoad(async () => (shop && isOwner ? getCompanion(shop.id) : null), `companion-card-${shop?.id ?? "none"}`);
  if (signedIn && shop && !isOwner) return null;
  const tip = data?.latest?.tips[0];
  const locked = data?.latest?.lockedCount ?? 0;
  const remaining = data?.quota.remaining;
  return (
    <Link href="/companion" className={`relative block overflow-hidden rounded-card bg-ink px-4 pb-4 pt-3.5 text-on-ink ${className ?? ""}`} aria-label="Open AI Companion">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-10 flex-none items-center justify-center rounded-tile bg-white/10"><SparkleIcon size={30} /></span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px]">AI Companion</b>
          <small className="block truncate text-[12px] font-semibold text-on-ink-muted">
            {!shop ? "Sign in to ask about your shop" : data?.latest ? `Tip of the week · ${data.latest.weekId}` : "Ask about your numbers"}
          </small>
        </span>
        <ChevronRight size={20} strokeWidth={1.75} className="text-on-ink-muted" />
      </div>
      {!shop ? (
        <p className="mt-3 flex items-center gap-2 text-[13.5px] font-semibold text-on-ink-muted"><Lock size={14} /> Weekly tips from your own sales and queue, in English or Taglish.</p>
      ) : tip ? (
        <div className="mt-3 rounded-tile bg-white px-3.5 py-3 text-ink">
          <b className="block text-[14px]">{stripMarkdown(tip.title)}</b>
          <MarkdownLite className="mt-0.5 text-[13px] font-medium text-muted" text={tip.body} />
          {locked ? <p className="mt-2 text-[12px] font-bold">+{locked} more tips with Pro</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-[13.5px] font-semibold text-on-ink-muted">“Magkano kinita ko last week?” Your first weekly tips arrive Monday 7 AM.</p>
      )}
      {remaining !== null && remaining !== undefined ? (
        <p className="mt-2.5 text-[12px] font-semibold text-on-ink-muted">{remaining} of 10 free questions left this month</p>
      ) : null}
    </Link>
  );
}
