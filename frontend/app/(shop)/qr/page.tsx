"use client";

import { hasPaidFeatures } from "@/lib/plan-gating";

import { Button, Card } from "@river-apps/ui";
import { Printer, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { RiverIcon } from "@/components/brand";
import { ShopPage } from "@/components/shop/page";
import { QrCode } from "@/components/shop/qr-code";

/** Booking link QR (Barbers.ph /book): any phone camera opens the web booking page, no app needed. */
function BookingLinkCard({ shopId, name }: { shopId: string; name: string }) {
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  if (!origin) return null;
  const url = `${origin}/book?shop=${encodeURIComponent(shopId)}`;
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: `Book ${name}`, url }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* blocked */ }
  };
  return (
    <Card className="mt-4 flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center print:break-before-page print:shadow-none">
      <b className="text-[17px] font-extrabold">Booking link</b>
      <QrCode value={url} size={200} label={`Booking link QR for ${name}`} />
      <p className="text-[13.5px] font-medium text-muted">Any phone camera opens your booking page. Customers pick services and send a request; you accept it in Queue › Online.</p>
      <p className="w-full truncate rounded-[12px] bg-grey-100 px-3 py-2 font-mono text-[12px]">{url}</p>
      <Button className="print:hidden" size="sm" variant="secondary" leadingIcon={<Share2 size={16} strokeWidth={2} />} onClick={() => void share()}>{copied ? "Link copied" : "Share link"}</Button>
    </Card>
  );
}

/** Shop QR for the counter (Paid). Customers scan it to find the shop in River Mobile. */
export default function QrPage() {
  return (
    <ShopPage
      title="Shop QR code"
      back="/home"
      icon="ticket"
      empty={{ title: "Set up your shop first", description: "Your shop QR is ready once your shop is saved." }}
    >
      {(s) =>
        hasPaidFeatures(s) ? (
          <div className="mt-6 flex flex-col items-center">
            <Card className="flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center print:shadow-none">
              <RiverIcon size={44} />
              <b className="text-[20px] font-extrabold">{s.name}</b>
              <QrCode value={`MCWSHOP1.${s.id}`} size={240} label={`QR code for ${s.name}`} />
              <p className="text-[13.5px] font-medium text-muted">Scan with River Mobile to book this car wash.</p>
            </Card>
            <BookingLinkCard shopId={s.id} name={s.name} />
            <Button className="mt-5 print:hidden" variant="secondary" leadingIcon={<Printer size={18} strokeWidth={2} />} onClick={() => window.print()}>Print</Button>
          </div>
        ) : (
          <div className="mt-6 rounded-card bg-grey-100 p-5">
            <b className="text-[15px]">The shop QR comes with Pro or Lifetime</b>
            <Button className="mt-3" size="sm" href="/settings/billing">See plans</Button>
          </div>
        )
      }
    </ShopPage>
  );
}
