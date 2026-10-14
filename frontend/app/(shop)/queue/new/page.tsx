"use client";

import { Button, Input } from "@river-apps/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageBack } from "@/components/shop/page-back";
import { api, ApiError, type QueueItem } from "@/lib/api";
import { peso } from "@/lib/format";
import { useShop } from "@/lib/shop-context";
import { WalkInLimitCard } from "@/features/queue/walkin-limit-card";
import { orderTotals, ServicePicker } from "@/features/orders/service-picker";
import { useToday } from "@/lib/today";
import { publishWalkIns, useWalkInAllowance, WALKIN_LIMIT_CODE, type WalkInAllowance } from "@/lib/walkin-limit";


/** Counter walk-in: straight into a free bay when there is one (Barbers.ph WalkInScreen). Partner: 10 a day. */
export default function WalkInPage() {
  const { shop, signedIn } = useShop();
  const router = useRouter();
  const today = useToday(shop);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [size, setSize] = useState("medium");
  const [picked, setPicked] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const walk = useWalkInAllowance(shop?.id);
  const [limitHit, setLimitHit] = useState("");
  const blocked = walk.atLimit || !!limitHit;

  const active = today.services.filter((s) => s.active !== false);
  const picks = touched ? picked : active[0] ? [active[0].id] : [];
  const { total: price } = orderTotals(active, picks, size);
  const busyBays = new Set(today.jobs.filter((j) => j.status === "in_bay").map((j) => j.queue?.bayId));
  const freeBay = today.bays.find((b) => b.active && !busyBays.has(b.id)) ?? null;

  async function save() {
    if (!shop) return;
    setBusy(true);
    setNote("");
    try {
      const res = await api<{ data: QueueItem; walkIns?: WalkInAllowance }>(`/businesses/${shop.id}/queue`, {
        method: "POST",
        body: { serviceIds: picks, vehicleSize: size, customerName: name.trim() || null, notes: notes.trim() || null },
      });
      if (res.walkIns) publishWalkIns(shop.id, res.walkIns);
      if (freeBay) await api(`/businesses/${shop.id}/queue/${res.data.id}`, { method: "PATCH", body: { status: "in_bay", bayId: freeBay.id } });
      router.push("/queue");
    } catch (e) {
      if (e instanceof ApiError && e.code === WALKIN_LIMIT_CODE) setLimitHit(e.message);
      else setNote((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/queue" />
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Walk-in</h1>
      </div>
      <p className="mt-2 pl-11 text-[15px] font-medium text-ink-2">
        {freeBay ? `They go into ${freeBay.name} now and pay at the shop.` : "They join the queue now and pay at the shop."}
      </p>
      {walk.label ? <p className="mt-1 pl-11 text-[13px] font-bold" data-testid="walkin-left">{walk.label}</p> : null}
      {active.length ? (
        <div className="mt-5">
          <ServicePicker services={active} picked={picks} onPick={(ids) => { setTouched(true); setPicked(ids); }} size={size} onSize={setSize} />
        </div>
      ) : (
        <p className="mt-5 rounded-card bg-surface px-4 py-4 text-[14px] font-semibold text-muted shadow-card">
          {signedIn && shop ? "No services yet. Add them in Account → Services." : "Your services show here once your shop is set up."}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <Input label="Customer name" placeholder="Optional" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Input label="Notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
      {note ? <p className="mt-4 text-[13.5px] font-semibold">{note}</p> : null}
      {blocked ? <WalkInLimitCard message={limitHit} /> : null}
      <Button data-auth="action" className="mt-5" fullWidth disabled={busy || blocked || (!!shop && active.length > 0 && picks.length === 0)} onClick={() => void save()}>
        {busy ? "Adding…" : price ? `Add walk-in · ${peso(price)}` : "Add walk-in"}
      </Button>
    </main>
  );
}

