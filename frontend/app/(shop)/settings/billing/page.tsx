"use client";

import { Button, Input } from "@river-apps/ui";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const current: PlanCardId = shop.plan === "partner" ? "partner" : (billing?.partnerOption ?? "monthly");
  const owner = shop.role === "owner";
  return (
    <>
      <p className="mt-4 text-[14px] font-medium text-muted">
        You’re on <b className="text-ink">{planLabel(shop.plan, billing?.partnerOption)}</b>
        {shop.planStatus ? ` · ${shop.planStatus}` : ""}. Partner is where every shop starts. Pro and Lifetime add every feature.
      </p>
      {msg ? <p className="mt-3 rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold" role="status">{msg}</p> : null}
      <PlanList
        current={current}
        chosen={shop.plan === "partner" ? (billing?.partnerOption ?? null) : null}
        disabled={busy || !owner}
        onPick={shop.plan === "partner" ? (id) => void selectOption(id) : undefined}
      />

      {shop.plan === "partner" && owner && billing?.partnerOption ? (
        <section className="mt-5 rounded-card border border-dashed border-grey-200 p-5">
          <b className="text-[14px]">Record a payment</b>
          <p className="mt-1 text-[13px] font-medium text-muted">
            Pay via GCash, Maya, or bank, then enter the reference. Amount due:{" "}
            <b>{pesoFromCentavos(tierFor(billing.partnerOption).centavos)} for {tierLabel(billing.partnerOption)}</b>.
            Status becomes <b>pending</b> until River Apps confirms (no live PSP charge yet).
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-[13px] font-bold">
              Method
              <select
                className="mt-1 w-full rounded-xl border border-grey-200 px-3 py-2.5 text-[16px]"
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
        </section>
      ) : null}

      {billing?.lastPayment ? (
        <p className="mt-3 text-[13px] font-medium text-muted">
          Last payment: {pesoFromCentavos(billing.lastPayment.amountCentavos)} via {billing.lastPayment.method}
          {billing.lastPayment.paymentRef ? ` · ${billing.lastPayment.paymentRef}` : ""}
          {billing.status ? ` · ${billing.status}` : ""}
        </p>
      ) : null}
    </>
  );
}

type PlanCardId = "partner" | PartnerBillingOption;

/** Partner (entry tier, never "free") first, then Pro and Lifetime with the old price struck (Barbers.ph billing list). */
const PARTNER_DETAIL = "River Mobile bookings, Scan, the queue and Moments, for 1 shop. Walk-ins: 10/day.";

function PlanList({ current, chosen, disabled, onPick }: { current: PlanCardId | null; chosen: PartnerBillingOption | null; disabled?: boolean; onPick?: (id: PartnerBillingOption) => void }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <PlanCard title="Partner" sub="Entry plan · 1 shop" detail={PARTNER_DETAIL} current={current === "partner"} />
      {PLAN_TIERS.map((t) => (
        <PlanCard
          key={t.id}
          title={t.cadence === "month" ? t.name : `${t.name} · ${t.locations}`}
          sub={t.cadence === "month" ? "per month" : "one-time"}
          detail={t.blurb}
          was={pesoFromCentavos(t.originalCentavos)}
          price={pesoFromCentavos(t.centavos)}
          current={current === t.id}
          chosen={chosen === t.id}
          disabled={disabled}
          onPick={onPick ? () => onPick(t.id) : undefined}
        />
      ))}
    </div>
  );
}

function PlanCard({ title, sub, detail, was, price, current, chosen, disabled, onPick }: {
  title: string; sub: string; detail: string; was?: string; price?: string; current?: boolean; chosen?: boolean; disabled?: boolean; onPick?: () => void;
}) {
  return (
    <article
      aria-current={current ? "true" : undefined}
      className={`rounded-card px-4 py-4 shadow-card ${current ? "bg-surface ring-2 ring-inset ring-ink" : "bg-surface"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-[16px]">{title}</b>
            {current ? <span className="inline-flex h-[22px] items-center rounded-pill bg-ink px-2 text-[11.5px] font-bold text-on-ink">You’re here</span> : null}
          </span>
          <p className="mt-0.5 text-[12.5px] font-semibold text-muted">{sub}</p>
          <p className="mt-1.5 text-[14px] font-medium text-ink-2">{detail}</p>
        </div>
        {price ? (
          <span className="flex flex-none flex-col items-end whitespace-nowrap">
            {was ? <s className="text-[13px] font-semibold text-muted" aria-label={`Was ${was}`}>{was}</s> : null}
            <b className="text-[18px] font-extrabold">{price}</b>
          </span>
        ) : null}
      </div>
      {current ? (
        <Button className="mt-3" size="sm" variant="secondary" leadingIcon={<Check size={16} />} disabled>Current plan</Button>
      ) : onPick ? (
        <Button data-auth="action" className="mt-3" size="sm" variant={chosen ? "secondary" : "primary"} leadingIcon={chosen ? <Check size={16} /> : undefined} disabled={disabled} onClick={onPick}>
          {chosen ? "Chosen · record payment below" : "Choose this plan"}
        </Button>
      ) : null}
    </article>
  );
}

function PublicTiers() {
  const router = useRouter();
  return (
    <section className="mt-6">
      <b className="text-[15px]">Plans</b>
      <p className="mt-1 text-[13px] font-medium text-muted">Every shop starts on <b>Partner</b>. Set up your shop to choose Pro or Lifetime.</p>
      <PlanList current={null} chosen={null} onPick={() => router.push("/settings/edit")} />
    </section>
  );
}
