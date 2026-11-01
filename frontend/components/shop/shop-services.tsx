"use client";

import { Art } from "@/components/river-icon";
import { Button, Input, cn } from "@river-apps/ui";
import { ChevronRight, Plus } from "lucide-react";
import { BottomSheet } from "@/components/shop/bottom-sheet";
import { useState } from "react";
import { Spinner } from "@/components/screen";
import { api, type Service, type ServiceCategory, type ServiceIconName } from "@/lib/api";
import { pesoFromCentavos } from "@/lib/pricing";
import { CATEGORIES, categoryOf, groupByCategory, SERVICE_ICONS } from "@/lib/service-categories";
import { useLoad } from "@/lib/use-load";

const SIZES = [["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["xl", "XL"]] as const;

interface Draft { name: string; category: ServiceCategory; icon: ServiceIconName | null; prices: Record<string, string> }
const blank = (): Draft => ({ name: "", category: "car-wash", icon: null, prices: { small: "", medium: "", large: "", xl: "" } });
const fromService = (s: Service): Draft => ({
  name: s.name,
  category: categoryOf(s),
  icon: s.icon ?? null,
  prices: Object.fromEntries(SIZES.map(([k]) => [k, s.pricesBySize[k] ? String((s.pricesBySize[k] as number) / 100) : ""])),
});

/**
 * Services menu, grouped by category with 3D icons. What is saved here is what the walk-in picker
 * and River Mobile show (only active services; River Mobile only those marked “On River Mobile”).
 */
export function ShopServices({ businessId, canEdit }: { businessId: string; canEdit: boolean }) {
  const { data, error, reload } = useLoad(async () => (await api<{ data: Service[] }>(`/businesses/${businessId}/services`)).data, `services-${businessId}`);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      setEditing(null);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const save = (d: Draft, id: string | undefined, listed: boolean) => {
    const pricesBySize = Object.fromEntries(SIZES.map(([k]) => [k, d.prices[k] ? Math.round(Number(d.prices[k]) * 100) : null]));
    const body = { name: d.name.trim(), category: d.category, icon: d.icon, pricesBySize, listedOnRiverMobile: listed };
    return run(
      () => api(id ? `/businesses/${businessId}/services/${id}` : `/businesses/${businessId}/services`, { method: id ? "PATCH" : "POST", body: id ? body : { ...body, active: true } }),
      id ? "Service saved." : "Service added.",
    );
  };
  const toggle = (s: Service, field: "active" | "listedOnRiverMobile", value: boolean) =>
    run(() => api(`/businesses/${businessId}/services/${s.id}`, { method: "PATCH", body: { [field]: value } }), "Service updated.");

  const priceLabel = (s: Service) => {
    const values = Object.values(s.pricesBySize).filter((v): v is number => typeof v === "number");
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? pesoFromCentavos(min) : `${pesoFromCentavos(min)}–${pesoFromCentavos(max)}`;
  };

  const groups = data ? groupByCategory(data) : [];
  const current = data?.find((s) => s.id === editing) ?? null;

  return (
    <section className="mt-4" data-testid="services-list">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[13px] font-medium text-muted">Tap a service to edit it.</p>
        {canEdit ? <Button size="md" pill leadingIcon={<Plus size={16} aria-hidden />} onClick={() => setEditing("new")}>Add service</Button> : null}
      </div>
      {groups.length > 1 ? (
        <nav aria-label="Jump to category" className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {groups.map((g) => (
            <a key={g.id} href={`#cat-${g.id}`} className="flex h-9 flex-none items-center gap-1.5 rounded-pill bg-surface pl-1.5 pr-3 text-[13px] font-bold ring-1 ring-line">
              <Art name={g.icon} size={24} />{g.label}
            </a>
          ))}
        </nav>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-[14px] font-semibold">{error}</p> : null}
      {!data && !error ? <Spinner label="Loading services" /> : null}
      {data && data.length === 0 ? <p className="mt-3 text-[14px] font-medium text-muted">No services yet.</p> : null}
      {groups.map((g) => (
        <div key={g.id} id={`cat-${g.id}`} className="mt-4 scroll-mt-4 overflow-hidden rounded-card bg-surface shadow-card">
          <h2 className="flex items-center gap-2.5 px-4 pb-1 pt-3.5 text-[16px] font-extrabold">
            <Art name={g.icon} size={36} />{g.label}
            <span className="ml-auto text-[12.5px] font-semibold text-muted">{g.services.length}</span>
          </h2>
          <ul className="divide-y divide-line">
            {g.services.map((s) => {
              const on = s.active !== false;
              const price = priceLabel(s);
              return (
                <li key={s.id} className="flex items-center gap-3 pr-4">
                  <button type="button" data-testid="service-row" disabled={!canEdit} onClick={() => setEditing(s.id)} aria-label={`Edit ${s.name}`}
                    className="flex min-w-0 flex-1 items-center gap-2 py-3.5 pl-4 text-left disabled:cursor-default">
                    <span className="min-w-0 flex-1 leading-[1.3]">
                      <b className={cn("block truncate text-[15px]", !on && "text-muted")}>{s.name}</b>
                      <span className={cn("block text-[13.5px] font-semibold tabular-nums", price ? "text-muted" : "text-[#C2410C]")}>{price ?? "Set price"}</span>
                      {s.listedOnRiverMobile && on ? <span className="mt-1 inline-flex h-5 items-center rounded-pill bg-grey-100 px-2 text-[11px] font-bold text-muted">On River Mobile</span> : null}
                    </span>
                    {canEdit ? <ChevronRight size={18} className="flex-none text-subtle" aria-hidden /> : null}
                  </button>
                  <Switch label={`${s.name} active`} checked={on} disabled={!canEdit || busy} onChange={(v) => void toggle(s, "active", v)} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {msg ? <p className="mt-3 px-1 text-[14px] font-semibold" role="status">{msg}</p> : null}
      {canEdit && editing ? (
        <BottomSheet title={current ? "Edit service" : "Add service"} subtitle={current ? current.name : "Shows in the walk-in picker"} tall onClose={() => setEditing(null)}>
          <ServiceForm
            initial={current ? fromService(current) : blank()}
            listed={current ? !!current.listedOnRiverMobile : true}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={(d, listed) => void save(d, current?.id, listed)}
          />
        </BottomSheet>
      ) : null}
    </section>
  );
}

/** One clear on/off switch (Active). */
function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-7 w-12 flex-none items-center rounded-pill transition-colors disabled:opacity-50", checked ? "bg-[#0B7A3E]" : "bg-grey-200")}>
      <span className={cn("inline-block size-6 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

function ServiceForm({ initial, listed: listed0, busy, onSave, onCancel }: { initial: Draft; listed: boolean; busy: boolean; onSave: (d: Draft, listed: boolean) => void; onCancel: () => void }) {
  const [d, setD] = useState(initial);
  const [listed, setListed] = useState(listed0);
  const valid = d.name.trim().length > 0 && SIZES.some(([k]) => Number(d.prices[k]) > 0);
  const catIcon = CATEGORIES.find((c) => c.id === d.category)!.icon;
  return (
    <div className="flex flex-col gap-3">
      <Input label="Service name" placeholder="e.g. Wash & Vacuum" value={d.name} disabled={busy} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} />
      <div>
        <p className="text-[13px] font-bold">Category</p>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={d.category === c.id} onClick={() => setD({ ...d, category: c.id })}
              className={cn("flex h-12 items-center gap-2 rounded-[14px] px-2.5 text-left text-[13.5px] font-bold", d.category === c.id ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200")}>
              <Art name={c.icon} size={28} />{c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[13px] font-bold">Icon</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Icon">
          {SERVICE_ICONS.map((n) => {
            const on = (d.icon ?? catIcon) === n;
            return (
              <button key={n} type="button" role="radio" aria-checked={on} aria-label={n} onClick={() => setD({ ...d, icon: n === catIcon ? null : n })}
                className={cn("inline-flex size-12 items-center justify-center rounded-[14px]", on ? "bg-grey-100 ring-2 ring-ink" : "ring-1 ring-grey-200")}>
                <Art name={n} size={34} />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[13px] font-bold">Price per car size (₱)</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {SIZES.map(([k, label]) => (
            <Input key={k} label={label} inputMode="decimal" value={d.prices[k]} disabled={busy} onChange={(e) => setD({ ...d, prices: { ...d.prices, [k]: e.target.value } })} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-grey-50 px-3.5 py-3">
        <span className="leading-[1.3]"><b className="block text-[14px]">On River Mobile</b><span className="text-[12.5px] font-medium text-muted">Customers can book it online</span></span>
        <Switch label="On River Mobile" checked={listed} disabled={busy} onChange={setListed} />
      </div>
      <div className="flex gap-2 pb-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" disabled={busy || !valid} onClick={() => onSave(d, listed)}>Save</Button>
      </div>
    </div>
  );
}
