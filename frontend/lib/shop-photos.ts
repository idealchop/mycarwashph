import { api } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

const apiBase = () => process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export const MAX_SHOP_PHOTOS = 6;
export const MAX_SHOP_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Upload one shop photo through the shop API (owner check happens there; Storage
 * rules cannot read our named Firestore databases). Returns the HTTPS download URL.
 */
export async function uploadShopPhoto(businessId: string, file: File): Promise<string> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("Sign in to upload shop photos.");
  if (!ALLOWED.has(file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
  if (file.size > MAX_SHOP_PHOTO_BYTES) throw new Error("Each photo must be under 5 MB.");
  const token = await user.getIdToken();
  const res = await fetch(`${apiBase()}/businesses/${businessId}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
    body: file,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || typeof json?.data?.url !== "string") throw new Error(json?.title ?? "Upload failed. Please try again.");
  return json.data.url as string;
}

/** Best-effort delete of a removed photo (API checks the URL belongs to this shop). */
export async function deleteShopPhotoByUrl(businessId: string, url: string): Promise<void> {
  try {
    await api(`/businesses/${businessId}/photos`, { method: "DELETE", body: { url } });
  } catch {
    // ignore missing / foreign URLs
  }
}

export function cleanPhotoUrls(urls: string[]): string[] {
  return [...new Set(urls.filter((u) => typeof u === "string" && u.startsWith("https://")))].slice(0, MAX_SHOP_PHOTOS);
}
