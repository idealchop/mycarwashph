"use client";

import { Badge, Button, Input, SectionHeader } from "@river-apps/ui";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Spinner } from "@/components/screen";
import { LocationPicker } from "@/components/shop/location-picker";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { ShopShell } from "@/components/shop/shop-shell";
import {
  api,
  type BillingPaymentMethod,
  type BusinessBilling,
  type BusinessProfile,
  type Invite,
  type Member,
  type PartnerBillingOption,
  type ShopLocation,
} from "@/lib/api";
import { PARTNER_PRICING, pesoFromCentavos } from "@/lib/pricing";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const { shop, me, newBookings, waiting, reload: reloadMe } = useShopPage();
  const { data, error, reload } = useLoad(async () => {
    if (!shop) return null;
    const [members, invites, profile, billing] = await Promise.all([
      api<{ data: Member[] }>(`/businesses/${shop.id}/members`),
      shop.role === "owner"
        ? api<{ data: Invite[] }>(`/businesses/${shop.id}/members/invites`)
        : Promise.resolve({ data: [] as Invite[] }),
      api<{ data: BusinessProfile }>(`/businesses/${shop.id}`),
      api<{ data: { billing: BusinessBilling | null; pricing: unknown } }>(`/businesses/${shop.id}/billing`),
    ]);
    return {
      members: members.data,
      invites: invites.data,
      profile: profile.data,
      billing: billing.data.billing,
    };
  }, shop ? `settings-${shop.id}` : "none");

  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [location, setLocation] = useState<ShopLocation | null | undefined>(undefined);
  const [listed, setListed] = useState<boolean | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [payMethod, setPayMethod] = useState<BillingPaymentMethod>("gcash");
  const [payRef, setPayRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const profile = data?.profile;
  const nameValue = name ?? profile?.name ?? "";
  const phoneValue = phone ?? (profile?.phoneE164 ?? "").replace(/^\+63/, "");
  const addressValue = address ?? profile?.address ?? "";
  const locationValue = location === undefined ? (profile?.location ?? null) : location;
  const listedValue = listed ?? profile?.riverMobile?.listed ?? false;
  const serverTarget = profile?.settings?.dailyTargetCentavos;
  const targetValue = target ?? (serverTarget != null ? String(serverTarget / 100) : "");
  const billing = data?.billing ?? shop?.billing ?? null;

  if (!shop || !me) return <Spinner />;

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

  async function saveProfile() {
    await run("Shop profile saved.", async () => {
      const body: Record<string, unknown> = {
        name: nameValue.trim(),
        address: addressValue.trim() || null,
        location: locationValue,
        riverMobileListed: listedValue,
      };
      const digits = phoneValue.replace(/\D/g, "").replace(/^0/, "");
      body.phoneE164 = digits.length === 10 ? `+63${digits}` : null;
      await api(`/businesses/${shop!.id}`, { method: "PATCH", body });
    });
  }

  async function saveTarget() {
    await run("Daily target saved.", async () => {
      const pesos = targetValue.trim() === "" ? null : Math.round(Number(targetValue) * 100);
      await api(`/businesses/${shop!.id}`, { method: "PATCH", body: { dailyTargetCentavos: pesos } });
    });
  }

  async function invite() {
    await run("Invite created.", async () => {
      const body: { role: "staff"; phoneE164?: string; email?: string } = { role: "staff" };
      if (invitePhone.trim()) body.phoneE164 = `+63${invitePhone.replace(/\D/g, "").replace(/^0/, "")}`;
      if (inviteEmail.trim()) body.email = inviteEmail.trim();
      const res = await api<{ data: Invite }>(`/businesses/${shop!.id}/members/invites`, { method: "POST", body });
      setMsg(`Invite created. Share: /invite/${res.data.id}`);
      setInvitePhone("");
      setInviteEmail("");
    });
  }

  async function selectOption(option: PartnerBillingOption) {
    await run(`Selected ${option === "monthly" ? PARTNER_PRICING.monthlyLabel : PARTNER_PRICING.lifetimeLabel}.`, async () => {
      await api(`/businesses/${shop!.id}/billing/select`, { method: "POST", body: { partnerOption: option } });
    });
  }

  async function confirmPay() {
    await run("Payment recorded — pending River Apps confirmation.", async () => {
      await api(`/businesses/${shop!.id}/billing/confirm-payment`, {
        method: "POST",
        body: { method: payMethod, paymentRef: payRef.trim() || null },
      });
      setPayRef("");
    });
  }

  return (
    <ShopShell
      plan={shop.plan}
      newBookings={newBookings}
      waiting={waiting}
      mobileTab={shop.plan === "partner" ? "shop" : "more"}
    >
      <ShopPageFrame narrow>
        <SectionHeader title="Settings" aside={shop.name} />
        {error ? (
          <p role="alert" className="mt-3 text-[14px] font-semibold">
            {error}
          </p>
        ) : null}
        {msg ? (
          <p className="mt-2 text-[14px] font-semibold" role="status">
            {msg}
          </p>
        ) : null}
        {!data ? <Spinner label="Loading settings" /> : null}

        {data ? (
          <>
            <section className="mt-5 rounded-2xl border border-grey-200 bg-white p-4 lg:p-5">
              <b className="text-[15px]">Shop profile</b>
              <p className="mt-1 text-[13px] font-medium text-muted">
                Address and map pin help River Mobile detect your shop. Owners only can edit.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <Input label="Shop name" value={nameValue} disabled={shop.role !== "owner" || busy} onChange={(e) => setName(e.target.value)} />
                <Input
                  label="Shop phone (+63)"
                  placeholder="917…"
                  value={phoneValue}
                  disabled={shop.role !== "owner" || busy}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <LocationPicker
                  address={addressValue}
                  location={locationValue}
                  disabled={shop.role !== "owner" || busy}
                  onChange={({ address: a, location: loc }) => {
                    setAddress(a);
                    setLocation(loc);
                  }}
                />
                <label className="flex items-center gap-2 text-[14px] font-semibold">
                  <input type="checkbox" checked={listedValue} disabled={shop.role !== "owner" || busy} onChange={(e) => setListed(e.target.checked)} />
                  List on River Mobile
                </label>
                {listedValue && !locationValue ? (
                  <p className="text-[13px] font-medium text-muted">Add a map pin so customers nearby can find you.</p>
                ) : null}
                {shop.role === "owner" ? (
                  <Button disabled={busy || !nameValue.trim()} onClick={() => void saveProfile()}>
                    Save profile
                  </Button>
                ) : null}
              </div>
            </section>

            {shop.plan === "paid" && shop.role === "owner" ? (
              <section className="mt-5 rounded-2xl border border-grey-200 bg-white p-4 lg:p-5">
                <b className="text-[15px]">Daily sales target</b>
                <p className="mt-1 text-[13px] font-medium text-muted">Shown on the Paid dashboard. Amount in pesos.</p>
                <div className="mt-3 flex gap-2">
                  <Input
                    label="Target ₱"
                    hideLabel
                    placeholder="e.g. 7500"
                    value={targetValue}
                    onChange={(e) => setTarget(e.target.value)}
                    inputMode="decimal"
                  />
                  <Button disabled={busy} onClick={() => void saveTarget()}>
                    Save
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="mt-5 rounded-2xl border border-grey-200 bg-white p-4 lg:p-5">
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
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
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
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
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
                    <div className="mt-4 rounded-2xl border border-dashed border-grey-200 p-4">
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

            <section className="mt-5 rounded-2xl border border-grey-200 bg-white p-4 lg:p-5">
              <b className="text-[15px]">Team</b>
              <ul className="mt-3 flex flex-col gap-2">
                {data.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                    <span>
                      <b>{m.displayName ?? m.uid}</b> · {m.role}
                      {m.phoneE164 ? ` · ${m.phoneE164}` : ""}
                      {m.email ? ` · ${m.email}` : ""}
                    </span>
                    {shop.role === "owner" && m.role !== "owner" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run("Member removed.", async () => {
                            await api(`/businesses/${shop!.id}/members/${m.uid}`, { method: "DELETE" });
                          })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {shop.role === "owner" ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
                  <Input
                    label="Invite phone"
                    hideLabel
                    placeholder="917… (+63)"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                  />
                  <Input
                    label="Invite email"
                    hideLabel
                    placeholder="email@…"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <Button disabled={busy || (!invitePhone.trim() && !inviteEmail.trim())} onClick={() => void invite()}>
                    Invite staff
                  </Button>
                </div>
              ) : null}
              {data.invites?.length ? (
                <ul className="mt-3 flex flex-col gap-2 border-t border-grey-100 pt-3">
                  {data.invites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span>
                        Pending · {i.phoneE164 ?? i.email} · /invite/{i.id}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void run("Invite revoked.", async () => {
                            await api(`/businesses/${shop!.id}/members/invites/${i.id}`, { method: "DELETE" });
                          })
                        }
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        ) : null}
      </ShopPageFrame>
    </ShopShell>
  );
}
