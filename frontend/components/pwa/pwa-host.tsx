"use client";
/**
 * PWA host (ported from Barbers.ph pwa-host.tsx): starts listening for the browser's install prompt as early as
 * possible and shows a one-time "Installed! Welcome" on the first open from the home screen. Mycarwash has no
 * service worker yet, so the Barbers.ph update bar is not ported.
 */
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { isStandalone, listenForInstall } from "@/lib/pwa";

export function PwaHost() {
  useEffect(listenForInstall, []);
  return <InstalledWelcome />;
}

/** First launch from the home screen: "Installed! Welcome" once per device. */
export function InstalledWelcome() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (isStandalone() && !localStorage.getItem("mycarwash.pwa-welcomed")) { localStorage.setItem("mycarwash.pwa-welcomed", "1"); setShow(true); }
      } catch { /* private mode */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => { if (!show) return; const t = window.setTimeout(() => setShow(false), 4000); return () => window.clearTimeout(t); }, [show]);
  if (!show) return null;
  return (
    <button type="button" onClick={() => setShow(false)} role="status" className="fixed inset-x-0 bottom-[max(90px,calc(env(safe-area-inset-bottom)+80px))] z-[90] mx-auto flex w-fit items-center gap-2 rounded-pill bg-ink px-4 py-2.5 text-[14px] font-bold text-on-ink shadow-card">
      <CheckCircle2 size={17} aria-hidden /> Installed! Welcome
    </button>
  );
}
