"use client";

import { Button } from "@river-apps/ui";
import { Check, Copy, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { QrCode } from "@/components/shop/qr-code";

const useOrigin = () => useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");

/** Staff invite link: /join/{inviteId}. Staff sign in with the invited number, then join the shop. */
export function useInviteUrl(inviteId: string) {
  const origin = useOrigin();
  return origin ? `${origin}/join/${encodeURIComponent(inviteId)}` : "";
}

/** Share to staff (Barbers.ph “Share to barber”): native share sheet, copy link, and a QR to scan. */
export function ShareInvite({ inviteId, shopName, phone }: { inviteId: string; shopName: string; phone?: string | null }) {
  const url = useInviteUrl(inviteId);
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  const text = `Join ${shopName} on Mycarwash. Open the link and sign in${phone ? ` with ${phone}` : ""}.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: `Join ${shopName}`, text, url }); return; } catch { return; /* closed */ } }
    await copy();
  };
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <QrCode value={url} size={184} label={`Staff invite QR for ${shopName}`} />
      <p className="max-w-[300px] text-[13.5px] font-medium text-muted">Staff scan this or open the link, then sign in{phone ? <> with <b className="text-ink">{phone}</b></> : null} to join your shop.</p>
      <p className="w-full truncate rounded-[12px] bg-grey-100 px-3 py-2 font-mono text-[12px]" data-testid="invite-url">{url}</p>
      <div className="grid w-full grid-cols-2 gap-2">
        <Button variant="secondary" leadingIcon={copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</Button>
        <Button leadingIcon={<Share2 size={16} aria-hidden />} onClick={() => void share()}>Share</Button>
      </div>
    </div>
  );
}
