"use client";

import { CarIllustration, CoinIcon } from "@river-apps/icons";
import { Plus, ScanLine } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, HeroBanner, ProgressRing, SearchInput, SectionHeader, StatCard, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthGate } from "@/components/auth/auth-gate";
import { PageBack } from "@/components/shop/page-back";
import { SalesChartCard, type SalesRow } from "@/features/sales/sales-chart";
import { useAuth } from "@/lib/auth";
import { greeting as greetingFor, peso } from "@/lib/format";
import { useShop } from "@/lib/shop-context";
import { acceptJob, declineJob, figures, useToday, type Job } from "@/lib/today";

const linkCls = "text-[14px] font-bold underline decoration-grey-300 underline-offset-[3px]";
const PILL = "relative h-8 gap-1 rounded-pill px-2.5 text-[12px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']";

function shortPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("63") ? `0${digits.slice(2)}` : digits;
  return local.length > 7 ? `${local.slice(0, 4)}•••${local.slice(-3)}` : phone;
}

function BookingCard({ job, onAct }: { job: Job; onAct: (fn: () => Promise<void>) => void }) {
  const { shop } = useShop();
  return (
    <article className="min-w-0 rounded-card bg-surface px-3.5 pb-3.5 pt-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block truncate text-[15.5px]">{job.who}</b>
          <p className="mt-0.5 truncate text-[13px] font-medium text-muted">{job.serviceName} · {job.slotLabel}</p>
        </div>
        <span className="inline-flex h-[22px] items-center rounded-pill bg-ink px-2 text-[11.5px] font-bold text-on-ink">New</span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-muted">{job.price ? `${job.ref} · ${peso(job.price)}` : job.ref}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" data-auth="action" onClick={() => shop && onAct(() => declineJob(shop.id, job))}>Decline</Button>
        <Button size="sm" className="flex-1" data-auth="action" onClick={() => shop && onAct(() => acceptJob(shop.id, job))}>Accept</Button>
      </div>
    </article>
  );
}

function Bookings({ rows, loading, max, onAct }: { rows: Job[]; loading: boolean; max: number; onAct: (fn: () => Promise<void>) => void }) {
  const shown = rows.slice(0, max);
  const more = rows.length - shown.length;
  if (loading) return <p className="rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">Loading bookings…</p>;
  return (
    <div className="flex flex-col gap-3">
      {shown.length === 0 ? (
        <p className="rounded-card bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
          No bookings yet. When customers book you on River Mobile, they’ll show up here.
        </p>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3">
          {shown.map((row) => <BookingCard key={row.id} job={row} onAct={onAct} />)}
        </div>
      )}
      {more > 0 ? <Link href="/queue?channel=online" className={`${linkCls} self-center py-2`}>See {more} more</Link> : null}
    </div>
  );
}

function hourSeries(byHour: { label: string; centavos: number }[] | undefined): SalesRow[] {
  return (byHour ?? []).map((h) => ({ label: h.label, salesCentavos: h.centavos }));
}

