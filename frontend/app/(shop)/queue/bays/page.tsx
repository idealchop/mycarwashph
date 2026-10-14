"use client";

import { Button, Input } from "@river-apps/ui";
import { useState, type FormEvent } from "react";
import { ShopContentCard } from "@/components/shop/content-card";
import { LoadingBlock, ShopPage } from "@/components/shop/page";
import { api, type Bay } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

/** Wash bays: add, rename-free toggle on/off. Paid only. */
export default function BaysPage() {
  return (
    <ShopPage
      title="Bays"
      back="/queue"
      icon="bubbles"
      empty={{ title: "Set up your shop first", description: "Add your wash bays after you save your shop." }}
    >
      {(s) =>
        s.plan === "paid" ? (
          <BayList shopId={s.id} canEdit={s.role === "owner"} />
        ) : (
          <div className="mt-6 rounded-card bg-grey-100 p-5">
            <b className="text-[15px]">Bays are on the Paid plan</b>
            <Button className="mt-3" size="sm" href="/settings/billing">See plans</Button>
          </div>
        )
      }
    </ShopPage>
  );
}

function BayList({ shopId, canEdit }: { shopId: string; canEdit: boolean }) {
  const { data, error, reload } = useLoad(() => api<{ data: Bay[] }>(`/businesses/${shopId}/bays`).then((r) => r.data), `bays-${shopId}`);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      reload();
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await api(`/businesses/${shopId}/bays`, { method: "POST", body: { name: name.trim() || `Bay ${(data?.length ?? 0) + 1}`, active: true, sortOrder: data?.length ?? 0 } });
      setName("");
    });
  }

  if (error) return <p role="alert" className="mt-4 text-[14px] font-semibold">{error}</p>;
  if (!data) return <LoadingBlock />;
  return (
    <>
      <ShopContentCard>
        {data.length === 0 ? <p className="py-4 text-[14px] font-medium text-muted">No bays yet.</p> : null}
        <ul className="divide-y divide-grey-200">
          {data.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3.5">
              <span>
                <b className="text-[15.5px]">{b.name}</b>
                <small className="ml-2 text-[12.5px] font-semibold text-muted">{b.active ? "Open" : "Closed"}</small>
              </span>
              {canEdit ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => api(`/businesses/${shopId}/bays/${b.id}`, { method: "PATCH", body: { active: !b.active } }))}>
                  {b.active ? "Close bay" : "Open bay"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </ShopContentCard>
      {canEdit ? (
        <form onSubmit={add} className="mt-4 flex gap-2">
          <Input label="Bay name" hideLabel placeholder={`Bay ${data.length + 1}`} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={busy}>Add bay</Button>
        </form>
      ) : null}
    </>
  );
}
