"use client";

import { Avatar, Button } from "@river-apps/ui";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/shop/page";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { signOut, useAuth } from "@/lib/auth";
import { currentShop } from "@/lib/shop";
import { useShop } from "@/lib/shop-context";

export default function AccountPage() {
  const { user } = useAuth();
  const { me, shop, reload } = useShop();
  const name = user?.displayName ?? user?.phoneNumber ?? user?.email ?? "Guest";
  return (
    <ShopPageFrame>
      <PageHeader title="Account" back="/home" />
      <div className="mt-6 flex items-center gap-4 rounded-card bg-surface p-5 shadow-raised">
        <Avatar name={name} preset="sky" size={56} />
        <div className="min-w-0">
          <b className="block truncate text-[18px]">{user ? name : "You’re browsing as a guest"}</b>
          <p className="truncate text-[13.5px] font-medium text-muted">
            {user ? [user.phoneNumber, user.email].filter(Boolean).join(" · ") || "Signed in" : "Sign in to save your shop and take bookings."}
          </p>
        </div>
      </div>

      {me && me.businesses.length > 1 ? (
        <section className="mt-6">
          <b className="text-[15px]">Your shops</b>
          <ul className="mt-2 flex flex-col gap-2">
            {me.businesses.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => { currentShop.set(b.id); reload(); }}
                  className={`flex w-full items-center justify-between rounded-card border px-4 py-3 text-left ${shop?.id === b.id ? "border-ink bg-ink text-white" : "border-grey-200 bg-surface"}`}
                >
                  <b className="text-[15px]">{b.name}</b>
                  <small className="text-[12.5px] font-semibold capitalize">{b.plan} · {b.role}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 flex flex-col gap-2.5">
        <Button variant="secondary" fullWidth href="/settings">Shop settings</Button>
        {user ? (
          <Button variant="ghost" fullWidth leadingIcon={<LogOut size={18} strokeWidth={2} />} onClick={() => void signOut()}>Sign out</Button>
        ) : (
          <Button fullWidth data-auth="action" onClick={() => reload()}>Sign up or log in</Button>
        )}
      </div>
      <p className="mt-6 text-center text-[12.5px] font-medium text-muted">
        <a href="/terms" className="underline">Terms</a> · <a href="/privacy" className="underline">Privacy</a>
      </p>
    </ShopPageFrame>
  );
}
