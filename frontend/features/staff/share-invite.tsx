"use client";

import { Button } from "@river-apps/ui";
import { Check, Copy, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { QrCode } from "@/components/shop/qr-code";
import { staffLinkPath } from "@/lib/staff-link";

const useOrigin = () => useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");

/** Share to staff (Barbers.ph “Share to barber”): native share sheet, copy link, and a QR to scan. No sign-in for staff. */
export function ShareStaffLink({ token, shopName, name }: { token: string; shopName: string; name: string }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  if (!origin) return null;
  const url = `${origin}${staffLinkPath(token)}`;
  const text = `${name}, your Mycarwash staff link for ${shopName}. Open it to run the queue, no sign-in needed.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: `${shopName} · Mycarwash`, text, url }); return; } catch { return; /* closed */ } }
    await copy();
  };
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <QrCode value={url} size={184} label={`Staff link QR for ${name}`} />
      <p className="max-w-[300px] text-[13.5px] font-medium text-muted"><b className="text-ink">{name}</b> scans this or opens the link to run the queue. No sign-in needed. Keep it private.</p>
      <p className="w-full truncate rounded-[12px] bg-grey-100 px-3 py-2 font-mono text-[12px]" data-testid="invite-url">{url}</p>
      <div className="grid w-full grid-cols-2 gap-2">
        <Button variant="secondary" leadingIcon={copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</Button>
        <Button leadingIcon={<Share2 size={16} aria-hidden />} onClick={() => void share()}>Share</Button>
      </div>
    </div>
  );
}
