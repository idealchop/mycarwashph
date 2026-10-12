"use client";

import { Badge, Button } from "@river-apps/ui";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useAuthGate } from "@/components/auth/auth-gate";
import { api } from "@/lib/api";
import { cleanPhotoUrls, deleteShopPhotoByUrl, MAX_SHOP_PHOTOS, uploadShopPhoto } from "@/lib/shop-photos";

/** Storefront / interior photos saved on the shop for River Mobile.
 * Remount with a `key` from the parent when server photoUrls change (e.g. after reload).
 */
export function ShopPhotos({
  businessId,
  photoUrls,
  canEdit,
  onSaved,
}: {
  businessId: string;
  photoUrls: string[];
  /** Owner (signed in) may upload/remove; guests/staff see preview only. */
  canEdit: boolean;
  onSaved?: (urls: string[]) => void;
}) {
  const { requireAuth } = useAuthGate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState(photoUrls);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = urls.length >= MAX_SHOP_PHOTOS;

  async function persist(next: string[]) {
    const cleaned = cleanPhotoUrls(next);
    await api(`/businesses/${businessId}`, { method: "PATCH", body: { photoUrls: cleaned } });
    setUrls(cleaned);
    onSaved?.(cleaned);
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!canEdit) {
      requireAuth(undefined, { subtitle: "Sign in as the shop owner to upload photos." });
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const next = [...urls];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_SHOP_PHOTOS) break;
        next.push(await uploadShopPhoto(businessId, file));
      }
      await persist(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeAt(index: number) {
    if (!canEdit) {
      requireAuth(undefined, { subtitle: "Sign in as the shop owner to update photos." });
      return;
    }
    const target = urls[index];
    if (!target) return;
    setError(null);
    setBusy(true);
    try {
      const next = urls.filter((_, i) => i !== index);
      await persist(next);
      void deleteShopPhotoByUrl(target);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 shop-panel">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <b className="text-[15px]">Shop photos</b>
          <p className="mt-1 text-[13px] font-medium text-muted">
            Show customers on River Mobile what your shop looks like. JPG, PNG or WebP · up to {MAX_SHOP_PHOTOS} · 5&nbsp;MB each.
          </p>
        </div>
        <Badge variant="soft" className="shrink-0">
          {urls.length}/{MAX_SHOP_PHOTOS}
        </Badge>
      </div>

      {urls.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {urls.map((url, i) => (
            <li key={url} className="group relative overflow-hidden rounded-[16px] bg-grey-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Shop photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              {canEdit ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/80 text-white sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Remove photo ${i + 1}`}
                  disabled={busy}
                  onClick={() => void removeAt(i)}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-tile border border-dashed border-grey-200 px-4 py-8 text-center text-[13.5px] font-semibold text-muted">
          No photos yet. Add a clear storefront shot first — River Mobile will use these on your listing.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={busy || (canEdit && full)}
        onChange={(e) => void addFiles(e.target.files)}
      />

      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] font-semibold">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy || (canEdit && full)}
          leadingIcon={<ImagePlus size={18} />}
          onClick={() => {
            if (!canEdit) {
              requireAuth(undefined, { subtitle: "Sign in as the shop owner to upload photos." });
              return;
            }
            inputRef.current?.click();
          }}
        >
          {busy ? "Uploading…" : full && canEdit ? "Photo limit reached" : "Upload photos"}
        </Button>
      </div>
    </section>
  );
}
