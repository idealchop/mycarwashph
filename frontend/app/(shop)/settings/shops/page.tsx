"use client";

import { Button, Input } from "@river-apps/ui";
import { useState } from "react";
import { PageBack } from "@/components/shop/page-back";
import { LocationPicker } from "@/components/shop/location-picker";
import { api, type ShopLocation } from "@/lib/api";
import { currentShop } from "@/lib/shop";
import { useShop } from "@/lib/shop-context";
import { DEFAULT_SERVICE } from "@/lib/default-service";

/** Shops: open one, or add another branch with its own pin, queue, bays and services. */
export default function ShopsPage() {
  const { me, shop, reload } = useShop();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState<ShopLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const shops = me?.businesses ?? [];

  async function onAdd() {
    setError("");
    if (!pin) {
      setError("Drop a pin so this shop has an address.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ data: { id: string } }>("/businesses", { method: "POST", body: { name: name.trim(), address: address.trim() || undefined, location: pin } });
      await api(`/businesses/${res.data.id}/services`, { method: "POST", body: DEFAULT_SERVICE });
      currentShop.set(res.data.id);
      setNote(`${name.trim()} is ready. Its queue, bays and services stay on this shop.`);
      setName("");
      setPin(null);
      setAddress("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <header className="mt-1 px-1">
        <div className="flex items-center gap-1">
          <PageBack fallback="/account" />
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Shops</h1>
        </div>
        <p className="mt-0.5 pl-11 text-[14px] font-semibold text-muted">{shops.length > 1 ? "Open a shop or add another branch." : "Add a branch when you run more than one shop."}</p>
      </header>
      {note ? <p className="mt-3 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{note}</p> : null}
      {error ? <p className="mt-3 text-[13.5px] font-semibold">{error}</p> : null}

      {shops.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {shops.map((b) => (
            <li key={b.id} className="rounded-card bg-surface px-3.5 py-3 shadow-card">
              <b className="block text-[16px]">{b.name}</b>
              <p className="mt-0.5 text-[13px] font-medium text-muted">{b.location?.formattedAddress || b.address || "No pin yet"}</p>
              <div className="mt-3 flex gap-2">
                {shop?.id === b.id ? (
                  <Button size="sm" variant="secondary" href="/settings/edit">Edit shop</Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => { currentShop.set(b.id); reload(); }}>Open</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-6">
        <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted">Add a shop</h2>
        <div className="mt-2 flex flex-col gap-3 rounded-card bg-surface px-3.5 py-3.5 shadow-card">
          <Input label="Shop name" placeholder="e.g. Shine Auto Spa Katipunan" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          <LocationPicker address={address} location={pin} disabled={busy} onChange={({ address: a, location: loc }) => { setAddress(a); setPin(loc); }} />
          <Button fullWidth disabled={busy || name.trim().length < 2} data-auth="action" onClick={() => void onAdd()}>{busy ? "Saving…" : "Add shop"}</Button>
        </div>
      </section>
    </div>
  );
}
