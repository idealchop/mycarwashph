"use client";

import { Button } from "@river-apps/ui";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RiverIcon } from "@/components/river-icon";
import { ApiError, api } from "@/lib/api";
import { setStaffLinkToken, staffLinkToken } from "@/lib/staff-link";

/** Staff link (/s/{token}, Barbers.ph /b/{token}): no account. Checks the link, saves it on this device, opens Home. */
export default function StaffLinkPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<{ error: string } | null>(null);
  useEffect(() => {
    const prev = staffLinkToken();
    setStaffLinkToken(token);
    api<{ data: { business: { name: string } } }>("/public/staff-link").then(
      () => router.replace("/home"),
      (e: Error) => {
        setStaffLinkToken(prev && prev !== token ? prev : null);
        setState({ error: e instanceof ApiError && (e.status === 404 || e.status === 401) ? "This staff link was reset or turned off. Ask the owner for the new link." : e.message });
      },
    );
  }, [token, router]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[402px] flex-col items-center justify-center px-5 pb-10 text-center">
      <RiverIcon name="queue" size={96} className="block" />
      {state ? (
        <>
          <h1 className="mt-5 text-[24px] font-extrabold tracking-[-0.03em]">Link not working</h1>
          <p className="mt-2 text-[14.5px] font-medium text-muted">{state.error}</p>
          <Button className="mt-6" fullWidth variant="secondary" href="/home">Go to Home</Button>
        </>
      ) : (
        <>
          <h1 className="mt-5 text-[24px] font-extrabold tracking-[-0.03em]">Opening your shop…</h1>
          <p className="mt-2 text-[14.5px] font-medium text-muted">No sign-in needed. This link is just for you.</p>
        </>
      )}
    </main>
  );
}
