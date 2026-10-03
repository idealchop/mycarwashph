import { Button, Card, LogoMark } from "@river-apps/ui";

/** Phase 0 scaffold page. Real screens arrive with the auth + screens milestone. */
export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <Card className="flex flex-col items-start gap-4 p-6">
        <LogoMark />
        <h1 className="text-2xl font-bold">Mycarwash.ph</h1>
        <p className="text-muted">Scaffold is up. Screens are coming next.</p>
        <Button>Get started</Button>
      </Card>
    </main>
  );
}
