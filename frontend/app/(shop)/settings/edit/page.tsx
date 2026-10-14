"use client";

import { Button, Input } from "@river-apps/ui";
import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { LoadingBlock, PageHeader } from "@/components/shop/page";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { LocationPicker } from "@/components/shop/location-picker";
import { ShopPhotos } from "@/components/shop/shop-photos";
import { api, type BusinessProfile, type ShopLocation } from "@/lib/api";
import { currentShop } from "@/lib/shop";
import { useShop } from "@/lib/shop-context";
import { uploadShopPhoto } from "@/lib/shop-photos";
import { useLoad } from "@/lib/use-load";
import { DEFAULT_SERVICE } from "@/lib/default-service";


/**
 * Edit shop (also the first-time set-up: there is no separate onboarding).
 * The first save creates the shop and publishes a Basic Wash service.
 */
export default function EditShopPage() {
  const { loading, shop } = useShop();
  const { data: profile } = useLoad(
    () => (shop ? api<{ data: BusinessProfile }>(`/businesses/${shop.id}`).then((r) => r.data) : Promise.resolve(null)),
    `edit-${shop?.id ?? "new"}`,
  );
  const ready = !loading && (!shop || profile);
  return (
    <ShopPageFrame narrow>
      <PageHeader title={shop ? "Edit shop" : "Set up your shop"} subtitle={shop ? undefined : "Saving creates your shop and publishes a Basic Wash."} back="/account" />
      {ready ? <EditForm key={profile?.id ?? "new"} profile={profile ?? null} canEdit={!shop || shop.role === "owner"} /> : <LoadingBlock />}
    </ShopPageFrame>
  );
}

function EditForm({ profile, canEdit }: { profile: (BusinessProfile & { hours?: string | null; logoUrl?: string | null }) | null; canEdit: boolean }) {
  const router = useRouter();
  const { reload } = useShop();
  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState((profile?.phoneE164 ?? "").replace(/^\+63/, ""));
  const [hours, setHours] = useState(profile?.hours ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [location, setLocation] = useState<ShopLocation | null>(profile?.location ?? null);
  const [listed, setListed] = useState(profile?.riverMobile?.listed ?? true);
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  async function uploadLogo(files: FileList | null) {
    const file = files?.[0];
    if (!file || !profile) return;
    setBusy(true);
    setMsg(null);
    try {
      const url = await uploadShopPhoto(profile.id, file);
      await api(`/businesses/${profile.id}`, { method: "PATCH", body: { logoUrl: url } });
      setLogoUrl(url);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const digits = phone.replace(/\D/g, "").replace(/^0/, "");
      const phoneE164 = digits.length === 10 ? `+63${digits}` : null;
      let id = profile?.id;
      if (!id) {
        const body: Record<string, unknown> = { name: name.trim() };
        if (phoneE164) body.phoneE164 = phoneE164;
        if (address.trim()) body.address = address.trim();
        if (location) body.location = location;
        const res = await api<{ data: { id: string } }>("/businesses", { method: "POST", body });
        id = res.data.id;
        currentShop.set(id);
        await api(`/businesses/${id}/services`, { method: "POST", body: DEFAULT_SERVICE });
      }
      await api(`/businesses/${id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          phoneE164,
          hours: hours.trim() || null,
          address: address.trim() || null,
          location,
          riverMobileListed: listed,
        },
      });
      reload();
      if (!profile) router.push("/home");
      else setMsg("Shop saved.");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={save} className="mt-6 flex flex-col gap-4">
        {profile ? (
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center overflow-hidden rounded-[20px] bg-grey-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoUrl ? <img src={logoUrl} alt="Shop logo" className="size-full object-cover" /> : <ImagePlus size={22} className="text-muted" />}
            </span>
            <input ref={logoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void uploadLogo(e.target.files)} />
            <Button type="button" size="sm" variant="secondary" disabled={!canEdit || busy} onClick={() => logoInput.current?.click()}>
              {logoUrl ? "Change logo" : "Add logo"}
            </Button>
          </div>
        ) : null}
        <Input label="Shop name" placeholder="e.g. Shine Auto Spa" value={name} disabled={!canEdit || busy} onChange={(e) => setName(e.target.value)} />
        <Input label="Shop phone (+63)" placeholder="917 123 4567" value={phone} disabled={!canEdit || busy} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        <Input label="Opening hours" placeholder="Mon–Sun 8 AM – 6 PM" value={hours} disabled={!canEdit || busy} onChange={(e) => setHours(e.target.value)} />
        <LocationPicker
          address={address}
          location={location}
          disabled={!canEdit || busy}
          onChange={({ address: a, location: loc }) => {
            setAddress(a);
            setLocation(loc);
          }}
        />
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" checked={listed} disabled={!canEdit || busy} onChange={(e) => setListed(e.target.checked)} />
          List on River Mobile
        </label>
        {msg ? <p role="status" className="text-[14px] font-semibold">{msg}</p> : null}
        {canEdit ? (
          <Button type="submit" data-auth="action" fullWidth disabled={busy || !name.trim()}>
            {busy ? "Saving…" : profile ? "Save shop" : "Create my shop"}
          </Button>
        ) : (
          <p className="text-[13px] font-medium text-muted">Only the shop owner can edit these details.</p>
        )}
      </form>
      {profile ? (
        <ShopPhotos
          key={`${profile.id}-${(profile.photoUrls ?? []).join("|")}`}
          businessId={profile.id}
          photoUrls={profile.photoUrls ?? []}
          canEdit={canEdit}
        />
      ) : null}
    </>
  );
}
