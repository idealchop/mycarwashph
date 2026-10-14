"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, Input, Topbar } from "@river-apps/ui";
import { useState, type FormEvent } from "react";
import { PageBack } from "@/components/shop/page-back";
import { api } from "@/lib/api";
import { useShop } from "@/lib/shop-context";
import { useToday } from "@/lib/today";

/** Bays for the open shop, opened from the In bay card (Barbers.ph SeatsScreen). */
export default function BaysPage() {
  const { shop } = useShop();
  const today = useToday(shop);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const holders = new Map(today.jobs.filter((j) => j.status === "in_bay" && j.queue?.bayId).map((j) => [j.queue!.bayId!, j]));
  const owner = shop?.role === "owner";
  const paid = shop?.plan === "paid";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setNote("");
    try {
      await fn();
      today.reload();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function add(e: FormEvent) {
    e.preventDefault();
    if (!shop) return;
    void run(async () => {
      await api(`/businesses/${shop.id}/bays`, { method: "POST", body: { name: name.trim() || `Bay ${today.bays.length + 1}`, active: true, sortOrder: today.bays.length } });
      setName("");
    });
  }

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/queue" />} title="In bay" subtitle={today.ready ? `${holders.size} in use` : "Loading"} />
      {shop && !paid ? (
        <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">Bays come with Pro or Lifetime.</p>
      ) : today.bays.length === 0 ? (
        <p className="mt-4 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No bays yet. Add your first bay below.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {today.bays.map((bay) => {
            const job = holders.get(bay.id);
            return (
              <li key={bay.id} className="flex items-center gap-3 rounded-card bg-surface px-3 py-3 shadow-card">
                <Icon3D name="drop" size={44} />
                <span className="min-w-0">
                  <b className="block text-[15.5px]">{bay.name}</b>
                  <small className="block text-[12.5px] font-semibold text-muted">
                    {!bay.active ? "Closed" : job ? `${job.who} · ${job.serviceName} · since ${job.slotLabel}` : "Vacant"}
                  </small>
                </span>
                <span className="ml-auto flex flex-none items-center gap-2">
                  {owner && !job ? (
                    <button type="button" data-auth="action" disabled={busy} className="text-[12px] font-bold text-muted underline" onClick={() => void run(() => api(`/businesses/${shop!.id}/bays/${bay.id}`, { method: "PATCH", body: { active: !bay.active } }))}>
                      {bay.active ? "Close" : "Open"}
                    </button>
                  ) : null}
                  <span className={`rounded-pill px-3 py-1 text-[12px] font-bold ${job ? "bg-ink text-on-ink" : "bg-grey-100 text-ink"}`}>{job ? "In use" : "Vacant"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {note ? <p className="mt-3 text-[13.5px] font-semibold">{note}</p> : null}
      {(owner && paid) || !shop ? (
        <form onSubmit={add} className="mt-5 flex items-end gap-2">
          <Input className="flex-1" label="Add a bay" placeholder={`Bay ${today.bays.length + 1}`} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" data-auth="action" disabled={busy}>Add bay</Button>
        </form>
      ) : null}
    </div>
  );
}
