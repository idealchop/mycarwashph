import { randomUUID } from "node:crypto";
import type { getStorage } from "firebase-admin/storage";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

/** Writes shop photos to Cloud Storage. Injected so tests can fake it. */
export interface PhotoStore {
  /** Saves the object and returns a public HTTPS download URL. */
  save(path: string, data: Buffer, contentType: string): Promise<string>;
  /** Deletes the object if it exists. */
  remove(path: string): Promise<void>;
  /** Maps a download URL back to its object path, or null if it is not ours. */
  pathFromUrl(url: string): string | null;
}

const BASE = "https://firebasestorage.googleapis.com/v0/b/";

/**
 * Firebase Storage rules cannot read named Firestore databases (mycarwash-dev /
 * mycarwash-prod), so shop-owner checks happen in the API and the API writes with
 * the Admin SDK. Download URLs use a Firebase download token, like getDownloadURL().
 */
export class FirebasePhotoStore implements PhotoStore {
  constructor(private readonly bucket: Bucket) {}

  async save(path: string, data: Buffer, contentType: string): Promise<string> {
    const token = randomUUID();
    await this.bucket.file(path).save(data, {
      resumable: false,
      metadata: { contentType, cacheControl: "public,max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
    });
    return `${BASE}${this.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  }

  async remove(path: string): Promise<void> {
    await this.bucket.file(path).delete({ ignoreNotFound: true });
  }

  pathFromUrl(url: string): string | null {
    const prefix = `${BASE}${this.bucket.name}/o/`;
    if (!url.startsWith(prefix)) return null;
    const encoded = url.slice(prefix.length).split("?")[0] ?? "";
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }
}
