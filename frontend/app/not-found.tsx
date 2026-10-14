import { Button } from "@river-apps/ui";
import { Screen } from "@/components/screen";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">404</p>
        <h1 className="text-[24px] font-extrabold">This page doesn’t exist</h1>
        <p className="max-w-sm text-[15px] font-medium text-muted">The link may be old or mistyped. Head back to your shop dashboard.</p>
        <Button className="mt-3" href="/home">Go to dashboard</Button>
      </div>
    </Screen>
  );
}
