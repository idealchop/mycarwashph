"use client";

import { CoinIcon, CarIllustration } from "@river-apps/icons";
import { Button, FloatingCard, ProgressRing, SampleDataTag } from "@river-apps/ui";
import { Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GoogleG, MycarwashBrand } from "@/components/brand";
import { Screen } from "@/components/screen";
import { authErrorMessage, signInWithGoogle, useAuth } from "@/lib/auth";
import { enterGuestMode } from "@/lib/guest-mode";

/** 01 · Welcome / sign in */
export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [loading, user, router]);

  async function google() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <div className="px-6 pt-3.5"><MycarwashBrand /></div>
      <div className="relative mx-4 mt-[18px] h-[322px] overflow-hidden rounded-[32px] bg-[radial-gradient(60%_55%_at_50%_60%,#fff_0%,rgba(255,255,255,0)_70%),linear-gradient(180deg,#ECECEF,#F6F6F8)]">
        <div className="absolute inset-x-[-8px] bottom-[22px] flex justify-center">
          <CarIllustration color="black" size={372} title="Black car covered in soap foam" />
        </div>
        <FloatingCard className="absolute left-[18px] top-[22px]" icon={<ProgressRing value={72} size={36} thickness={4.5} label="12m" labelSize={9} />} title="Bay 1" subtitle="Regular Wash" />
        <FloatingCard className="absolute right-4 top-[70px]" icon={<CoinIcon size={30} />} title="+₱350" subtitle="New booking" />
        <SampleDataTag className="absolute bottom-3 right-3">Illustration</SampleDataTag>
      </div>
      <div className="px-7 pt-[26px]">
        <h1 className="text-[31px] font-extrabold leading-[1.12] tracking-[-0.03em]">Run your carwash<br />from your phone</h1>
        <p className="mt-2.5 text-[16px] font-medium text-muted">Bookings, queue and today’s sales in one simple app.</p>
      </div>
      <div className="mt-auto flex flex-col gap-2.5 px-6 pb-10 pt-6">
        <Button href="/sign-in/phone" fullWidth leadingIcon={<Smartphone size={20} strokeWidth={1.75} />}>Continue with phone number</Button>
        <Button fullWidth variant="secondary" leadingIcon={<GoogleG />} onClick={google} disabled={busy}>Continue with Google</Button>
        <Button
          fullWidth
          variant="ghost"
          disabled={busy}
          onClick={() => {
            enterGuestMode();
            router.push("/home");
          }}
        >
          Browse dashboard as guest
        </Button>
        {error ? <p role="alert" className="text-center text-[13.5px] font-semibold">{error}</p> : null}
        <p className="mt-1.5 text-center text-[12.5px] font-medium text-muted">Preview uses sample data only. Sign in when you accept bookings, scan, or save. By continuing you agree to our Terms and Privacy Policy.</p>
      </div>
    </Screen>
  );
}
