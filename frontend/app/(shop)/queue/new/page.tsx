"use client";

import { Button, Input } from "@river-apps/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { api, type Service } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

const SIZES = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
  { key: "xl", label: "XL" },
] as const;

/** Walk-in: plate, service and size, then the car joins the queue. Paid only. */
export default function WalkInPage() {
  return (
    <ShopPage
      title="Add walk-in"
      back="/queue"
      icon="car"
      empty={{ title: "Set up your shop first", description: "Walk-ins join your shop’s queue once it’s saved." }}
    >
      {(s) =>
        s.plan === "paid" ? (
          <WalkInForm shopId={s.id} />
        ) : (
          <div className="mt-6 rounded-card bg-grey-100 p-5">
            <b className="text-[15px]">Walk-ins are on the Paid plan</b>
            <p className="mt-1 text-[13.5px] font-medium text-muted">Partner shops serve River Mobile bookings. Upgrade to run a full queue.</p>
            <Button className="mt-3" size="sm" href="/settings/billing">See plans</Button>
          </div>
        )
      }
    </ShopPage>
  );
}

function WalkInForm({ shopId }: { shopId: string }) {
  const router = useRouter();
  const { data: services } = useLoad(
    () => api<{ data: Service[] }>(`/businesses/${shopId}/services`).then((r) => r.data.filter((s) => s.active !== false)),
    `services-${shopId}`,
  );
  const [plate, setPlate] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [size, setSize] = useState<string>("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!services) return <LoadingBlock />;
  const chosen = serviceId ?? services[0]?.id ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/businesses/${shopId}/queue`, {
        method: "POST",
        body: { plate: plate.trim().toUpperCase() || null, serviceIds: chosen ? [chosen] : [], vehicleSize: size },
      });
      router.push("/queue");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex max-w-lg flex-col gap-5">
      <Input label="Plate number (optional)" placeholder="ABC 1234" value={plate} onChange={(e) => setPlate(e.target.value)} autoCapitalize="characters" />
      <fieldset>
        <legend className="mb-2 text-[13px] font-bold">Service</legend>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <button key={s.id} type="button" onClick={() => setServiceId(s.id)} className={`rounded-full border px-4 py-2 text-[14px] font-semibold ${chosen === s.id ? "border-ink bg-ink text-white" : "border-grey-200 bg-surface"}`}>
              {s.name}
            </button>
          ))}
          {services.length === 0 ? <p className="text-[13px] font-medium text-muted">No services yet. Add them in Settings → Services.</p> : null}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[13px] font-bold">Vehicle size</legend>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((z) => (
            <button key={z.key} type="button" onClick={() => setSize(z.key)} className={`rounded-full border px-4 py-2 text-[14px] font-semibold ${size === z.key ? "border-ink bg-ink text-white" : "border-grey-200 bg-surface"}`}>
              {z.label}
            </button>
          ))}
        </div>
      </fieldset>
      {error ? <p role="alert" className="text-[13.5px] font-semibold">{error}</p> : null}
      <Button type="submit" fullWidth disabled={busy}>{busy ? "Adding…" : "Add to queue"}</Button>
    </form>
  );
}
