import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseAuth, firebaseStorage } from "@/lib/firebase";

export const MAX_SHOP_PHOTOS = 6;
export const MAX_SHOP_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/** Upload one shop photo to Storage; returns the HTTPS download URL. */
export async function uploadShopPhoto(businessId: string, file: File): Promise<string> {
  const uid = firebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("Sign in to upload shop photos.");
  if (!ALLOWED.has(file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
  if (file.size > MAX_SHOP_PHOTO_BYTES) throw new Error("Each photo must be under 5 MB.");
  const name = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extFor(file.type)}`;
  const storageRef = ref(firebaseStorage(), `businesses/${businessId}/photos/${name}`);
  await uploadBytes(storageRef, file, { contentType: file.type, cacheControl: "public,max-age=31536000" });
  return getDownloadURL(storageRef);
}

/** Best-effort delete from Storage by download URL. */
export async function deleteShopPhotoByUrl(url: string): Promise<void> {
  try {
    await deleteObject(ref(firebaseStorage(), url));
  } catch {
    // ignore missing / foreign URLs
  }
}

export function cleanPhotoUrls(urls: string[]): string[] {
  return [...new Set(urls.filter((u) => typeof u === "string" && u.startsWith("https://")))].slice(0, MAX_SHOP_PHOTOS);
}
