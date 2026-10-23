"use client";

/** Customer ticket after a booking-link request (Barbers.ph RequestStatus): steps, check-in QR, summary. Live every 5s. */
import { Button, Card, MonoText, cn } from "@river-apps/ui";
import { Check } from "lucide-react";
import { RiverIcon } from "@/components/river-icon";
import { QrCode } from "@/components/shop/qr-code";
import { peso } from "@/lib/format";
import { PoweredBy, ShopHeader } from "./book-screen";
import { useTicket, type PublicShop, type SavedTicket } from "./use-public";

const STEPS = [["sent", "Sent"], ["accepted", "Accepted"], ["in_bay", "In bay"], ["done", "Done"]] as const;
const SIZE: Record<string, string> = { small: "Small", medium: "Medium", large: "Large", xl: "XL" };
const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function TicketScreen({ shopId, shop, saved, onBookAnother, onForget }: { shopId: string; shop: PublicShop | null; saved: SavedTicket; onBookAnother: () => void; onForget: () => void }) {
  const t = useTicket(shopId, saved);
  if (t === undefined) {
    return (
      <main role="status" aria-label="Loading your ticket" className="mx-auto min-h-dvh w-full max-w-[440px] space-y-3 bg-canvas px-4 pt-6">
        <span className="skeleton h-6 w-40 rounded" /><span className="skeleton h-[150px] rounded-card" /><span className="skeleton h-24 rounded-card" />
      </main>
    );
  }
  if (!t) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas px-5 pt-10">
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">Ticket not found</h1>
        <Button className="mt-5" fullWidth onClick={onForget}>Book a car wash</Button>
      </main>
    );
  }
  const closed = t.stage === "closed";
  const idx = STEPS.findIndex(([k]) => k === t.stage);
  const head = closed ? "The shop couldn’t take this one" : t.stage === "done" ? "Your car is ready" : t.stage === "in_bay" ? "Your car is being washed" : t.stage === "accepted" ? (t.queueNumber ? `You’re #${t.queueNumber} in line` : "Accepted. See you soon") : "Request sent";
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] bg-canvas pb-8">
      {shop ? <ShopHeader shop={shop} /> : null}
      <div className="px-4">
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-muted">Your ticket</span>
          <MonoText className="text-[13px]">{t.reference}</MonoText>
        </div>
        <Card className="mt-2 px-4 py-4">
          <div className="flex items-center gap-3">
            <RiverIcon name={t.stage === "done" ? "carwash" : closed ? "empty-queue" : "ticket"} size={52} />
            <div className="min-w-0">
              <h1 className="text-[20px] font-extrabold leading-tight tracking-[-0.02em]" aria-live="polite">{head}</h1>
              <p className="mt-0.5 text-[13px] font-semibold text-muted">{when(t.scheduledStart)} · {SIZE[t.vehicleSize] ?? t.vehicleSize} car</p>
            </div>
          </div>
          {closed ? null : (
            <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Progress">
              {STEPS.map(([k, label], i) => (
                <li key={k} className="flex flex-col items-center gap-1 text-center">
                  <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-[12px] font-bold", i <= idx ? "bg-ink text-on-ink" : "bg-grey-100 text-muted")}>{i < idx || t.stage === "done" ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                  <span className={cn("text-[11.5px] font-bold", i <= idx ? "text-ink" : "text-muted")}>{label}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        {!closed && t.stage !== "done" ? (
          <Card className="mt-3 flex items-center gap-3 px-4 py-3">
            <span className="flex-none rounded-[12px] bg-white p-1 ring-1 ring-line"><QrCode value={saved.qrPayload} size={104} label={`Check-in QR ${t.reference}`} /></span>
            <span className="min-w-0">
              <b className="block text-[14.5px]">Show this at the counter</b>
              <small className="block text-[12.5px] font-semibold text-muted">The shop scans it to check you in. Code <span className="font-mono">{saved.code}</span></small>
            </span>
          </Card>
        ) : null}
        <h3 className="mt-5 px-1 text-[13px] font-bold text-muted">Summary</h3>
        <div className="mt-2 rounded-card bg-surface px-4 py-3 shadow-card">
          {t.lines.map((l) => <div key={l.name} className="mt-1 flex justify-between text-[13.5px] font-semibold first:mt-0"><span>{l.name}</span><span className="tabular-nums">{peso(l.priceCentavos)}</span></div>)}
          <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-line pt-2">
            <b className="text-[15px]">{t.paid ? "Paid" : "Pay at the shop"}</b>
            <b className="text-[22px] font-extrabold tracking-[-0.03em] tabular-nums">{peso(t.totalCentavos)}</b>
          </div>
        </div>
        <Button className="mt-5" variant="secondary" fullWidth onClick={t.stage === "done" || closed ? onForget : onBookAnother}>{t.stage === "done" || closed ? "Book again" : "Book another car"}</Button>
      </div>
      <PoweredBy />
    </main>
  );
}
