"use client";

import { Button, PhoneInput } from "@river-apps/ui";
import { Share2, UserPlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/shop/bottom-sheet";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { RiverIcon } from "@/components/river-icon";
import { ShareInvite } from "@/features/staff/share-invite";
import { api, type Invite, type Member } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/use-load";

const fmt = (e164: string | null) => (e164 ? e164.replace(/^\+63(\d{3})(\d{3})(\d{4})$/, "0$1 $2 $3") : null);

/** Settings › Staff: invite by mobile number and share the join link (share sheet, copy, QR). */
export default function StaffPage() {
  return (
    <ShopPage title="Staff" back="/account" icon="queue" empty={{ title: "Set up your shop first", description: "Then invite staff to run the queue with you." }}>
      {(s) => <Staff shopId={s.id} shopName={s.name} isOwner={s.role === "owner"} />}
    </ShopPage>
  );
}

function Staff({ shopId, shopName, isOwner }: { shopId: string; shopName: string; isOwner: boolean }) {
  const { user } = useAuth();
  const { data, error, reload } = useLoad(async () => {
    const [members, invites] = await Promise.all([
      api<{ data: Member[] }>(`/businesses/${shopId}/members`).then((r) => r.data),
      isOwner ? api<{ data: Invite[] }>(`/businesses/${shopId}/members/invites`).then((r) => r.data) : Promise.resolve([] as Invite[]),
    ]);
    return { members: members.filter((m) => m.status === "active"), invites };
  }, `staff-${shopId}`);
  const [formatted, setFormatted] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sharing, setSharing] = useState<Invite | null>(null);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!e164) return setMsg("Enter a 10-digit mobile number, e.g. 917 123 4567.");
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ data: Invite }>(`/businesses/${shopId}/members/invites`, { method: "POST", body: { phoneE164: e164, role: "staff" } });
      setFormatted(""); setE164(null); reload(); setSharing(r.data);
    } catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  }
  async function act(path: string) {
    setBusy(true); setMsg(null);
    try { await api(path, { method: "DELETE" }); reload(); } catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      {isOwner ? (
        <form onSubmit={invite} className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
          <div className="flex items-center gap-3">
            <RiverIcon name="queue" size={44} />
            <span className="leading-[1.3]"><b className="block text-[16px]">Share to staff</b><span className="text-[13px] font-medium text-muted">Invite by mobile number, then send them the link.</span></span>
          </div>
          <div className="mt-3"><PhoneInput label="Staff mobile number" value={formatted} onChange={(f, v) => { setFormatted(f); setE164(v); setMsg(null); }} /></div>
          <Button type="submit" className="mt-3" fullWidth disabled={!e164 || busy} leadingIcon={<UserPlus size={18} aria-hidden />}>{busy ? "Creating link…" : "Create invite link"}</Button>
        </form>
      ) : null}
      {msg ? <p role="alert" className="mt-3 px-1 text-[13.5px] font-semibold text-[#C2410C]">{msg}</p> : null}
      {error && !data ? <p role="alert" className="mt-4 font-semibold">{error}</p> : null}
      {!data ? <LoadingBlock /> : (
        <>
          {isOwner ? (
            <>
              <p className="mt-5 px-1 text-[13px] font-bold text-muted">Waiting to join · {data.invites.length}</p>
              {data.invites.length === 0 ? (
                <p className="mt-2 rounded-card bg-grey-50 px-4 py-4 text-center text-[13.5px] font-medium text-muted ring-1 ring-line">No open invites. Create one above to share with staff.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
                  {data.invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 px-4 py-3">
                      <span className="min-w-0 flex-1 leading-[1.3]"><b className="block truncate text-[15px] tabular-nums">{fmt(i.phoneE164) ?? i.email}</b><span className="text-[12.5px] font-semibold text-muted">Staff · not joined yet</span></span>
                      <button type="button" onClick={() => setSharing(i)} className="inline-flex h-9 items-center gap-1 rounded-pill bg-ink px-3.5 text-[13px] font-bold text-on-ink"><Share2 size={14} aria-hidden /> Share</button>
                      <button type="button" aria-label="Cancel invite" disabled={busy} onClick={() => void act(`/businesses/${shopId}/members/invites/${i.id}`)} className="inline-flex size-9 items-center justify-center rounded-full bg-grey-100"><X size={16} aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
          <p className="mt-5 px-1 text-[13px] font-bold text-muted">Team · {data.members.length}</p>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
            {data.members.map((m) => (
              <li key={m.uid} className="flex items-center gap-2 px-4 py-3">
                <span className="min-w-0 flex-1 leading-[1.3]">
                  <b className="block truncate text-[15px]">{m.displayName || fmt(m.phoneE164) || m.email || "Staff"}{m.uid === user?.uid ? " (you)" : ""}</b>
                  <span className="text-[12.5px] font-semibold text-muted">{m.role === "owner" ? "Owner" : "Staff"}</span>
                </span>
                {isOwner && m.role !== "owner" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(`/businesses/${shopId}/members/${m.uid}`)}>Remove</Button> : null}
              </li>
            ))}
          </ul>
        </>
      )}
      {sharing ? (
        <BottomSheet title="Share to staff" subtitle={fmt(sharing.phoneE164) ?? sharing.email ?? undefined} onClose={() => setSharing(null)}>
          <div className="pb-2"><ShareInvite inviteId={sharing.id} shopName={shopName} phone={fmt(sharing.phoneE164)} /></div>
        </BottomSheet>
      ) : null}
    </>
  );
}
