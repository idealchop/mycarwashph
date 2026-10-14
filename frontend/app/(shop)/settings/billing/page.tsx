"use client";

import { Badge, Button, Input } from "@river-apps/ui";
import { useState } from "react";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { api, type BillingPaymentMethod, type BusinessBilling, type MeResponse, type PartnerBillingOption } from "@/lib/api";
import { PARTNER_PRICING, pesoFromCentavos } from "@/lib/pricing";
import { useShop } from "@/lib/shop-context";
import { useLoad } from "@/lib/use-load";

type Shop = MeResponse["businesses"][number];

export default function BillingPage() {
  return (
    <ShopPage
      title="Billing"
      back="/settings"
      icon="coin"
      empty={{ title: "Plans for every car wash", description: `Partner: ${PARTNER_PRICING.monthlyLabel} monthly or ${PARTNER_PRICING.lifetimeLabel} one-time. Set up your shop to choose.` }}
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
    await run(`Selected ${option === "monthly" ? PARTNER_PRICING.monthlyLabel : PARTNER_PRICING.lifetimeLabel}.`, async () => {
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
                <b className="text-[15px]">Billing</b>
                <Badge variant="soft">{billing?.status ?? "trial"}</Badge>
              </div>
              <p className="mt-1 text-[13px] font-medium text-muted">
                Current plan: <b className="capitalize">{shop.plan}</b>
                {shop.planStatus ? ` · ${shop.planStatus}` : ""}.
              </p>

              {shop.plan === "partner" ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={busy || shop.role !== "owner"}
                      onClick={() => void selectOption("monthly")}
                      className={`rounded-card border px-5 py-5 text-left transition ${
                        billing?.partnerOption === "monthly" ? "border-ink bg-ink text-white" : "border-grey-200 bg-grey-50"
                      }`}
                    >
                      <b className="block text-[15px]">Monthly</b>
                      <span className="mt-1 block text-[20px] font-extrabold">{PARTNER_PRICING.monthlyLabel}</span>
                      <span className={`mt-1 block text-[12.5px] font-medium ${billing?.partnerOption === "monthly" ? "text-white/70" : "text-muted"}`}>
                        Founder Partner pricing
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy || shop.role !== "owner"}
                      onClick={() => void selectOption("lifetime")}
                      className={`rounded-card border px-5 py-5 text-left transition ${
                        billing?.partnerOption === "lifetime" ? "border-ink bg-ink text-white" : "border-grey-200 bg-grey-50"
                      }`}
                    >
                      <b className="block text-[15px]">One-time</b>
                      <span className="mt-1 block text-[20px] font-extrabold">{PARTNER_PRICING.lifetimeLabel}</span>
                      <span className={`mt-1 block text-[12.5px] font-medium ${billing?.partnerOption === "lifetime" ? "text-white/70" : "text-muted"}`}>
                        Lifetime Partner access
                      </span>
                    </button>
                  </div>

                  {shop.role === "owner" && billing?.partnerOption ? (
                    <div className="mt-5 rounded-card border border-dashed border-grey-200 p-5">
                      <b className="text-[14px]">Record a payment</b>
                      <p className="mt-1 text-[13px] font-medium text-muted">
                        Pay via GCash, Maya, or bank, then enter the reference. Amount due:{" "}
                        <b>
                          {pesoFromCentavos(
                            billing.partnerOption === "monthly"
                              ? PARTNER_PRICING.monthlyCentavos
                              : PARTNER_PRICING.lifetimeCentavos,
                          )}
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
                      <p className="mt-3 text-[12.5px] font-medium text-muted">
                        Future: Xendit / PayMongo checkout stub lives behind <code className="font-mono">checkoutProvider</code> — attach keys later;
                        never invent live charges.
                      </p>
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
                  Paid plan pricing is <b>TBD</b> — this screen will not invent amounts. Partner shops use the packages above.
                </p>
              )}
            </section>

    </>
  );
}
