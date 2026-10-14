"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useShop } from "@/lib/shop-context";
import { uploadShopPhoto } from "@/lib/shop-photos";
import { updateCommunityStore, useCommunityStore, useNow, type CommunityPost, type PostAuthor } from "./posts";

let cache: CommunityPost[] | null = null;

async function dataUrlToUrl(shopId: string, src: string): Promise<string> {
  if (!src.startsWith("data:")) return src;
  const blob = await (await fetch(src)).blob();
  return uploadShopPhoto(shopId, new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }), "moment-photos");
}

/** The shared feed. Likes, replies and posts are saved on the server for the signed-in shop. */
export function useCommunityFeed() {
  const { shop } = useShop();
  const shopId = shop?.id;
  const { user } = useAuth();
  const area = shop?.location?.formattedAddress || shop?.address || "";
  const me: PostAuthor = useMemo(
    () => ({ name: shop?.name ?? "", meta: area.split(",").pop()?.trim() || undefined, photoUrl: shop?.logoUrl || undefined }),
    [shop?.name, area, shop?.logoUrl],
  );
  const store = useCommunityStore();
  const now = useNow();
  const [raw, setRaw] = useState<CommunityPost[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const reload = useCallback(() => api<{ posts: CommunityPost[] }>("/moments", { guest: true })
    .then((d) => { cache = d.posts; setRaw(cache); })
    .catch(() => undefined)
    .finally(() => setLoading(false)), []);

  useEffect(() => { void reload(); }, [reload, shopId, user?.uid]);

  const op = useCallback(async (body: Record<string, unknown>, done?: string) => {
    try {
      await api("/moments", { method: "POST", body: { ...body, businessId: shopId } });
      if (done) flash(done);
      await reload();
      return true;
    } catch (e) {
      flash((e as Error).message);
      return false;
    }
  }, [flash, reload, shopId]);

  const posts = useMemo(() => {
    const hidden = new Set(store.hidden);
    return raw.filter((p) => !hidden.has(p.id));
  }, [raw, store]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const share = async (p: CommunityPost) => {
    const url = `${window.location.origin}/moments#${p.id}`;
    const text = p.body ? `${p.author.name}: ${p.body.slice(0, 140)}` : `Post by ${p.author.name}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mycarwash.ph Moments", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      /* share sheet dismissed */
    }
  };

  return {
    me,
    now,
    posts,
    loading,
    toast,
    following: store.following,
    post(body: string, images: string[]) {
      void (async () => {
        try {
          if (!shop) throw new Error("Set up your shop in Settings before posting.");
          const urls = await Promise.all(images.map((src) => dataUrlToUrl(shop.id, src)));
          await op({ op: "post", body, images: urls }, "Posted");
        } catch (e) {
          flash((e as Error).message);
        }
      })();
      return true;
    },
    like(id: string) {
      setRaw((cur) => cur.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)));
      void op({ op: "like", id });
    },
    repost(p: CommunityPost) {
      void op({ op: "repost", id: p.id }, p.reposted ? undefined : "Reposted");
    },
    share,
    reply(p: CommunityPost, body: string) {
      void op({ op: "reply", id: p.id, body });
    },
    remove(p: CommunityPost) {
      void op({ op: "delete", id: p.id }, "Post deleted");
    },
    hide(id: string) {
      updateCommunityStore((st) => ({ ...st, hidden: [...st.hidden, id] }));
      flash("Post hidden");
    },
    copy(p: CommunityPost) {
      void navigator.clipboard?.writeText(p.body).then(() => flash("Copied"), () => undefined);
    },
    toggleFollow(handle: string) {
      const on = store.following.includes(handle);
      updateCommunityStore((st) => ({ ...st, following: toggle(st.following, handle) }));
      if (!on) flash("Following");
    },
  };
}
