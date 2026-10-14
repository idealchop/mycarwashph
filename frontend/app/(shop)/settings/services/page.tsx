"use client";

import { ShopPage } from "@/components/shop/page";
import { ShopServices } from "@/components/shop/shop-services";

export default function ServicesPage() {
  return (
    <ShopPage
      title="Services"
      back="/account"
      icon="bubbles"
      empty={{ title: "No services yet", description: "Saving your shop publishes a Basic Wash. Add more washes and prices here after." }}
    >
      {(s) => <ShopServices businessId={s.id} canEdit={s.role === "owner"} />}
    </ShopPage>
  );
}
