"use client";

import { Button, Card } from "@river-apps/ui";
import { Printer } from "lucide-react";
import { RiverIcon } from "@/components/brand";
import { ShopPage } from "@/components/shop/page";
import { QrCode } from "@/components/shop/qr-code";

/** Shop QR for the counter (Paid). Customers scan it to find the shop in River Mobile. */
export default function QrPage() {
  return (
    <ShopPage
      title="Shop QR code"
      back="/home"
      icon="check"
      empty={{ title: "Set up your shop first", description: "Your shop QR is ready once your shop is saved." }}
    >
      {(s) =>
        s.plan === "paid" ? (
          <div className="mt-6 flex flex-col items-center">
            <Card className="flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center print:shadow-none">
              <RiverIcon size={44} />
              <b className="text-[20px] font-extrabold">{s.name}</b>
              <QrCode value={`MCWSHOP1.${s.id}`} size={240} label={`QR code for ${s.name}`} />
              <p className="text-[13.5px] font-medium text-muted">Scan with River Mobile to book this car wash.</p>
            </Card>
            <Button className="mt-5 print:hidden" variant="secondary" leadingIcon={<Printer size={18} strokeWidth={2} />} onClick={() => window.print()}>Print</Button>
          </div>
        ) : (
          <div className="mt-6 rounded-card bg-grey-100 p-5">
            <b className="text-[15px]">The shop QR is on the Paid plan</b>
            <Button className="mt-3" size="sm" href="/settings/billing">See plans</Button>
          </div>
        )
      }
    </ShopPage>
  );
}
