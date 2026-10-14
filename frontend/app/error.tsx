"use client";

import { Button } from "@river-apps/ui";
import { useEffect } from "react";
import { Screen } from "@/components/screen";

/** Route-level error boundary: keeps the shell usable and never shows stack traces. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[mycarwash] route error", error.digest ?? "", error);
  }, [error]);
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-[22px] font-extrabold">Something went wrong</h1>
        <p className="max-w-sm text-[15px] font-medium text-muted">
          Please try again. If it keeps happening, reload the page.
          {error.digest ? <span className="mt-2 block font-mono text-[12px]">Ref: {error.digest}</span> : null}
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" href="/home">Home</Button>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </Screen>
  );
}
