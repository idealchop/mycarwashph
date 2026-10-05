"use client";

import { Button } from "@river-apps/ui";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Screen, Spinner } from "@/components/screen";
import { api } from "@/lib/api";
import { currentShop } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";

export default function InviteAcceptPage() {
  return <RequireAuth><Inner /></RequireAuth>;
}

function Inner() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const router = useRouter();
  const { data, error } = useLoad(
    () => api<{ data: { shopName: string; role: string; phoneE164: string | null; email: string | null } }>(`/invites/${inviteId}`),
    inviteId,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    setBusy(true); setErr(null);
    try {
      const res = await api<{ data: { businessId: string } }>(`/invites/${inviteId}/accept`, { method: "POST" });
      currentShop.set(res.data.businessId);
      router.replace("/home");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (error) {
    return <Screen><div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><h1 className="text-[22px] font-extrabold">Invite not found</h1><p className="text-muted">{error}</p><Button href="/home">Home</Button></div></Screen>;
  }
  if (!data) return <Spinner />;

  return (
    <Screen>
      <div className="flex flex-1 flex-col px-6 pt-10">
        <h1 className="text-[27px] font-extrabold">Join {data.data.shopName}</h1>
        <p className="mt-2 text-[15px] font-medium text-muted">You were invited as <b>{data.data.role}</b>. Sign-in must match {data.data.phoneE164 ?? data.data.email}.</p>
        {err ? <p role="alert" className="mt-3 font-semibold">{err}</p> : null}
        <div className="mt-auto pb-10">
          <Button fullWidth disabled={busy} onClick={accept}>{busy ? "Joining…" : "Accept invite"}</Button>
        </div>
      </div>
    </Screen>
  );
}
