"use client";

/** Account → bell: Activity (audit log of every action) and Notifications (shop alerts). Barbers.ph ActivityScreen. */
import { cn } from "@river-apps/ui";
import {
  Ban, Bell, CalendarCheck, CalendarPlus, CheckCircle2, CreditCard, MapPin, Package, Play, QrCode, Star, Store, Trash2, UserMinus, UserPlus, Wallet, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageBack } from "@/components/shop/page-back";
import { api } from "@/lib/api";
import { useShop } from "@/lib/shop-context";
import { useLoad } from "@/lib/use-load";

interface Log { id: string; action: string; target: string; at: string; actor: { type: string; id: string }; meta: Record<string, unknown> | null }
interface Alert { id: string; type: string; title: string; body: string; read: boolean; bookingId: string | null; createdAt: string }
interface MemberRow { uid: string; displayName?: string | null; phoneE164?: string | null; email?: string | null; role: string }

const ACTIONS: Record<string, [string, LucideIcon, string]> = {
  "queue.create": ["Added a walk-in", UserPlus, "walkin"], "queue.update": ["Updated a car in the queue", Play, "queue"], "queue.start": ["Started a car in a bay", Play, "queue"],
  "queue.done": ["Finished a car", CheckCircle2, "queue"], "queue.cancel": ["Cancelled a car", Ban, "queue"],
  "booking.create": ["New booking", CalendarPlus, "booking"], "booking.accepted": ["Accepted a booking", CalendarCheck, "booking"], "booking.declined": ["Declined a booking", Ban, "booking"], "booking.cancelled": ["Cancelled a booking", Ban, "booking"], "booking.no_show": ["Marked a no-show", Ban, "booking"], "booking.completed": ["Completed a booking", CheckCircle2, "booking"],
  "booking.verify": ["Checked in a booking", QrCode, "booking"], "booking.transition": ["Updated a booking", CalendarCheck, "booking"],
  "sale.record": ["Recorded a payment", Wallet, "payment"], "service.create": ["Added a service", Package, "service"], "service.update": ["Edited a service", Package, "service"],
  "bay.create": ["Added a bay", Store, "shop"], "bay.update": ["Edited a bay", Store, "shop"], "business.create": ["Created the shop", Store, "shop"], "business.update": ["Edited the shop", Store, "shop"],
  "business.remove": ["Removed the shop", Trash2, "shop"], "business.plan.set": ["Changed the plan", CreditCard, "plan"], "billing.select": ["Picked a plan", CreditCard, "plan"], "billing.activate": ["Plan activated", CreditCard, "plan"], "billing.payment_recorded": ["Plan payment recorded", CreditCard, "plan"],
  "invite.create": ["Invited staff", UserPlus, "staff"], "invite.accept": ["Staff joined", UserPlus, "staff"], "invite.revoke": ["Cancelled an invite", UserMinus, "staff"], "member.remove": ["Removed staff", UserMinus, "staff"],
  "feedback.save": ["Rated the app", Star, "feedback"],
};
const FILTERS: [string, string][] = [["all", "All"], ["walkin", "Walk-ins"], ["booking", "Bookings"], ["queue", "Queue"], ["payment", "Payments"], ["service", "Services"], ["shop", "Shop"], ["staff", "Staff"]];
const describe = (a: string): [string, LucideIcon, string] => ACTIONS[a] ?? [a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase()), MapPin, "other"];
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ActivityScreen() {
  const [tab, setTab] = useState<"activity" | "notifications">(useSearchParams().get("tab") === "notifications" ? "notifications" : "activity");
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-10 pt-4 lg:max-w-[760px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/account" />
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{tab === "activity" ? "Activity" : "Notifications"}</h1>
      </div>
      <div role="tablist" aria-label="Activity view" className="mt-3 grid grid-cols-2 rounded-pill bg-grey-100 p-1">
        {(["activity", "notifications"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("h-9 rounded-pill text-[13.5px] font-bold", tab === t ? "bg-surface text-ink shadow-card" : "text-muted")}>{t === "activity" ? "Activity" : "Notifications"}</button>
        ))}
      </div>
      {tab === "activity" ? <ActivityLog /> : <Notifications />}
    </div>
  );
}

function RowsSkeleton() {
  return <div role="status" aria-label="Loading" className="mt-4 flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <span key={i} className="skeleton h-[58px] rounded-[14px]" />)}</div>;
}

