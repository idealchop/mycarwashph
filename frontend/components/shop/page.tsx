"use client";

import { Button, EmptyState } from "@river-apps/ui";
import { Icon3D, type IconName } from "@river-apps/icons";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { useShop } from "@/lib/shop-context";

/** Page title row with an optional back link and right-side actions. */
export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {back ? (
          <Link href={back} aria-label="Back" className="-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-grey-100">
            <ChevronLeft size={22} strokeWidth={1.75} />
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[14px] font-semibold text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function LoadingBlock() {
  return (
    <div role="status" className="flex justify-center py-16">
      <span className="size-7 animate-spin rounded-full border-[3px] border-grey-200 border-t-ink" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Shown to guests and to signed-in users who have not saved a shop yet. */
export function SetUpShop({ icon = "car", title, description }: { icon?: IconName; title: string; description: string }) {
  return (
    <EmptyState
      className="mt-8"
      illustration={<Icon3D name={icon} size={64} />}
      title={title}
      description={description}
      action={<Button href="/settings/edit" data-auth="action">Set up your shop</Button>}
    />
  );
}

/**
 * Standard shop page: header, then either the shop content or a set-up prompt.
 * Guests see the page with no data (never sample data).
 */
export function ShopPage({
  title,
  subtitle,
  back,
  actions,
  icon,
  empty,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
  icon?: IconName;
  /** Copy for the set-up prompt when there is no shop yet. */
  empty: { title: string; description: string };
  children: (shop: NonNullable<ReturnType<typeof useShop>["shop"]>) => ReactNode;
}) {
  const { loading, shop, error, reload } = useShop();
  return (
    <ShopPageFrame>
      <PageHeader title={title} subtitle={subtitle} back={back} actions={actions} />
      {error ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p role="alert" className="text-[14px] font-semibold">We couldn’t load your shop: {error}</p>
          <Button size="sm" variant="secondary" onClick={() => reload()}>Try again</Button>
        </div>
      ) : loading ? (
        <LoadingBlock />
      ) : shop ? (
        children(shop)
      ) : (
        <SetUpShop icon={icon} title={empty.title} description={empty.description} />
      )}
    </ShopPageFrame>
  );
}
