"use client";

import { CarIllustration } from "@river-apps/icons";
import { Button, Input } from "@river-apps/ui";
import { useState, type FormEvent } from "react";
import { MycarwashBrand } from "@/components/brand";
import { Screen } from "@/components/screen";
import { LocationPicker } from "@/components/shop/location-picker";
import { api, type ShopLocation } from "@/lib/api";
import { signOut } from "@/lib/auth";

/** First sign-in with no shop yet: create one (caller becomes owner, Partner plan). */
export function Onboarding({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<ShopLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (address.trim()) body.address = address.trim();
      if (location) body.location = location;
      const res = await api<{ data: { id: string } }>("/businesses", { method: "POST", body });
      onCreated(res.data.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen className="sm:max-w-[520px]">
      <div className="px-6 pt-3.5">
        <MycarwashBrand />
      </div>
      <div className="flex justify-center pt-4">
        <CarIllustration size={220} />
      </div>
      <form onSubmit={submit} className="flex flex-1 flex-col px-6">
        <h1 className="text-[27px] font-extrabold leading-[1.15] tracking-[-0.025em]">Set up your shop</h1>
        <p className="mt-1.5 text-[15.5px] font-medium text-muted">
          Add your address and map pin so River Mobile can find you. You can edit this later in Settings.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <Input label="Shop name" placeholder="e.g. Sample Carwash" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} autoFocus />
          <LocationPicker
            address={address}
            location={location}
            disabled={busy}
            onChange={({ address: a, location: loc }) => {
              setAddress(a);
              setLocation(loc);
            }}
          />
        </div>
        <div className="mt-auto flex flex-col gap-2.5 pb-10 pt-6">
          <Button type="submit" fullWidth disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create my shop"}
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </form>
    </Screen>
  );
}
