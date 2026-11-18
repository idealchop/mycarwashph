"use client";

/**
 * Public booking page behind the shop QR (Barbers.ph /book, adapted to car wash, Oct 24, 2026).
 * Greeting header, black hero with the carwash art, car size + services by category, now or later,
 * pay choice (Pay online only when ONLINE_CHECKOUT_ENABLED=1 on the API; no provider yet), summary,
 * optional name and contact. No plate numbers. The ticket is kept on the phone.
 */
import { Button, Input, cn } from "@river-apps/ui";
import { ChevronRight, MapPin, Store, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HeroArt } from "@/features/home/hero-art";
import { ServicePicker, orderTotals } from "@/features/orders/service-picker";
import { greeting, peso } from "@/lib/format";
import { brand } from "@/src/config/brand";
import { TicketScreen } from "./ticket-screen";
import { publicApi, tickets, usePublicShop, type SavedTicket } from "./use-public";

export function BookScreen() {
  const shopId = useSearchParams().get("shop")?.trim() ?? "";
  const shop = usePublicShop(shopId);
  const [saved, setSaved] = useState<SavedTicket | null>(null);
  const [view, setView] = useState<"form" | "ticket">("form");
  useEffect(() => {
    const t = window.setTimeout(() => { const s = tickets.get(shopId); if (s) { setSaved(s); setView("ticket"); } }, 0);
    return () => window.clearTimeout(t);
  }, [shopId]);

  if (!shopId) return <Message title="Booking" body="This code is missing the shop. Ask the shop for a new QR code." />;
  if (view === "ticket" && saved) return <TicketScreen shopId={shopId} shop={shop ?? null} saved={saved} onBookAnother={() => setView("form")} onForget={() => { tickets.clear(shopId); setSaved(null); setView("form"); }} />;
  if (shop === undefined) return <BookSkeleton />;
  if (!shop) return <Message title="Shop not found" body={`This code doesn’t match a shop on ${brand.productName}. Ask the shop for a new QR code.`} />;
  if (!shop.services.length) return <Message title="Not taking bookings yet" body="This shop hasn’t added its services yet. Ask at the counter." />;
  return <BookForm shopId={shopId} shop={shop} saved={saved} onTicket={(t) => { tickets.set(shopId, t); setSaved(t); setView("ticket"); }} onOpenTicket={() => setView("ticket")} />;
}

