"use client";

import { Badge, Button, Input } from "@river-apps/ui";
import { useState } from "react";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { api, type BillingPaymentMethod, type BusinessBilling, type MeResponse, type PartnerBillingOption } from "@/lib/api";
import { PLAN_TIERS, pesoFromCentavos, planLabel, tierFor, tierLabel } from "@/lib/pricing";
import { useShop } from "@/lib/shop-context";
import { useLoad } from "@/lib/use-load";

type Shop = MeResponse["businesses"][number];

export default function BillingPage() {
  return (
    <ShopPage
      title="Plan & billing"
      back="/account"
      icon="coin"
      emptyExtra={<PublicTiers />}
      empty={{ title: "Plans for every car wash", description: "Start on Partner. Go Pro for ₱499/month or Lifetime from ₱10,000 one-time. Set up your shop to choose." }}
    >
      {(s) => <Billing shop={s} />}
    </ShopPage>
  );
}

function Billing({ shop }: { shop: Shop }) {
  const { reload: reloadMe } = useShop();
  const { data, reload } = useLoad(
    () => api<{ data: { billing: BusinessBilling | null } }>(`/businesses/${shop.id}/billing`).then((r) => r.data),
    `billing-${shop.id}`,
  );
  const [payMethod, setPayMethod] = useState<BillingPaymentMethod>("gcash");
  const [payRef, setPayRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const billing = data?.billing ?? shop.billing ?? null;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(label);
      reload();
      reloadMe();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function selectOption(option: PartnerBillingOption) {
    await run(`Selected ${tierLabel(option)}.`, async () => {
      await api(`/businesses/${shop.id}/billing/select`, { method: "POST", body: { partnerOption: option } });
    });
  }

  async function confirmPay() {
    await run("Payment recorded, pending River Apps confirmation.", async () => {
      await api(`/businesses/${shop.id}/billing/confirm-payment`, {
        method: "POST",
        body: { method: payMethod, paymentRef: payRef.trim() || null },
      });
      setPayRef("");
    });
  }

  if (!data) return <LoadingBlock />;
  return (
    <>
      {msg ? <p className="mt-3 text-[14px] font-semibold" role="status">{msg}</p> : null}
            <section className="mt-6 shop-panel">
              <div className="flex items-center justify-between gap-3">
                <b className="text-[15px]">Upgrade from Partner</b>
                <Badge variant="soft">{billing?.status ?? "trial"}</Badge>
              </div>
              <p className="mt-1 text-[13px] font-medium text-muted">
                Current plan: <b>{planLabel(shop.plan, billing?.partnerOption)}</b>
                {shop.planStatus ? ` · ${shop.planStatus}` : ""}.
              </p>

              {shop.plan === "partner" ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <TierCards selected={billing?.partnerOption ?? null} disabled={busy || shop.role !== "owner"} onPick={(id) => void selectOption(id)} />
                  </div>

                  {shop.role === "owner" && billing?.partnerOption ? (
                    <div className="mt-5 rounded-card border border-dashed border-grey-200 p-5">
                      <b className="text-[14px]">Record a payment</b>
                      <p className="mt-1 text-[13px] font-medium text-muted">
                        Pay via GCash, Maya, or bank, then enter the reference. Amount due:{" "}
                        <b>
                          {pesoFromCentavos(tierFor(billing.partnerOption).centavos)} for {tierLabel(billing.partnerOption)}
                        </b>
                        . Status becomes <b>pending</b> until River Apps confirms (no live PSP charge yet).
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="text-[13px] font-bold">
                          Method
                          <select
                            className="mt-1 w-full rounded-xl border border-grey-200 px-3 py-2.5 text-[15px]"
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value as BillingPaymentMethod)}
                          >
                            <option value="gcash">GCash</option>
                            <option value="maya">Maya</option>
                            <option value="bank">Bank transfer</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <Input label="Payment reference" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Ref / receipt #" />
                        <Button className="self-end" disabled={busy} onClick={() => void confirmPay()}>
                          Confirm paid
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {billing?.lastPayment ? (
                    <p className="mt-3 text-[13px] font-medium text-muted">
                      Last payment: {pesoFromCentavos(billing.lastPayment.amountCentavos)} via {billing.lastPayment.method}
                      {billing.lastPayment.paymentRef ? ` · ${billing.lastPayment.paymentRef}` : ""}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-[14px] font-medium text-muted">
                  You’re on <b>{planLabel(shop.plan, billing?.partnerOption)}</b>: walk-ins, bays, the queue, sales and the shop QR are all on.
                </p>
              )}
            </section>

    </>
  );
}

/** Partner is the entry tier; upgrades show the original price struck through. */
function TierCards({ selected, disabled, onPick }: { selected: PartnerBillingOption | null; disabled?: boolean; onPick?: (id: PartnerBillingOption) => void }) {
  return (
    <>
      {PLAN_TIERS.map((t) => {
        const on = selected === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick?.(t.id)}
            aria-pressed={on}
            className={`rounded-card border px-5 py-5 text-left transition ${on ? "border-ink bg-ink text-white" : "border-grey-200 bg-grey-50"}`}
          >
            <b className="block text-[15px]">{t.name}</b>
            <span className={`block text-[12.5px] font-semibold ${on ? "text-white/70" : "text-muted"}`}>{t.locations}</span>
            <span className="mt-2 flex items-baseline gap-2">
              <s className={`text-[14px] font-semibold ${on ? "text-white/60" : "text-muted"}`} aria-label={`was ${pesoFromCentavos(t.originalCentavos)}`}>{pesoFromCentavos(t.originalCentavos)}</s>
              <span className="text-[22px] font-extrabold">{pesoFromCentavos(t.centavos)}</span>
            </span>
            <span className={`block text-[12.5px] font-medium ${on ? "text-white/70" : "text-muted"}`}>{t.cadence === "month" ? "per month" : "one-time"} · {t.blurb}</span>
          </button>
        );
      })}
    </>
  );
}

function PublicTiers() {
  return (
    <section className="mt-6 shop-panel">
      <b className="text-[15px]">Plans</b>
      <p className="mt-1 text-[13px] font-medium text-muted">Every shop starts on <b>Partner</b>: River Mobile bookings, Scan and the queue.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <TierCards selected={null} disabled />
      </div>
    </section>
  );
}
