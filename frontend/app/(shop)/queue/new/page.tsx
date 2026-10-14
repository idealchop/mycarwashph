"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, Input, cn } from "@river-apps/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageBack } from "@/components/shop/page-back";
import { api, ApiError, type QueueItem } from "@/lib/api";
import { peso } from "@/lib/format";
import { useShop } from "@/lib/shop-context";
import { WalkInLimitCard } from "@/features/queue/walkin-limit-card";
import { useToday } from "@/lib/today";
import { publishWalkIns, useWalkInAllowance, WALKIN_LIMIT_CODE, type WalkInAllowance } from "@/lib/walkin-limit";

const SIZES = [["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["xl", "XL"]] as const;

/** Counter walk-in: straight into a free bay when there is one (Barbers.ph WalkInScreen). Partner: 10 a day. */
export default function WalkInPage() {
  const { shop, signedIn } = useShop();
  const router = useRouter();
  const today = useToday(shop);
  const [plate, setPlate] = useState("");
  const [size, setSize] = useState("medium");
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const walk = useWalkInAllowance(shop?.id);
  const [limitHit, setLimitHit] = useState("");
  const blocked = walk.atLimit || !!limitHit;

  const active = today.services.filter((s) => s.active !== false);
  const main = active[0] ?? null;
  const extras = active.slice(1);
  const chosen = [main, ...extras.filter((t) => picked.includes(t.id))].filter(Boolean) as typeof active;
  const price = chosen.reduce((t, s) => t + (s.pricesBySize?.[size] ?? 0), 0);
  const busyBays = new Set(today.jobs.filter((j) => j.status === "in_bay").map((j) => j.queue?.bayId));
  const freeBay = today.bays.find((b) => b.active && !busyBays.has(b.id)) ?? null;

  async function save() {
    if (!shop) return;
    setBusy(true);
    setNote("");
    try {
      const res = await api<{ data: QueueItem; walkIns?: WalkInAllowance }>(`/businesses/${shop.id}/queue`, {
        method: "POST",
        body: { plate: plate.trim().toUpperCase() || null, serviceIds: chosen.map((s) => s.id), vehicleSize: size },
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
      {main ? (
        <div className="mt-5 flex items-center gap-3 rounded-[16px] bg-ink px-3 py-2.5 text-on-ink">
          <Icon3D name="bubbles" size={40} />
          <span className="min-w-0 flex-1">
            <b className="block">{main.name}</b>
            <small className="text-[12.5px] font-semibold text-on-ink/70">{main.durationMins} min</small>
          </span>
        </div>
      ) : (
        <p className="mt-5 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
          {signedIn && shop ? "No services yet. Add them in Settings → Services." : "Your services show here once your shop is set up."}
        </p>
      )}
      {extras.length ? (
        <>
          <p className="mt-4 text-[13px] font-bold">Other services</p>
          <div className="mt-2 flex flex-col gap-2">
            {extras.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((cur) => (on ? cur.filter((id) => id !== t.id) : [...cur, t.id]))}
                  className={`flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-left ${on ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200"}`}
                >
                  <Icon3D name="sparkle" size={40} />
                  <span className="min-w-0 flex-1 font-bold">{t.name}</span>
                  <span className="text-[13px] font-semibold">{t.durationMins} min</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      <p className="mt-4 text-[13px] font-bold">Vehicle size</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {SIZES.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={size === k} onClick={() => setSize(k)} className={cn("h-11 rounded-[14px] text-[14px] font-bold", size === k ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200")}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Input label="Plate number" placeholder="Optional" value={plate} onChange={(e) => setPlate(e.target.value)} autoCapitalize="characters" />
      </div>
      {note ? <p className="mt-4 text-[13.5px] font-semibold">{note}</p> : null}
      {blocked ? <WalkInLimitCard message={limitHit} /> : null}
      <Button data-auth="action" className="mt-5" fullWidth disabled={busy || blocked || (!!shop && !main)} onClick={() => void save()}>
        {busy ? "Adding…" : price ? `Add walk-in · ${peso(price)}` : "Add walk-in"}
      </Button>
    </main>
  );
}

