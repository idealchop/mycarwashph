"use client";

import { Button, EmptyState, SectionHeader } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import type { ReactNode } from "react";
import { GuestBanner } from "@/components/auth/guest-banner";
import { useAuthGate } from "@/components/auth/auth-gate";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { ShopShell } from "@/components/shop/shop-shell";

/** Shared guest preview chrome for sidebar pages. */
export function GuestPage({
  title,
  aside,
  description,
  actionLabel,
  children,
  mobileTab,
}: {
  title: string;
  aside?: string;
  description: string;
  actionLabel: string;
  children?: ReactNode;
  mobileTab?: string;
}) {
  const { requireAuth } = useAuthGate();
  return (
    <ShopShell plan="paid" newBookings={1} waiting={2} mobileTab={mobileTab ?? "home"}>
      <ShopPageFrame>
        <div className="mb-5"><GuestBanner /></div>
        <SectionHeader title={title} aside={aside ?? "Preview"} />
        <p className="mt-2 max-w-xl text-[14px] font-medium leading-relaxed text-muted">{description}</p>
        {children ?? (
          <EmptyState
            className="mt-8"
            illustration={<Icon3D name="car" size={64} />}
            title={`${title} preview`}
            description="Sample layout only. Sign in to load your shop — we never show other shops’ private data."
          />
        )}
        <Button className="mt-8" onClick={() => requireAuth(undefined, { subtitle: `Sign in to use ${title}.` })}>
          {actionLabel}
        </Button>
      </ShopPageFrame>
    </ShopShell>
  );
}
