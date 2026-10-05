"use client";

import { Button, EmptyState, Input, SectionHeader } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Spinner } from "@/components/screen";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type Customer } from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function CustomersPage() {
  return <RequireAuth><Inner /></RequireAuth>;
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
    return <ShopShell newBookings={newBookings} waiting={waiting}><div className="p-6 text-center font-extrabold text-[22px]">Customers is a Paid feature</div></ShopShell>;
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
    <ShopShell newBookings={newBookings} waiting={waiting}>
      <div className="mx-auto max-w-[720px] px-4 pb-24 pt-4 lg:px-0">
        <SectionHeader title="Customers" aside={`${data?.length ?? 0}`} />
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input label="Name" hideLabel placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Mobile" hideLabel placeholder="917…" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Plate" hideLabel placeholder="Plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <Button disabled={busy || !name.trim()} onClick={add}>Add</Button>
        </div>
        {error ? <p role="alert" className="mt-3 font-semibold">{error}</p> : null}
        {data && data.length === 0 ? (
          <EmptyState className="mt-8" illustration={<Icon3D name="car" size={64} />} title="No customers yet" description="Add walk-in regulars so staff can find them quickly." />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {data?.map((c) => (
              <li key={c.id} className="rounded-2xl border border-grey-200 bg-white px-4 py-3">
                <b className="text-[15px]">{c.name}</b>
                <p className="text-[13px] font-medium text-muted">{c.phoneE164 ?? "No phone"}{c.plate ? ` · ${c.plate}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ShopShell>
  );
}
