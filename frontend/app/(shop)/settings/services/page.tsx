"use client";

import { ShopPage } from "@/components/shop/page";
import { ShopServices } from "@/components/shop/shop-services";

export default function ServicesPage() {
  return (
    <ShopPage
      title="Services"
      back="/account"
      icon="carwash"
      empty={{ title: "No services yet", description: "Saving your shop sets up starter services you can edit." }}
    >
      {(s) => <ShopServices businessId={s.id} canEdit={s.role === "owner"} />}
    </ShopPage>
  );
}