/** Home mirrors Barbers.ph: greeting, today hero, three stats, sales by hour, bookings to accept. */
export function HomeScreen() {
  const { user } = useAuth();
  const { shop, signedIn, loading } = useShop();
  const { requireAuth } = useAuthGate();
  const today = useToday(shop);
  const [note, setNote] = useState("");
  const paid = shop?.plan === "paid";
  const greeting = greetingFor();
  const fig = figures(today.jobs, today.summary);
  const fresh = today.jobs.filter((j) => j.status === "requested");
  const aside = !today.ready ? "" : fresh.length ? `${fresh.length} new` : "Live";
  const todayTitle = `Today: ${peso(fig.sales) || "₱0"}`;
  const owner = user ? ((user.displayName ?? "").split(" ")[0] || user.displayName || "") : "";
  const displayName = user?.displayName || user?.phoneNumber || user?.email || "Me";
  const shopName = shop?.name || (signedIn ? "your shop" : "Mycarwash.ph");
  const contact = user ? shortPhone(user.phoneNumber || shop?.phoneE164 || "") || user.email || "" : "";
  const needsSetup = signedIn && !loading && !shop;
  const dayLabel = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" });
  const dayTotal = fig.cars + fig.toAccept + fig.waiting + fig.inBay;
  const pct = dayTotal ? Math.round((fig.cars / dayTotal) * 100) : 0;
  const series = hourSeries(today.summary?.byHour);

  const act = (fn: () => Promise<void>) => {
    setNote("");
    fn().then(() => today.reload(), (e: Error) => setNote(e.message));
  };

  return (
    <>
      <div className="mx-auto w-full max-w-[402px] pb-4 lg:hidden">
        <header className="px-4 pt-1">
          <div className="flex h-16 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center">
              <PageBack fallback="/home" />
              {user ? (
                <Link href="/account" aria-label="My Account" className="flex min-h-11 items-center gap-2 rounded-[14px] py-1 pl-1 pr-1.5">
                  <Avatar name={owner || displayName} src={user.photoURL ?? undefined} preset="sky" size={36} />
                  <span className="flex min-w-0 flex-col leading-[1.2]">
                    <span className="max-w-[150px] truncate text-[13px] font-medium">{displayName}</span>
                    {contact ? <span className="max-w-[150px] truncate text-[11px] font-medium text-muted">{contact}</span> : null}
                  </span>
                </Link>
              ) : (
                <button type="button" onClick={() => requireAuth()} className="flex min-h-11 items-center gap-2 rounded-[14px] py-1 pl-1 pr-1.5 text-left">
                  <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-grey-100 text-[15px] font-bold">?</span>
                  <span className="flex min-w-0 flex-col leading-[1.2]">
                    <span className="text-[13px] font-bold">Sign in</span>
                    <span className="text-[11px] font-medium text-muted">Save your shop</span>
                  </span>
                </button>
              )}
            </div>
            <Link href="/sales" aria-label="Sales" className="inline-flex size-11 flex-none items-center justify-center">
              <CoinIcon size={36} />
            </Link>
          </div>
        </header>
        <section className="relative isolate mx-4 mt-3 flex h-[150px] items-center overflow-hidden rounded-banner bg-ink px-4 text-on-ink">
          <div className="relative z-10 min-w-0 flex-1">
            <p className="truncate text-[12px] leading-4">
              <span className="font-medium text-on-ink-muted">{greeting}, </span>
              <span className="font-semibold text-on-ink/90">{shopName}</span>
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold leading-[1.15] tracking-[-0.025em]">{todayTitle}</h2>
            <p className="mt-0.5 text-[12.5px] font-medium text-on-ink-muted">{fig.cars} cars · {fig.inBay} in bay</p>
            <div className="mt-2 flex flex-nowrap items-center gap-1.5">
              {paid ? <Button href="/queue/new" variant="white" size="sm" className={PILL} leadingIcon={<Plus size={14} strokeWidth={2} />}>Walk-in</Button> : null}
              <Button href="/scan" variant={paid ? "ghost-inverse" : "white"} size="sm" className={PILL} leadingIcon={<ScanLine size={14} strokeWidth={1.9} />}>Scan QR</Button>
            </div>
          </div>
          <div aria-hidden className="relative z-0 -mr-6 w-[120px] flex-none"><CarIllustration size={120} /></div>
        </section>
        <div className="mx-4 mt-3 grid grid-cols-3 gap-3">
          <StatCard className="pb-3" label="To accept" value={String(fig.toAccept)} />
          <Link href="/queue/bays" aria-label="In bay" className="block min-w-0 rounded-card">
            <StatCard className="pb-3" label="In bay" value={String(fig.inBay)} />
          </Link>
          <StatCard className="pb-3" label="Unpaid" value={peso(fig.unpaid) || "₱0"} />
        </div>
        {needsSetup ? <SetupCard className="mx-4 mt-3" /> : null}
        <SalesChartCard className="mx-4 mt-3" series={series} sales={fig.sales} />
        <SectionHeader className="px-5 pb-1 pt-4" title="Bookings to accept" aside={aside} />
        {note ? <p className="mx-4 mb-2 text-[13px] font-semibold">{note}</p> : null}
        <div className="mx-4"><Bookings rows={fresh} loading={!today.ready} max={4} onAct={act} /></div>
        {paid ? null : (
          <Card padding="none" className="mx-4 mt-2.5 flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="min-w-0">
              <b className="block text-[14px]">You’re on Partner</b>
              <small className="text-[12.5px] font-semibold text-muted">Paid adds walk-ins, bays and the shop QR</small>
            </span>
            <Button href="/settings/billing" variant="secondary" size="sm" className="flex-none">Plans</Button>
          </Card>
        )}
      </div>

      <div className="mx-auto hidden w-full max-w-[1120px] px-4 pb-6 pt-4 lg:block lg:px-[30px] lg:pt-6">
        <DesktopBar name={shopName} owner={owner} greeting={greeting} dayLabel={dayLabel} photoUrl={user?.photoURL ?? undefined} onSignIn={user ? undefined : () => requireAuth()} />
        {needsSetup ? <SetupCard className="mt-5" /> : null}
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_286px]">
          <HeroBanner
            size="lg"
            eyebrow={`Today · ${dayLabel}`}
            title={`${todayTitle} · ${fig.cars} cars`}
            titleSize="lg"
            description={`${fig.inBay} in bay`}
            contentWidth={460}
            actions={
              <div className="flex flex-nowrap items-center gap-2.5">
                {paid ? <Button href="/queue/new" variant="white" size="md" leadingIcon={<Plus size={18} strokeWidth={1.9} />}>Walk-in</Button> : null}
                <Button href="/scan" variant={paid ? "ghost-inverse" : "white"} size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan QR</Button>
              </div>
            }
            illustration={<CarIllustration size={300} />}
            illustrationClassName="right-[10px] bottom-3"
          />
          <StatCard
            className="px-5 pb-4 pt-[18px]"
            layout="title"
            label="Today’s bays"
            footer={
              <>
                <span className="flex flex-col leading-[1.2]">
                  <b className="text-[17px] font-extrabold">{fig.cars} done</b>
                  <small className="text-[12px] font-semibold text-muted">{peso(fig.sales) || "₱0"} in sales</small>
                </span>
                <Badge variant="soft">{fig.toAccept + fig.waiting} waiting</Badge>
              </>
            }
          >
            <div className="my-1.5 flex justify-center">
              <ProgressRing value={pct} size={124} thickness={11.5} label={`${pct}%`} labelSize={23} ariaLabel={`${pct}% of today’s cars done`} />
            </div>
          </StatCard>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-5">
          <StatCard className="pb-3" label="To accept" value={String(fig.toAccept)} />
          <Link href="/queue/bays" aria-label="In bay" className="block min-w-0 rounded-card">
            <StatCard className="pb-3" label="In bay" value={String(fig.inBay)} />
          </Link>
          <StatCard className="pb-3" label="Unpaid" value={peso(fig.unpaid) || "₱0"} />
        </div>
        <SalesChartCard className="mt-5" series={series} sales={fig.sales} />
        <Card padding="none" className="mt-5 px-[18px] pb-4 pt-4">
          <CardHeader className="mb-3" title="Bookings to accept" subtitle={aside} action={<Link href="/queue?channel=online" className={linkCls}>All bookings</Link>} />
          {note ? <p className="mb-2 text-[13px] font-semibold">{note}</p> : null}
          <Bookings rows={fresh} loading={!today.ready} max={4} onAct={act} />
        </Card>
      </div>
    </>
  );
}

