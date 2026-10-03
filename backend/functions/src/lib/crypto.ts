import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Readable alphabet without 0/O/1/I/L so codes can be read aloud or typed. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashSecret(secret: string, pepper: string): string {
  return sha256(`${pepper}:${secret}`);
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length > 0 && ab.length === bb.length && timingSafeEqual(ab, bb);
}
