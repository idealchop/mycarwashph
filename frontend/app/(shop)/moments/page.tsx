"use client";

import { Button, EmptyState } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { LoadingBlock, PageHeader } from "@/components/shop/page";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { api, type BusinessProfile } from "@/lib/api";
import { cleanPhotoUrls, MAX_SHOP_PHOTOS, uploadShopPhoto } from "@/lib/shop-photos";
import { useShop } from "@/lib/shop-context";
import { useLoad } from "@/lib/use-load";

/**
 * Moments: the shop's photo feed (finished cars, the bays, the team). Photos are the
 * shop photos River Mobile shows on the listing, so a new moment is also a new listing photo.
 */
export default function MomentsPage() {
  const { loading, shop, signedIn } = useShop();
  return (
    <ShopPageFrame>
      <PageHeader
        title="Moments"
        subtitle="Share your best washes with River Mobile customers"
        actions={!shop ? <Button size="sm" href="/settings/edit" data-auth="action" leadingIcon={<ImagePlus size={18} strokeWidth={2} />}>Post</Button> : null}
      />
      {loading ? (
        <LoadingBlock />
      ) : shop ? (
        <Feed shopId={shop.id} shopName={shop.name} canPost={shop.role === "owner"} />
      ) : (
        <EmptyState
          className="mt-8"
          illustration={<Icon3D name="sparkle" size={64} />}
          title="No moments yet"
          description={signedIn ? "Set up your shop, then post photos of shiny cars, your bays and your team." : "Sign in and set up your shop to post photos of shiny cars, your bays and your team."}
          action={<Button href="/settings/edit" data-auth="action">Set up your shop</Button>}
        />
      )}
    </ShopPageFrame>
  );
}

function Feed({ shopId, shopName, canPost }: { shopId: string; shopName: string; canPost: boolean }) {
  const { data, error, reload } = useLoad(() => api<{ data: BusinessProfile }>(`/businesses/${shopId}`).then((r) => r.data), `moments-${shopId}`);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const photos = data?.photoUrls ?? [];
  const full = photos.length >= MAX_SHOP_PHOTOS;

  async function post(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const url = await uploadShopPhoto(shopId, file);
      await api(`/businesses/${shopId}`, { method: "PATCH", body: { photoUrls: cleanPhotoUrls([url, ...photos]) } });
      reload();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (error) return <p role="alert" className="mt-4 font-semibold">{error}</p>;
  if (!data) return <LoadingBlock />;
  return (
    <>
      {canPost ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-raised">
          <span className="text-[14px] font-semibold text-muted">{full ? `Up to ${MAX_SHOP_PHOTOS} moments. Remove one in Settings → Edit shop to post more.` : "Post a photo of today’s best wash."}</span>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void post(e.target.files)} />
          <Button size="sm" disabled={busy || full} leadingIcon={<ImagePlus size={18} strokeWidth={2} />} onClick={() => input.current?.click()}>
            {busy ? "Posting…" : "Post"}
          </Button>
        </div>
      ) : null}
      {msg ? <p role="alert" className="mt-3 text-[13.5px] font-semibold">{msg}</p> : null}
      {photos.length === 0 ? (
        <EmptyState className="mt-8" illustration={<Icon3D name="sparkle" size={64} />} title="No moments yet" description="Your first photo shows here and on your River Mobile listing." />
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {photos.map((url) => (
            <li key={url} className="overflow-hidden rounded-card bg-surface shadow-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${shopName} moment`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <p className="px-4 py-3 text-[13.5px] font-bold">{shopName}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
