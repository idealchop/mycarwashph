"use client";

import { Art } from "@/components/river-icon";
import { Avatar, Badge, Button, Card, CardHeader, Input, StatusDot } from "@river-apps/ui";
import { ArrowLeft, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Bay, type Booking, type PaymentMethod, type QueueItem, type Service } from "@/lib/api";
import { peso } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { priceFor, ServicePicker } from "./service-picker";

export type OrderRef = { kind: "queue" | "booking"; id: string };

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const METHOD: Record<string, string> = { cash: "Cash", gcash: "GCash", maya: "Maya", other: "Other" };
const SIZE: Record<string, string> = { small: "Small", medium: "Medium", large: "Large", xl: "XL" };
const QUEUE_STATUS: Record<string, string> = { queued: "Waiting", in_bay: "In bay", done: "Done", paid: "Paid", closed: "Paid", cancelled: "Cancelled" };
const BOOKING_STATUS: Record<string, string> = { requested: "New", accepted: "Accepted", declined: "Declined", cancelled: "Cancelled", no_show: "No-show", checked_in: "Checked in", completed: "Served", queued: "Waiting", in_bay: "In bay", done: "Done", paid: "Paid", closed: "Paid" };

interface Loaded { queue: QueueItem | null; booking: Booking | null; services: Service[]; bays: Bay[] }

async function load(shopId: string, ref: OrderRef): Promise<Loaded> {
  const services = api<{ data: Service[] }>(`/businesses/${shopId}/services`).then((r) => r.data);
  const bays = api<{ data: Bay[] }>(`/businesses/${shopId}/bays`).then((r) => r.data, () => [] as Bay[]);
  let queue: QueueItem | null = null;
  let booking: Booking | null = null;
  if (ref.kind === "queue") {
    queue = (await api<{ data: QueueItem }>(`/businesses/${shopId}/queue/${ref.id}`)).data;
    if (queue.bookingId) booking = (await api<{ data: Booking }>(`/businesses/${shopId}/bookings/${queue.bookingId}`).catch(() => null))?.data ?? null;
  } else {
    booking = (await api<{ data: Booking }>(`/businesses/${shopId}/bookings/${ref.id}`)).data;
    if (booking.queueItemId) queue = (await api<{ data: QueueItem }>(`/businesses/${shopId}/queue/${booking.queueItemId}`).catch(() => null))?.data ?? null;
  }
  return { queue, booking, services: await services, bays: await bays };
}

/**
 * Order details (Barbers.ph TransactionSheet, bay instead of chair): header with status, customer,
 * service lines and total, payment, timeline, notes, the next actions, and Edit for open walk-ins.
 */
