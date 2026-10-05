"use client";

import { Button, Input, SectionHeader } from "@river-apps/ui";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Spinner } from "@/components/screen";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type Invite, type Member } from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import { useShopPage } from "@/lib/use-shop-page";

export default function SettingsPage() {
  return <RequireAuth><Inner /></RequireAuth>;
}

function Inner() {
  const { shop, me, newBookings, waiting, reload: reloadMe } = useShopPage();
  const { data, reload } = useLoad(async () => {
    if (!shop) return null;
    const [members, invites, profile] = await Promise.all([
      api<{ data: Member[] }>(`/businesses/${shop.id}/members`),
      shop.role === "owner"
        ? api<{ data: Invite[] }>(`/businesses/${shop.id}/members/invites`)
        : Promise.resolve({ data: [] as Invite[] }),
      api<{ data: { name: string; settings?: { dailyTargetCentavos: number | null } } }>(`/businesses/${shop.id}`),
    ]);
    return { members: members.data, invites: invites.data, profile: profile.data };
  }, shop ? `settings-${shop.id}` : "none");

  const serverTarget = data?.profile.settings?.dailyTargetCentavos;
  const [target, setTarget] = useState<string | null>(null);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const targetValue = target ?? (serverTarget != null ? String(serverTarget / 100) : "");

  if (!shop || !me) return <Spinner />;

  async function saveTarget() {
    setBusy(true); setMsg(null);
    try {
      const pesos = targetValue.trim() === "" ? null : Math.round(Number(targetValue) * 100);
      await api(`/businesses/${shop!.id}`, { method: "PATCH", body: { dailyTargetCentavos: pesos } });
      setMsg("Daily target saved.");
      reload(); reloadMe();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    setBusy(true); setMsg(null);
    try {
      const body: { role: "staff"; phoneE164?: string; email?: string } = { role: "staff" };
      if (invitePhone.trim()) body.phoneE164 = `+63${invitePhone.replace(/\D/g, "").replace(/^0/, "")}`;
      if (inviteEmail.trim()) body.email = inviteEmail.trim();
      const res = await api<{ data: Invite }>(`/businesses/${shop!.id}/members/invites`, { method: "POST", body });
      setMsg(`Invite created. Share accept link: /invite/${res.data.id}`);
      setInvitePhone(""); setInviteEmail("");
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await api(`/businesses/${shop!.id}/members/invites/${id}`, { method: "DELETE" });
    reload();
  }

  async function removeMember(uid: string) {
    await api(`/businesses/${shop!.id}/members/${uid}`, { method: "DELETE" });
    reload();
  }

  return (
    <ShopShell plan={shop.plan} newBookings={newBookings} waiting={waiting} mobileTab={shop.plan === "partner" ? "shop" : "more"}>
      <ShopPageFrame narrow>
        <SectionHeader title="Settings" aside={shop.name} />
        {msg ? <p className="mt-2 text-[14px] font-semibold" role="status">{msg}</p> : null}

        {shop.plan === "paid" && shop.role === "owner" ? (
          <section className="mt-5 rounded-2xl border border-grey-200 bg-white p-4">
            <b className="text-[15px]">Daily sales target</b>
            <p className="mt-1 text-[13px] font-medium text-muted">Shown on the Paid dashboard. Amount in pesos.</p>
            <div className="mt-3 flex gap-2">
              <Input label="Target ₱" hideLabel placeholder="e.g. 7500" value={targetValue} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
              <Button disabled={busy} onClick={saveTarget}>Save</Button>
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-2xl border border-grey-200 bg-white p-4">
          <b className="text-[15px]">Team</b>
          <ul className="mt-3 flex flex-col gap-2">
            {data?.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-[14px]">
                <span><b>{m.displayName ?? m.uid}</b> · {m.role}{m.phoneE164 ? ` · ${m.phoneE164}` : ""}{m.email ? ` · ${m.email}` : ""}</span>
                {shop.role === "owner" && m.role !== "owner" ? (
                  <Button size="sm" variant="secondary" onClick={() => removeMember(m.uid)}>Remove</Button>
                ) : null}
              </li>
            ))}
          </ul>
          {shop.role === "owner" ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <Input label="Invite phone" hideLabel placeholder="917… (+63)" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} />
              <Input label="Invite email" hideLabel placeholder="email@…" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <Button disabled={busy || (!invitePhone.trim() && !inviteEmail.trim())} onClick={invite}>Invite staff</Button>
            </div>
          ) : null}
          {data?.invites?.length ? (
            <ul className="mt-3 flex flex-col gap-2 border-t border-grey-100 pt-3">
              {data.invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-[13px]">
                  <span>Pending · {i.phoneE164 ?? i.email} · /invite/{i.id}</span>
                  <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}>Revoke</Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="mt-5 rounded-2xl border border-grey-200 bg-white p-4">
          <b className="text-[15px]">Plan</b>
          <p className="mt-1 text-[14px] font-medium text-muted">Current plan: <b>{shop.plan}</b>. Prices TBD — upgrade UI will not invent amounts.</p>
        </section>
      </ShopPageFrame>
    </ShopShell>
  );
}