function SetupCard({ className }: { className?: string }) {
  return (
    <Card padding="none" className={`flex items-center justify-between gap-3 px-4 py-3.5 ${className ?? ""}`}>
      <span className="min-w-0">
        <b className="block text-[14.5px]">Set up your shop</b>
        <small className="text-[12.5px] font-semibold text-muted">Add the name, map pin, bays and prices so customers can book.</small>
      </span>
      <Button href="/settings/edit" size="sm" className="flex-none">Set up</Button>
    </Card>
  );
}

function DesktopBar({ name, owner, greeting, dayLabel, photoUrl, onSignIn }: { name: string; owner: string; greeting: string; dayLabel: string; photoUrl?: string; onSignIn?: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  return (
    <Topbar
      className="px-1"
      leading={<PageBack fallback="/home" />}
      title={owner ? `${greeting}, ${owner}` : greeting}
      subtitle={`${dayLabel} · ${name}`}
      actions={
        <>
          <form className="hidden xl:flex" onSubmit={(e) => { e.preventDefault(); router.push(search.trim() ? `/scan?code=${encodeURIComponent(search.trim())}` : "/scan"); }}>
            <SearchInput className="w-[300px]" placeholder="Find a booking code, e.g. MCW1…" label="Find a booking" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <Link href="/sales" aria-label="Sales" className="inline-flex size-11 items-center justify-center">
            <CoinIcon size={40} />
          </Link>
          {onSignIn ? (
            <Button size="sm" onClick={onSignIn}>Sign in</Button>
          ) : (
            <Link href="/account" aria-label="Account" className="rounded-full">
              <Avatar name={owner || "Me"} src={photoUrl} preset="sky" size={44} decorative={false} />
            </Link>
          )}
        </>
      }
    />
  );
}
