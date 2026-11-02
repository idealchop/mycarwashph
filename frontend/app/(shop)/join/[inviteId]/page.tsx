"use client";

import { Button } from "@river-apps/ui";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthGate } from "@/components/auth/auth-gate";
import { RiverIcon } from "@/components/river-icon";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { currentShop } from "@/lib/shop";
import { useShop } from "@/lib/shop-context";
import { useLoad } from "@/lib/use-load";

type Preview = { inviteId: string; businessId: string; shopName: string; role: string; phoneE164: string | null; email: string | null };

/** Staff invite link (/join/{inviteId}): sign in with the invited number, then join the shop. */
export default function JoinPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const { reload: reloadShops } = useShop();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { data, error } = useLoad(async () => (user ? (await api<{ data: Preview }>(`/invites/${encodeURIComponent(inviteId)}`)).data : null), `join-${inviteId}-${user?.uid ?? "guest"}`);

  async function join() {
    setBusy(true); setMsg(null);
    try {
      await api(`/invites/${encodeURIComponent(inviteId)}/accept`, { method: "POST" });
      if (data) currentShop.set(data.businessId);
      reloadShops();
      router.replace("/home");
    } catch (x) { setMsg((x as Error).message); setBusy(false); }
  }

  return (
    <main className="mx-auto flex w-full max-w-[402px] flex-col items-center px-5 pb-10 pt-12 text-center">
      <RiverIcon name="queue" size={96} className="block" />
      {!user ? (
        <>
          <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.03em]">You’re invited</h1>
          <p className="mt-2 text-[14.5px] font-medium text-muted">Sign in with the mobile number your shop invited to join their team on Mycarwash.</p>
          <Button className="mt-6" fullWidth onClick={() => requireAuth(undefined, { subtitle: "Use the number your shop invited." })}>Sign up or log in</Button>
        </>
      ) : error && !data ? (
        <>
          <h1 className="mt-5 text-[24px] font-extrabold tracking-[-0.03em]">Invite not found</h1>
          <p className="mt-2 text-[14.5px] font-medium text-muted">It may have been used or cancelled. Ask the shop owner for a new link.</p>
          <Button className="mt-6" fullWidth variant="secondary" href="/home">Go to Home</Button>
        </>
      ) : !data ? (
        <p className="mt-6 text-[14px] font-semibold text-muted">Checking your invite…</p>
      ) : (
        <>
          <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.03em]">Join {data.shopName}</h1>
          <p className="mt-2 text-[14.5px] font-medium text-muted">You’ll join as staff: take walk-ins, run the queue and record payments.</p>
          <Button className="mt-6" fullWidth disabled={busy} onClick={() => void join()}>{busy ? "Joining…" : `Join ${data.shopName}`}</Button>
          {msg ? <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[#C2410C]">{msg}</p> : null}
        </>
      )}
    </main>
  );
}
