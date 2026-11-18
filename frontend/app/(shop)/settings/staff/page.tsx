"use client";

import { Button, Input } from "@river-apps/ui";
import { RotateCcw, Share2, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/shop/bottom-sheet";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { RiverIcon } from "@/components/river-icon";
import { ShareStaffLink } from "@/features/staff/share-invite";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type StaffLink = { id: string; name: string; token: string; createdAt: string; lastUsedAt: string | null };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" }) : null);

/** Settings › Staff (Barbers.ph barber links): one private link per staff person, no sign-in. Reset or turn off any time. */
export default function StaffPage() {
  return (
    <ShopPage title="Staff" back="/account" icon="queue" empty={{ title: "Set up your shop first", description: "Then share staff links to run the queue with you." }}>
      {(s) => (s.role === "owner" ? <Staff shopId={s.id} shopName={s.name} /> : <p className="mt-4 px-1 text-[14px] font-semibold text-muted">Only the owner can share staff links.</p>)}
    </ShopPage>
  );
}

function Staff({ shopId, shopName }: { shopId: string; shopName: string }) {
  const { data, error, reload } = useLoad(async () => (await api<{ data: StaffLink[] }>(`/businesses/${shopId}/staff-links`)).data, `staff-links-${shopId}`);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sharing, setSharing] = useState<StaffLink | null>(null);
  const [manage, setManage] = useState<StaffLink | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setMsg("Enter the staff member’s name.");
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ data: StaffLink }>(`/businesses/${shopId}/staff-links`, { method: "POST", body: { name: name.trim() } });
      setName(""); reload(); setSharing(r.data);
    } catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  }
  async function reset(l: StaffLink) {
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ data: StaffLink }>(`/businesses/${shopId}/staff-links/${l.id}/reset`, { method: "POST" });
      setManage(null); reload(); setSharing(r.data);
    } catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  }
  async function turnOff(l: StaffLink) {
    setBusy(true); setMsg(null);
    try { await api(`/businesses/${shopId}/staff-links/${l.id}`, { method: "DELETE" }); setManage(null); reload(); }
    catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <form onSubmit={add} className="mt-4 rounded-card bg-surface px-4 py-4 shadow-card">
        <div className="flex items-center gap-3">
          <RiverIcon name="queue" size={44} />
          <span className="leading-[1.3]"><b className="block text-[16px]">Share to staff</b><span className="text-[13px] font-medium text-muted">Each person gets a private link. No sign-in.</span></span>
        </div>
        <div className="mt-3"><Input label="Staff name" placeholder="e.g. Jun" maxLength={40} value={name} onChange={(e) => { setName(e.target.value); setMsg(null); }} /></div>
        <Button type="submit" className="mt-3" fullWidth disabled={!name.trim() || busy} leadingIcon={<UserPlus size={18} aria-hidden />}>{busy ? "Creating link…" : "Create staff link"}</Button>
      </form>
      {msg ? <p role="alert" className="mt-3 px-1 text-[13.5px] font-semibold text-[#C2410C]">{msg}</p> : null}
      {error && !data ? <p role="alert" className="mt-4 font-semibold">{error}</p> : null}
      {!data ? <LoadingBlock /> : (
        <>
          <p className="mt-5 px-1 text-[13px] font-bold text-muted">Staff links · {data.length}</p>
          {data.length === 0 ? (
            <p className="mt-2 rounded-card bg-grey-50 px-4 py-4 text-center text-[13.5px] font-medium text-muted ring-1 ring-line">No staff links yet. Add a name above to share one.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
              {data.map((l) => (
                <li key={l.id} className="flex items-center gap-2 px-4 py-3">
                  <button type="button" onClick={() => setManage(l)} className="min-w-0 flex-1 text-left leading-[1.3]">
                    <b className="block truncate text-[15px]">{l.name}</b>
                    <span className="text-[12.5px] font-semibold text-muted">Staff · {l.lastUsedAt ? `opened ${when(l.lastUsedAt)}` : "not opened yet"}</span>
                  </button>
                  <button type="button" onClick={() => setSharing(l)} className="inline-flex h-9 items-center gap-1 rounded-pill bg-ink px-3.5 text-[13px] font-bold text-on-ink"><Share2 size={14} aria-hidden /> Share</button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 px-1 text-[12.5px] font-medium text-muted">Staff can take walk-ins and run the queue. They can’t see sales totals, settings or billing. Tap a name to reset or turn off its link.</p>
        </>
      )}
      {sharing ? (
        <BottomSheet title="Share to staff" subtitle={sharing.name} onClose={() => setSharing(null)}>
          <div className="pb-2"><ShareStaffLink token={sharing.token} shopName={shopName} name={sharing.name} /></div>
        </BottomSheet>
      ) : null}
      {manage ? (
        <BottomSheet title={manage.name} subtitle="Staff link" onClose={() => setManage(null)}>
          <div className="flex flex-col gap-2.5 pb-2">
            <Button variant="secondary" fullWidth disabled={busy} leadingIcon={<RotateCcw size={16} aria-hidden />} onClick={() => void reset(manage)}>Reset link (old link stops working)</Button>
            <Button variant="secondary" fullWidth disabled={busy} onClick={() => void turnOff(manage)}>Turn off link</Button>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
