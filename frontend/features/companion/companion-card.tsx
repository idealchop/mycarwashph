"use client";

import { SparkleIcon } from "@river-apps/icons";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useShop } from "@/lib/shop-context";

/** Home: compact button to the AI Companion chat. Hidden for staff (owners only). */
export function CompanionCard({ className }: { className?: string }) {
  const { shop, signedIn } = useShop();
  if (signedIn && shop && shop.role !== "owner") return null;
  return (
    <Link
      href="/companion"
      aria-label="Open AI Companion"
      className={`flex min-h-14 items-center gap-3 rounded-card bg-surface px-3.5 py-2.5 shadow-card transition active:scale-[0.99] ${className ?? ""}`}
    >
      <span className="inline-flex size-10 flex-none items-center justify-center rounded-tile bg-grey-100"><SparkleIcon size={28} /></span>
      <b className="min-w-0 flex-1 truncate text-[15px]">AI Companion</b>
      <ChevronRight size={20} strokeWidth={1.75} className="flex-none text-subtle" />
    </Link>
  );
}
