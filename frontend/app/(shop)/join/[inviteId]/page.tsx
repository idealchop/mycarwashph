import { Button } from "@river-apps/ui";
import { RiverIcon } from "@/components/river-icon";

/** Old sign-in invites were replaced by staff links (no sign-in, Barbers.ph style). */
export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-[402px] flex-col items-center px-5 pb-10 pt-12 text-center">
      <RiverIcon name="queue" size={96} className="block" />
      <h1 className="mt-5 text-[24px] font-extrabold tracking-[-0.03em]">Ask for your staff link</h1>
      <p className="mt-2 text-[14.5px] font-medium text-muted">Staff no longer sign in. Ask the shop owner to share your staff link from Settings › Staff, then open it on this phone.</p>
      <Button className="mt-6" fullWidth variant="secondary" href="/home">Go to Home</Button>
    </main>
  );
}
