"use client";

import { Icon3D } from "@river-apps/icons";
import { Button, Input, cn } from "@river-apps/ui";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/screen";
import { api, type Service, type ServiceCategory, type ServiceIconName } from "@/lib/api";
import { pesoFromCentavos } from "@/lib/pricing";
import { CATEGORIES, categoryOf, groupByCategory, iconOf, SERVICE_ICONS } from "@/lib/service-categories";
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

  const save = (d: Draft, id?: string) => {
    const pricesBySize = Object.fromEntries(SIZES.map(([k]) => [k, d.prices[k] ? Math.round(Number(d.prices[k]) * 100) : null]));
    const body = { name: d.name.trim(), category: d.category, icon: d.icon, pricesBySize };
    return run(
      () => api(id ? `/businesses/${businessId}/services/${id}` : `/businesses/${businessId}/services`, { method: id ? "PATCH" : "POST", body: id ? body : { ...body, active: true, listedOnRiverMobile: true } }),
      id ? "Service saved." : "Service added.",
    );
  };
  const toggle = (s: Service, field: "active" | "listedOnRiverMobile", value: boolean) =>
    run(() => api(`/businesses/${businessId}/services/${s.id}`, { method: "PATCH", body: { [field]: value } }), "Service updated.");

  const priceLabel = (s: Service) => {
    const values = Object.values(s.pricesBySize).filter((v): v is number => typeof v === "number");
    if (!values.length) return "No price";
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? pesoFromCentavos(min) : `${pesoFromCentavos(min)}–${pesoFromCentavos(max)}`;
  };

  return (
    <section className="mt-6" data-testid="services-list">
      <p className="px-1 text-[13px] font-medium text-muted">
        Starter prices are yours to edit. Active services show in the walk-in picker; “On River Mobile” ones can be booked there.
      </p>
      {error ? <p role="alert" className="mt-3 text-[14px] font-semibold">{error}</p> : null}
      {!data && !error ? <Spinner label="Loading services" /> : null}
      {data && data.length === 0 ? <p className="mt-3 text-[14px] font-medium text-muted">No services yet.</p> : null}
      {data
        ? groupByCategory(data).map((g) => (
            <div key={g.id} className="mt-4 rounded-card bg-surface px-4 py-3 shadow-card">
              <h2 className="flex items-center gap-2 text-[16px] font-extrabold"><Icon3D name={g.icon} size={34} />{g.label}</h2>
              <ul className="mt-1 divide-y divide-grey-200">
                {g.services.map((s) =>
                  editing === s.id ? (
                    <li key={s.id} className="py-3"><ServiceForm initial={fromService(s)} busy={busy} onCancel={() => setEditing(null)} onSave={(d) => void save(d, s.id)} /></li>
                  ) : (
                    <li key={s.id} className="flex items-center gap-3 py-3">
                      <Icon3D name={iconOf(s)} size={40} />
                      <div className="min-w-0 flex-1">
                        <b className={cn("block truncate text-[15px]", s.active === false && "text-muted")}>{s.name}</b>
                        <p className="text-[13px] font-medium text-muted">{priceLabel(s)}{s.active === false ? " · hidden" : ""}</p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold">
                          <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.active !== false} disabled={!canEdit || busy} onChange={(e) => void toggle(s, "active", e.target.checked)} />Active</label>
                          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!s.listedOnRiverMobile} disabled={!canEdit || busy} onChange={(e) => void toggle(s, "listedOnRiverMobile", e.target.checked)} />On River Mobile</label>
                        </div>
                      </div>
                      {canEdit ? <Button size="sm" variant="secondary" aria-label={`Edit ${s.name}`} leadingIcon={<Pencil size={14} />} onClick={() => setEditing(s.id)}>Edit</Button> : null}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))
        : null}
      {canEdit ? (
        editing === "new" ? (
          <div className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card"><ServiceForm initial={blank()} busy={busy} onCancel={() => setEditing(null)} onSave={(d) => void save(d)} /></div>
        ) : (
          <Button className="mt-4" fullWidth leadingIcon={<Plus size={18} />} onClick={() => setEditing("new")}>Add service</Button>
        )
      ) : null}
      {msg ? <p className="mt-2 px-1 text-[14px] font-semibold" role="status">{msg}</p> : null}
    </section>
  );
}

function ServiceForm({ initial, busy, onSave, onCancel }: { initial: Draft; busy: boolean; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState(initial);
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
              <Icon3D name={c.icon} size={28} />{c.label}
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
                <Icon3D name={n} size={34} />
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
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" disabled={busy || !valid} onClick={() => onSave(d)}>Save</Button>
      </div>
    </div>
  );
}
