"use client";

import { Button, EmptyState, Input, SectionHeader } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { useState } from "react";
import { BrowseGate } from "@/components/browse-gate";
import { GuestPage } from "@/components/shop/guest-page";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/screen";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type Customer } from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function CustomersPage() {
  return (
    <BrowseGate>
      <CustomersEntry />
    </BrowseGate>
  );
}

function CustomersEntry() {
  const { user } = useAuth();
  if (!user) {
    return <GuestPage title="Customers" description="Customer list is private to your shop." actionLabel="Sign in to manage customers" mobileTab="more" />;
  }
  return <Inner />;
}

function Inner() {
  const { shop, newBookings, waiting } = useShopPage();
  const { data, error, reload } = useLoad(async () => {
    if (!shop || shop.plan !== "paid") return [];
    return (await api<{ data: Customer[] }>(`/businesses/${shop.id}/customers`)).data;
  }, shop ? `customers-${shop.id}` : "none");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);

  if (!shop) return <Spinner />;
  if (shop.plan !== "paid") {
    return (
      <ShopShell plan={shop.plan} newBookings={newBookings} waiting={waiting}>
        <ShopPageFrame className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="text-[22px] font-extrabold">Customers is a Paid feature</h1>
          <p className="mt-2 text-[15px] font-medium text-muted">Available on Paid shops once plan prices are announced.</p>
        </ShopPageFrame>
      </ShopShell>
    );
  }

  async function add() {
    setBusy(true);
    try {
      await api(`/businesses/${shop!.id}/customers`, {
        method: "POST",
        body: { name, phoneE164: phone ? `+63${phone.replace(/\D/g, "").replace(/^0/, "")}` : null, plate: plate || null, vehicleSize: null },
      });
      setName(""); setPhone(""); setPlate("");
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShopShell plan={shop.plan} newBookings={newBookings} waiting={waiting}>
      <ShopPageFrame>
        <SectionHeader title="Customers" aside={`${data?.length ?? 0}`} />
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input label="Name" hideLabel placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Mobile" hideLabel placeholder="917…" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Plate" hideLabel placeholder="Plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <Button disabled={busy || !name.trim()} onClick={add}>Add</Button>
        </div>
        {error ? <p role="alert" className="mt-3 font-semibold">{error}</p> : null}
        {!data && !error ? <div className="mt-8"><Spinner label="Loading customers" /></div> : null}
        {data && data.length === 0 ? (
          <EmptyState className="mt-8" illustration={<Icon3D name="car" size={64} />} title="No customers yet" description="Add walk-in regulars so staff can find them quickly." />
        ) : (
          <ul className="mt-5 grid gap-3.5 lg:grid-cols-2">
            {data?.map((c) => (
              <li key={c.id} className="rounded-card border border-grey-200 bg-white px-5 py-4">
                <b className="text-[15px]">{c.name}</b>
                <p className="text-[13px] font-medium text-muted">{c.phoneE164 ?? "No phone"}{c.plate ? ` · ${c.plate}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </ShopPageFrame>
    </ShopShell>
  );
}