export function OrderDetails({ shopId, order, onClose, onChanged }: { shopId: string; order: OrderRef; onClose: () => void; onChanged?: () => void }) {
  const { data, error, reload } = useLoad(() => load(shopId, order), `order-${shopId}-${order.kind}-${order.id}`);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNote("");
    try {
      await fn();
      reload();
      onChanged?.();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const q = data?.queue ?? null;
  const b = data?.booking ?? null;
  const services = data?.services ?? [];
  const size = q?.vehicleSize ?? b?.vehicleSize ?? "medium";
  const lines = q?.lines?.length
    ? q.lines
    : (q?.serviceIds ?? b?.serviceIds ?? []).map((id) => {
        const s = services.find((x) => x.id === id);
        return { serviceId: id, name: s?.name ?? "Service", priceCentavos: s ? priceFor(s, size) ?? 0 : 0 };
      });
  const total = q?.totalCentavos ?? lines.reduce((t, l) => t + l.priceCentavos, 0);
  const status = q ? q.status : b?.status ?? "";
  const label = (q ? QUEUE_STATUS[status] : BOOKING_STATUS[status]) ?? status;
  const paid = status === "paid" || status === "closed";
  const tone = paid || status === "done" || status === "completed" ? "idle" : status === "in_bay" ? "active" : "waiting";
  const who = (q?.customerName || b?.customerSnapshot?.name || "").trim();
  const phone = b?.customerSnapshot?.phoneE164 ?? "";
  const bay = data?.bays.find((x) => x.id === q?.bayId)?.name ?? null;
  const freeBay = data?.bays.find((x) => x.active) ?? null;
  const title = q ? `#${q.queueNumber}` : b?.reference ?? "";
  const channel = b ? (b.source === "online_link" ? "Booking link (shop QR)" : "River Mobile booking") : "Walk-in";
  const open = q && ["queued", "in_bay", "done"].includes(q.status);
  const timeline: [string, string | null | undefined][] = [
    [b ? "Booked" : "Added", b?.createdAt ?? q?.createdAt],
    ...(b ? ([["Checked in", b.checkedInAt]] as [string, string | null][]) : []),
    ["In the bay", q?.startedAt],
    ["Done", q?.doneAt ?? (status === "completed" ? b?.updatedAt : null)],
    ["Paid", q?.paidAt],
  ];
  if (status === "cancelled" || status === "declined" || status === "no_show") timeline.push([label, q?.updatedAt ?? b?.updatedAt]);
  const qPath = q ? `/businesses/${shopId}/queue/${q.id}` : "";
  const pay = (method: PaymentMethod) => act(() => api(qPath, { method: "PATCH", body: { status: "paid", sale: { method } } }));

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-canvas" role="dialog" aria-modal="true" aria-labelledby="order-title">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-3">
        <header className="flex items-center gap-3 px-1">
          <button type="button" onClick={onClose} aria-label="Back" className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-surface shadow-card"><ArrowLeft size={20} strokeWidth={2.2} /></button>
          <Art name="ticket" size={52} />
          <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
            <h1 id="order-title" className="truncate text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">{title || "Order"}</h1>
            <p className="mt-0.5 truncate text-[13.5px] font-semibold text-ink-2">{channel}{bay ? ` · ${bay}` : ""}</p>
            {data ? <StatusDot tone={tone} className="mt-1 text-[12.5px] font-semibold text-muted">{label} · updated {when(q?.updatedAt ?? b?.updatedAt ?? q?.createdAt)}</StatusDot> : null}
          </div>
        </header>

        {error ? <p role="alert" className="mt-6 font-semibold">{error}</p> : !data ? (
          <p className="mt-6 rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">Loading the order…</p>
        ) : editing && q ? (
          <EditOrder shopId={shopId} item={q} services={services} onDone={(changed) => { setEditing(false); if (changed) { reload(); onChanged?.(); } }} />
        ) : (
          <>
            <Card className="mt-4 px-4 py-3.5">
              <h2 className="mb-2.5 text-[13px] font-bold text-muted">Customer</h2>
              {!who && !phone ? <p className="text-[14px] font-semibold text-ink-2">Walk-in · no customer name</p> : (
                <div className="flex items-center gap-3">
                  <Avatar name={who || "Customer"} size={44} />
                  <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
                    <b className="truncate text-[15.5px]">{who || "Customer"}</b>
                    {phone ? <a href={`tel:${phone}`} className="text-[13.5px] font-semibold text-ink-2 underline decoration-grey-300 underline-offset-[3px]">{phone}</a> : <small className="text-[13px] font-semibold text-muted">No number</small>}
                  </span>
                  {phone ? <a href={`tel:${phone}`} className="inline-flex h-11 flex-none items-center gap-1.5 rounded-pill bg-ink px-4 text-[14px] font-bold text-on-ink"><Phone size={16} /> Call</a> : null}
                </div>
              )}
            </Card>

            <Card className="mt-4 px-4 py-3.5">
              <CardHeader title="Services" subtitle={`${SIZE[size] ?? size} car${b ? ` · ${when(b.scheduledStart)}` : ""}`} />
              <ul className="mt-3 flex flex-col gap-2" data-testid="order-lines">
                {lines.length ? lines.map((l) => (
                  <li key={l.serviceId} className="flex items-baseline justify-between gap-3 text-[14px] font-medium">
                    <span className="text-ink-2">{l.name}</span><b>{peso(l.priceCentavos)}</b>
                  </li>
                )) : <li className="text-[14px] font-medium text-muted">Car wash</li>}
              </ul>
              <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-[#E8E8EC] pt-3">
                <b className="text-[15px]">Total</b>
                <b className="text-[22px] font-extrabold tracking-[-0.03em]">{peso(total)}</b>
              </div>
            </Card>

            <Card className="mt-4 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <b className="text-[16px]">Payment</b>
                <Badge variant={paid ? "solid" : "outline"}>{paid ? `Paid · ${METHOD[q?.paymentMethod ?? "cash"] ?? "Paid"}` : "Unpaid"}</Badge>
              </div>
              {paid ? (
                <p className="mt-2 text-[14px] font-medium text-muted">Paid {peso(total)}{q?.paidAt ? ` on ${when(q.paidAt)}` : ""}. Thank you!</p>
              ) : (
                <>
                  <p className="mt-2 text-[14px] font-medium text-muted">Amount due <b className="text-ink">{peso(total)}</b>{q?.status === "done" ? "" : q ? " · record it once the wash is done" : " · pay at the shop"}</p>
                  {q?.status === "done" ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button data-auth="action" variant="secondary" size="md" disabled={busy} onClick={() => void pay("cash")}>Paid cash</Button>
                      <Button data-auth="action" variant="secondary" size="md" disabled={busy} onClick={() => void pay("gcash")}>Paid GCash</Button>
                      <Button data-auth="action" variant="secondary" size="md" disabled={busy} onClick={() => void pay("maya")}>Paid Maya</Button>
                    </div>
                  ) : null}
                </>
              )}
            </Card>

            <Card className="mt-4 px-4 py-3.5">
              <b className="text-[16px]">Timeline</b>
              <ol className="mt-3 flex flex-col">
                {timeline.map(([k, t], i) => (
                  <li key={k} className="relative flex items-start gap-3 pb-3 last:pb-0">
                    {i < timeline.length - 1 ? <i aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-0.5 bg-grey-200" /> : null}
                    <i aria-hidden className={`mt-1 block size-3 flex-none rounded-full ${t ? "bg-ink" : "border-2 border-grey-300 bg-surface"}`} />
                    <span className="flex flex-1 items-baseline justify-between gap-3 text-[14px]">
                      <b className={t ? "" : "text-muted"}>{k}</b>
                      <span className="font-semibold text-muted">{t ? when(t) : "—"}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            {q?.notes || b?.notes ? (
              <Card className="mt-4 px-4 py-3.5">
                <b className="text-[16px]">Notes</b>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-medium text-ink-2">{q?.notes || b?.notes}</p>
              </Card>
            ) : null}

            {note ? <p role="alert" className="mt-4 px-1 text-[13.5px] font-semibold">{note}</p> : null}
            <div className="mt-4 flex flex-col gap-2">
              {q?.status === "queued" ? (
                <>
                  <Button data-auth="action" fullWidth disabled={busy} onClick={() => void act(() => api(qPath, { method: "PATCH", body: { status: "in_bay", bayId: freeBay?.id ?? null } }))}>{freeBay ? `Start in ${freeBay.name}` : "Start"}</Button>
                  <Button data-auth="action" variant="secondary" fullWidth disabled={busy} onClick={() => void act(() => api(qPath, { method: "PATCH", body: { status: "cancelled" } }))}>Cancel order</Button>
                </>
              ) : null}
              {q?.status === "in_bay" ? <Button data-auth="action" fullWidth disabled={busy} onClick={() => void act(() => api(qPath, { method: "PATCH", body: { status: "done" } }))}>Done</Button> : null}
              {!q && b?.status === "requested" ? (
                <div className="flex gap-2">
                  <Button data-auth="action" variant="secondary" className="flex-1" disabled={busy} onClick={() => void act(() => api(`/businesses/${shopId}/bookings/${b.id}/decline`, { method: "POST" }))}>Decline</Button>
                  <Button data-auth="action" className="flex-1" disabled={busy} onClick={() => void act(() => api(`/businesses/${shopId}/bookings/${b.id}/accept`, { method: "POST" }))}>Accept</Button>
                </div>
              ) : null}
              {!q && b?.status === "accepted" ? <Button fullWidth href="/scan">Scan when they arrive</Button> : null}
              {!q && b?.status === "checked_in" ? <Button data-auth="action" fullWidth disabled={busy} onClick={() => void act(() => api(`/businesses/${shopId}/bookings/${b.id}/complete`, { method: "POST" }))}>Mark served</Button> : null}
              {open ? <Button data-auth="action" variant="secondary" fullWidth onClick={() => setEditing(true)}>Edit order</Button> : null}
            </div>
            <p className="mt-4 px-1 text-[12.5px] font-semibold text-muted">{q ? `Ticket ${q.id}` : b ? `Booking ${b.id}` : ""}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Edit an open walk-in: services and size (the server reprices), customer name, notes. */
function EditOrder({ shopId, item, services, onDone }: { shopId: string; item: QueueItem; services: Service[]; onDone: (changed: boolean) => void }) {
  const [picked, setPicked] = useState<string[]>(item.serviceIds);
  const [size, setSize] = useState(item.vehicleSize ?? "medium");
  const [name, setName] = useState(item.customerName ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api(`/businesses/${shopId}/queue/${item.id}`, {
        method: "PATCH",
        body: { ...(picked.length ? { serviceIds: picked } : {}), vehicleSize: size, customerName: name.trim() || null, notes: notes.trim() || null },
      });
      onDone(true);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Card className="mt-4 flex flex-col gap-4 px-4 py-4">
      <b className="text-[16px]">Edit order</b>
      <ServicePicker services={services} picked={picked} onPick={setPicked} size={size} onSize={setSize} />
      <Input label="Customer name" placeholder="Optional" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      <Input label="Notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      {error ? <p role="alert" className="text-[13.5px] font-semibold">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => onDone(false)}>Cancel</Button>
        <Button data-auth="action" className="flex-1" disabled={busy || !picked.length} onClick={() => void save()}>Save</Button>
      </div>
    </Card>
  );
}