function ActivityLog() {
  const { shop } = useShop();
  const owner = shop?.role === "owner";
  const [filter, setFilter] = useState("all");
  const { data, error } = useLoad(async () => {
    if (!shop || !owner) return null;
    const [logs, members] = await Promise.all([
      api<{ data: Log[] }>(`/businesses/${shop.id}/audit-logs`).then((r) => r.data),
      api<{ data: MemberRow[] }>(`/businesses/${shop.id}/members`).then((r) => r.data).catch(() => [] as MemberRow[]),
    ]);
    return { logs, members };
  }, shop && owner ? `activity-${shop.id}` : "activity-none");
  if (shop && !owner) return <p className="mt-6 text-center text-[14px] font-semibold text-muted">Only the owner sees the shop activity.</p>;
  if (error && !data) return <p role="alert" className="mt-4 text-[14px] font-semibold">{error}</p>;
  if (!data) return <RowsSkeleton />;
  const who = (l: Log) => l.actor.type === "customer" ? "Customer" : l.actor.type === "api_client" ? "River Mobile" : (() => { const m = data.members.find((x) => x.uid === l.actor.id); return m?.displayName || m?.phoneE164 || m?.email || (m?.role === "owner" ? "Owner" : "Staff"); })();
  const rows = data.logs.filter((l) => filter === "all" || describe(l.action)[2] === filter);
  return (
    <>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filter">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cn("h-9 flex-none rounded-pill px-3.5 text-[13px] font-bold", filter === k ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200")}>{label}</button>
        ))}
      </div>
      {rows.length ? (
        <ul className="mt-3 overflow-hidden rounded-card bg-surface shadow-card">
          {rows.map((l) => {
            const [text, Icon] = describe(l.action);
            return (
              <li key={l.id} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <span className="mt-0.5 inline-flex size-9 flex-none items-center justify-center rounded-full bg-grey-100"><Icon size={17} strokeWidth={2} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-snug">{text}</span>
                  <small className="mt-0.5 block text-[12px] font-semibold text-muted">{who(l)} · {when(l.at)}</small>
                </span>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-8 text-center text-[14px] font-semibold text-muted">Nothing here yet.</p>}
    </>
  );
}

function Notifications() {
  const { shop } = useShop();
  const { data, error, reload } = useLoad(async () => (shop ? (await api<{ data: Alert[] }>(`/businesses/${shop.id}/alerts`)).data : null), shop ? `alerts-${shop.id}` : "alerts-none");
  if (error && !data) return <p role="alert" className="mt-4 text-[14px] font-semibold">{error}</p>;
  if (!data) return <RowsSkeleton />;
  const unread = data.filter((a) => !a.read);
  const markAll = async () => { if (!shop) return; await Promise.all(unread.map((a) => api(`/businesses/${shop.id}/alerts/${a.id}/read`, { method: "POST" }))); reload(); };
  if (!data.length) return <div className="mt-10 flex flex-col items-center text-center"><Bell size={28} className="text-subtle" aria-hidden /><p className="mt-2 text-[14px] font-semibold text-muted">No notifications yet.</p></div>;
  return (
    <>
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-[13px] font-bold text-muted">{unread.length ? `${unread.length} unread` : "All caught up"}</span>
        {unread.length ? <button type="button" onClick={() => void markAll()} className="text-[13px] font-bold underline-offset-2 hover:underline">Mark all read</button> : null}
      </div>
      <ul className="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
        {data.map((a) => (
          <li key={a.id} className="border-b border-line last:border-b-0">
            <Link href={"/queue"} onClick={() => { if (!a.read && shop) void api(`/businesses/${shop.id}/alerts/${a.id}/read`, { method: "POST" }); }} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 inline-flex size-9 flex-none items-center justify-center rounded-full bg-grey-100"><CalendarPlus size={17} strokeWidth={2} aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[14px] leading-snug", a.read ? "font-semibold" : "font-bold")}>{a.title}</span>
                <small className="mt-0.5 block text-[12.5px] font-semibold text-muted">{a.body} · {when(a.createdAt)}</small>
              </span>
              {a.read ? null : <span className="mt-2 size-2 flex-none rounded-full bg-[#D92D20]" aria-label="Unread" />}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Bell with the unread count (Account header). */
export function NotificationBell() {
  const { shop } = useShop();
  const { data } = useLoad(async () => (shop ? (await api<{ data: Alert[] }>(`/businesses/${shop.id}/alerts`)).data.filter((a) => !a.read).length : 0), shop ? `alerts-count-${shop.id}` : "alerts-count-none");
  const n = data ?? 0;
  return (
    <Link href={n ? "/settings/activity?tab=notifications" : "/settings/activity"} aria-label={n ? `Notifications, ${n} unread` : "Activity and notifications"} className="relative inline-flex size-11 items-center justify-center rounded-full bg-surface shadow-card">
      <Bell size={19} strokeWidth={1.9} aria-hidden />
      {n ? <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#D92D20] px-1 text-[11px] font-bold text-white">{n > 9 ? "9+" : n}</span> : null}
    </Link>
  );
}
