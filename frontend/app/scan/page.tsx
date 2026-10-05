"use client";

import { BubblesIcon, CarIcon } from "@river-apps/icons";
import { Avatar, Button, Card, IconButton, Input, MonoText, StatusDot, SuccessState } from "@river-apps/ui";
import { Camera, ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { BrowseGate } from "@/components/browse-gate";
import { GuestPage } from "@/components/shop/guest-page";
import { useAuth } from "@/lib/auth";
import { Screen } from "@/components/screen";
import { api, type Service, type VerifyResult } from "@/lib/api";
import { longDatePHT, timePHT } from "@/lib/format";
import { serviceNames } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";
import { useMe } from "@/lib/use-me";

export default function ScanPage() {
  return (
    <BrowseGate>
      <Scan />
    </BrowseGate>
  );
}

const noop = () => () => {};

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** 05 · Scan to verify a River Mobile booking, then show the verified result. */
function Scan() {
  const { user } = useAuth();
  if (!user) {
    return (
      <GuestPage
        title="Scan"
        description="Scan verifies a real River Mobile check-in QR for your shop."
        actionLabel="Sign in to scan customers"
        mobileTab="home"
      />
    );
  }
  return <ScanInner />;
}

function ScanInner() {
  const router = useRouter();
  const { shop } = useMe();
  const [payload, setPayload] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [camera, setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasDetector = useSyncExternalStore(noop, () => "BarcodeDetector" in window, () => false);

  const { data: services } = useLoad(
    () => (shop ? api<{ data: Service[] }>(`/businesses/${shop.id}/services`).then((r) => r.data) : Promise.resolve([] as Service[])),
    shop?.id ?? "none",
  );

  async function verify(value: string) {
    if (!shop || !value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ data: VerifyResult }>(`/businesses/${shop.id}/bookings/verify`, { method: "POST", body: { payload: value.trim() } });
      setResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Camera scanning where the browser supports BarcodeDetector (Chrome on Android).
  // Other browsers use the code field; a JS QR decoder fallback is Phase 1.
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let stop = false;
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        while (!stop) {
          const codes = await detector.detect(videoRef.current).catch(() => []);
          if (codes[0]?.rawValue) {
            setCamera(false);
            setPayload(codes[0].rawValue);
            void verify(codes[0].rawValue);
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        setError("Camera is not available. Type the code instead.");
        setCamera(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  function submit(e: FormEvent) {
    e.preventDefault();
    void verify(payload);
  }

  if (result) {
    const b = result.booking;
    const checkedIn = b.checkedInAt ? new Date(b.checkedInAt) : new Date();
    return (
      <Screen style={{ background: "linear-gradient(180deg,#F2F2F4 0%,#fff 46%)" }}>
        <div className="flex h-14 flex-none items-center justify-between px-4">
          <IconButton label="Close" icon={<X size={22} strokeWidth={1.75} />} onClick={() => router.push("/home")} />
          <span className="text-[15px] font-bold">Scan result</span>
          <span className="w-11" />
        </div>
        <SuccessState className="px-4" title="Booking verified" description={`Checked in at ${timePHT(checkedIn.toISOString())} · ${longDatePHT(checkedIn)}`} />
        <Card padding="sm" className="mx-5 mt-5 flex items-center gap-3 p-3.5">
          <Avatar name={b.customerSnapshot.name} preset="rose" size={48} />
          <span className="flex flex-1 flex-col gap-0.5"><b className="text-[16px]">{b.customerSnapshot.name}</b><StatusDot>River Mobile booking</StatusDot></span>
          {b.plate ? <MonoText inverse className="text-[16px]">{b.plate}</MonoText> : null}
        </Card>
        <div className="mx-5 mt-2.5 grid grid-cols-2 gap-2.5">
          {[
            { i: <BubblesIcon size={34} />, k: "Service", v: serviceNames(b.serviceIds, services ?? []) },
            { i: <CarIcon size={34} />, k: result.queueItem ? "Queue number" : "Booked for", v: result.queueItem ? `#${result.queueItem.queueNumber}` : `${longDatePHT(new Date(b.scheduledStart))}, ${timePHT(b.scheduledStart)}` },
          ].map((t) => (
            <Card key={t.k} tone="muted" radius="panel" padding="none" className="flex flex-col gap-0.5 rounded-[22px] p-3.5">
              <span className="mb-2">{t.i}</span>
              <small className="text-[12px] font-semibold text-muted">{t.k}</small>
              <b className="text-[15px] tracking-[-0.01em]">{t.v}</b>
            </Card>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2.5 px-4 pb-10 pt-6">
          <Button fullWidth onClick={() => router.push("/home")}>Done</Button>
          <Button fullWidth variant="secondary" leadingIcon={<ScanLine size={20} strokeWidth={1.75} />} onClick={() => { setResult(null); setPayload(""); }}>Scan another customer</Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="flex h-14 flex-none items-center justify-between px-4">
        <IconButton label="Close" icon={<X size={22} strokeWidth={1.75} />} onClick={() => router.push("/home")} />
        <span className="text-[15px] font-bold">Scan customer</span>
        <span className="w-11" />
      </div>
      <div className="px-4 pt-2">
        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[32px] bg-ink">
          {camera ? <video ref={videoRef} className="size-full object-cover" muted playsInline /> : <ScanLine size={96} strokeWidth={1.25} className="text-on-ink-muted" />}
          <span aria-hidden className="pointer-events-none absolute inset-10 rounded-[24px] border-2 border-dashed border-white/40" />
        </div>
        <p className="mt-4 text-[15px] font-medium text-muted">Ask the customer to open their booking in River Mobile and show the QR code.</p>
        {hasDetector ? (
          <Button className="mt-4" fullWidth variant="secondary" leadingIcon={<Camera size={20} strokeWidth={1.75} />} onClick={() => setCamera((c) => !c)}>
            {camera ? "Stop camera" : "Open camera"}
          </Button>
        ) : null}
      </div>
      <form onSubmit={submit} className="mt-auto flex flex-col gap-3 px-4 pb-10 pt-6">
        <Input label="Or type the code" placeholder="MCW1.…" value={payload} onChange={(e) => setPayload(e.target.value)} error={error ?? undefined} autoCapitalize="characters" />
        <Button type="submit" fullWidth disabled={busy || !payload.trim() || !shop}>{busy ? "Checking…" : "Verify booking"}</Button>
      </form>
    </Screen>
  );
}
