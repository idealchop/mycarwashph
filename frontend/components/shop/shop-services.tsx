"use client";

import { Button, Input } from "@river-apps/ui";
import { useState } from "react";
import { Spinner } from "@/components/screen";
import { api, type Service } from "@/lib/api";
import { pesoFromCentavos } from "@/lib/pricing";
import { useLoad } from "@/lib/use-load";

const SIZES = ["small", "medium", "large", "xl"] as const;

/**
 * Services menu. River Mobile can only book services that are listed here, so a
 * listed shop needs at least one service with "On River Mobile" checked.
 */
export function ShopServices({ businessId, canEdit }: { businessId: string; canEdit: boolean }) {
  const { data, error, reload } = useLoad(
    async () => (await api<{ data: Service[] }>(`/businesses/${businessId}/services`)).data,
    `services-${businessId}`,
  );
  const [name, setName] = useState("");
  const [mins, setMins] = useState("30");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const centavos = Math.round(Number(price) * 100);
    const pricesBySize = Object.fromEntries(SIZES.map((s) => [s, centavos]));
    void run(async () => {
      await api(`/businesses/${businessId}/services`, {
        method: "POST",
        body: { name: name.trim(), durationMins: Math.round(Number(mins)), pricesBySize, active: true, listedOnRiverMobile: true },
      });
      setName("");
      setPrice("");
    }, "Service added.");
  }

  const priceLabel = (s: Service) => {
    const values = Object.values(s.pricesBySize).filter((v): v is number => typeof v === "number");
    if (!values.length) return "No price";
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? pesoFromCentavos(min) : `${pesoFromCentavos(min)}–${pesoFromCentavos(max)}`;
  };

  const validNew = name.trim().length > 0 && Number(mins) >= 5 && Number(mins) <= 600 && Number(price) > 0;

  return (
    <section className="mt-6 shop-panel">
      <b className="text-[15px]">Services</b>
      <p className="mt-1 text-[13px] font-medium text-muted">
        What customers can book. Only services marked “On River Mobile” are bookable there.
      </p>
      {error ? <p role="alert" className="mt-3 text-[14px] font-semibold">{error}</p> : null}
      {!data && !error ? <Spinner label="Loading services" /> : null}
      {data && data.length === 0 ? <p className="mt-3 text-[14px] font-medium text-muted">No services yet.</p> : null}
      {data && data.length > 0 ? (
        <ul className="mt-3 divide-y divide-grey-200">
          {data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <b className="text-[15px]">{s.name}</b>
                <p className="text-[13px] font-medium text-muted">
                  {s.durationMins} min · {priceLabel(s)}
                  {s.active === false ? " · inactive" : ""}
                </p>
              </div>
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                <input
                  type="checkbox"
                  checked={!!s.listedOnRiverMobile}
                  disabled={!canEdit || busy}
                  onChange={(e) =>
                    void run(
                      () => api(`/businesses/${businessId}/services/${s.id}`, { method: "PATCH", body: { listedOnRiverMobile: e.target.checked } }),
                      "Service updated.",
                    )
                  }
                />
                On River Mobile
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <div className="mt-4 flex flex-col gap-3">
          <Input label="Service name" placeholder="e.g. Basic wash" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            <Input label="Minutes" value={mins} inputMode="numeric" disabled={busy} onChange={(e) => setMins(e.target.value)} />
            <Input label="Price ₱" placeholder="e.g. 250" value={price} inputMode="decimal" disabled={busy} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <Button disabled={busy || !validNew} onClick={add}>Add service</Button>
        </div>
      ) : null}
      {msg ? <p className="mt-2 text-[14px] font-semibold" role="status">{msg}</p> : null}
    </section>
  );
}
