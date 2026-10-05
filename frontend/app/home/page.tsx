"use client";

import { Button } from "@river-apps/ui";
import { BrowseGate } from "@/components/browse-gate";
import { GuestHome } from "@/components/home/guest-home";
import { Onboarding } from "@/components/home/onboarding";
import { PaidHome } from "@/components/home/paid-home";
import { PartnerHome } from "@/components/home/partner-home";
import { Screen, Spinner } from "@/components/screen";
import { useAuth } from "@/lib/auth";
import { currentShop } from "@/lib/shop";
import { useMe } from "@/lib/use-me";

export default function HomePage() {
  return (
    <BrowseGate>
      <Home />
    </BrowseGate>
  );
}

function Home() {
  const { user } = useAuth();
  if (!user) return <GuestHome />;

  return <AuthenticatedHome />;
}

function AuthenticatedHome() {
  const { me, shop, error, reload } = useMe();
  if (error) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-[22px] font-extrabold">We couldn’t load your shop</h1>
          <p className="text-[15px] font-medium text-muted">{error}</p>
          <Button onClick={() => reload()}>Try again</Button>
        </div>
      </Screen>
    );
  }
  if (!me) return <Spinner label="Loading your shop" />;
  if (!shop) {
    return (
      <Onboarding
        onCreated={(id) => {
          currentShop.set(id);
          void reload();
        }}
      />
    );
  }
  return shop.plan === "paid" ? <PaidHome me={me} shop={shop} /> : <PartnerHome me={me} shop={shop} />;
}