function BookForm({ shopId, shop, saved, onTicket, onOpenTicket }: { shopId: string; shop: NonNullable<ReturnType<typeof usePublicShop>>; saved: SavedTicket | null; onTicket: (t: SavedTicket) => void; onOpenTicket: () => void }) {
  const [size, setSize] = useState("medium");
  const [picked, setPicked] = useState<string[]>([]);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [pay, setPay] = useState<"shop" | "online">("shop");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { chosen, total } = orderTotals(shop.services, picked, size);

  async function send() {
    if (!picked.length) { setError("Pick at least one service."); return; }
    if (when === "later" && !at) { setError("Pick a date and time."); return; }
    setBusy(true); setError("");
    try {
      const r = await publicApi.book(shopId, {
        serviceIds: picked, vehicleSize: size, payPref: pay,
        ...(when === "later" ? { scheduledStart: new Date(at).toISOString() } : {}),
        ...(name.trim() ? { name: name.trim() } : {}), ...(contact.trim() ? { contact: contact.trim() } : {}),
      });
      onTicket({ bookingId: r.bookingId, token: r.token, qrPayload: r.checkIn.qrPayload, code: r.checkIn.code });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-8">
      <ShopHeader shop={shop} line={`${greeting()}, welcome to`} />
      <div className="px-4">
        {saved ? (
          <button type="button" onClick={onOpenTicket} className="mt-3 flex w-full items-center justify-between rounded-card bg-surface px-4 py-3 text-left shadow-card">
            <span><b className="block text-[14.5px]">Back to my ticket</b><small className="text-[12px] font-semibold text-muted">See where your car is</small></span>
            <ChevronRight size={20} aria-hidden />
          </button>
        ) : null}
        <section className="relative isolate mt-3 flex h-[132px] items-center overflow-hidden rounded-banner bg-black px-4 text-on-ink">
          <HeroArt className="w-[78%]" fade={45} />
          <i aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-black from-45% to-transparent" />
          <div className="relative z-10 min-w-0">
            <p className="text-[12px] font-medium text-on-ink-muted">Book a car wash</p>
            <h1 className="mt-1 text-[22px] font-extrabold leading-[1.1] tracking-[-0.025em]">{chosen.length ? peso(total) : "Pick your wash"}</h1>
            <p className="mt-0.5 text-[12.5px] font-medium text-on-ink-muted">{chosen.length ? chosen.map((s) => s.name).join(" + ") : "Services and prices by car size"}</p>
          </div>
        </section>

        <div className="mt-5"><ServicePicker services={shop.services} picked={picked} onPick={setPicked} size={size} onSize={setSize} /></div>

        <h3 className="mt-6 px-1 text-[13px] font-bold text-muted">When?</h3>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="When">
          {(["now", "later"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={when === v} onClick={() => setWhen(v)} className={cn("h-12 rounded-[14px] text-[14.5px] font-bold", when === v ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200")}>
              {v === "now" ? "Now (walk in)" : "Pick a time"}
            </button>
          ))}
        </div>
        {when === "later" ? <div className="mt-2"><Input label="Date and time" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div> : null}

        <h3 className="mt-5 px-1 text-[13px] font-bold text-muted">How will you pay?</h3>
        <div className={cn("mt-2 grid gap-2", shop.onlineCheckout ? "grid-cols-2" : "grid-cols-1")} role="radiogroup" aria-label="How will you pay">
          <PayChoice on={pay === "shop"} onClick={() => setPay("shop")} icon={<Store size={17} aria-hidden />} label="Pay at the shop" />
          {shop.onlineCheckout ? <PayChoice on={pay === "online"} onClick={() => setPay("online")} icon={<Wallet size={17} aria-hidden />} label="Pay online" /> : null}
        </div>
        <p className="mt-1.5 px-1 text-[12px] font-semibold text-muted">Cash, GCash or Maya at the counter when your car is done.</p>

        <h3 className="mt-5 px-1 text-[13px] font-bold text-muted">Your details (optional)</h3>
        <div className="mt-2 flex flex-col gap-2.5">
          <Input label="Name" placeholder="So the shop can call you" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <Input label="Mobile or email" placeholder="09… or you@email.com" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={80} />
        </div>

        {error ? <p role="alert" className="mt-3 text-[13px] font-semibold">{error}</p> : null}
        <Button className="mt-4" fullWidth disabled={busy || !picked.length} onClick={() => void send()}>{busy ? "Sending…" : `Send request${chosen.length ? ` · ${peso(total)}` : ""}`}</Button>
      </div>
      <PoweredBy />
    </main>
  );
}

function PayChoice({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={cn("flex h-12 items-center justify-center gap-2 rounded-[14px] text-[14.5px] font-bold", on ? "bg-ink text-on-ink" : "bg-surface ring-1 ring-grey-200")}>
      {icon} {label}
    </button>
  );
}

export function ShopHeader({ shop, line }: { shop: { name: string; address: string | null; logoUrl: string | null }; line?: string }) {
  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- shop logo from Storage */}
      <img src={shop.logoUrl || "/icons3d/carwash/128/home.webp"} alt="" width={48} height={48} className={cn("size-12 flex-none rounded-full", shop.logoUrl ? "object-cover ring-1 ring-line" : "bg-grey-50 object-contain p-1")} />
      <span className="min-w-0">
        {line ? <small className="block text-[12px] font-semibold text-muted">{line}</small> : null}
        <b className="block truncate text-[17px] font-extrabold tracking-[-0.02em]">{shop.name}</b>
        {shop.address ? <small className="flex items-center gap-1 truncate text-[12px] font-semibold text-muted"><MapPin size={12} aria-hidden />{shop.address}</small> : null}
      </span>
    </header>
  );
}

export function PoweredBy() {
  return <p className="mt-8 text-center text-[11.5px] font-semibold text-muted">Powered by <b className="text-ink">{brand.productName}</b> · River Apps</p>;
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[402px] flex-col justify-center px-6 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons3d/carwash/256/empty-queue.webp" alt="" width={112} height={112} className="size-28" />
      <h1 className="mt-4 text-[28px] font-extrabold tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 text-[15px] font-medium text-ink-2">{body}</p>
      <PoweredBy />
    </main>
  );
}

function BookSkeleton() {
  return (
    <main role="status" aria-label="Loading the shop" className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3"><span className="skeleton size-12 rounded-full" /><span className="flex-1 space-y-1.5"><span className="skeleton h-4 w-32 rounded" /><span className="skeleton h-3 w-20 rounded" /></span></div>
      <div className="space-y-3 px-4 pt-4"><span className="skeleton h-[132px] rounded-banner" /><span className="skeleton h-14 rounded-[14px]" /><span className="skeleton h-16 rounded-[16px]" /><span className="skeleton h-16 rounded-[16px]" /><span className="skeleton h-16 rounded-[16px]" /></div>
    </main>
  );
}
