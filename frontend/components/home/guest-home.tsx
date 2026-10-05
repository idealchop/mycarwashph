"use client";

import { CarIllustration, Icon3D } from "@river-apps/icons";
import {
  Avatar, Badge, BarChart, Button, Card, CardHeader, HeroBanner, IconTile, ListItem, ProgressRing, QueueList, ResourceCard, SectionHeader, StatCard, Topbar,
} from "@river-apps/ui";
import { LogIn, ScanLine } from "lucide-react";
import { GuestBanner } from "@/components/auth/guest-banner";
import { useAuthGate } from "@/components/auth/auth-gate";
import { ShopShell } from "@/components/shop/shop-shell";
import { GUEST_BOOKINGS, GUEST_ME, GUEST_QUEUE, GUEST_SALES_SUMMARY, GUEST_SHOP } from "@/lib/guest-fixtures";
import { SAMPLE_TARGET } from "@/lib/sample-data";
import { longDatePHT, peso, timePHT } from "@/lib/format";
import { Greeting } from "./common";

const PRESETS = ["lilac", "peach", "indigo", "mint"] as const;

/**
 * Local preview dashboard for guests (River Mobile enterAsGuest pattern).
 * No Firestore / API calls — fixtures only.
 */
export function GuestHome() {
  const { requireAuth } = useAuthGate();
  const shop = GUEST_SHOP;
  const me = GUEST_ME;
  const summary = GUEST_SALES_SUMMARY;
  const hourly = summary.byHour.map((h) => ({ value: Math.round(h.centavos / 100), label: h.label }));
  const waiting = GUEST_QUEUE.filter((q) => q.status === "queued");
  const gate = (label: string) =>
    requireAuth(undefined, { subtitle: `Sign in to ${label}. Preview data is sample only.` });

  return (
    <ShopShell plan="paid" newBookings={GUEST_BOOKINGS.filter((b) => b.status === "requested").length} waiting={waiting.length} mobileTab="home">
      <div className="lg:hidden">
        <GuestBanner />
        <div className="mx-auto max-w-[440px] pt-1">
          <Greeting title={shop.name} name="Guest" alerts={1} />
          <HeroBanner
            className="mx-4 mt-2"
            size="sm"
            eyebrow={<>Preview · {longDatePHT(new Date())}</>}
            title={<>{peso(summary.totalCentavos)} · {summary.cars} cars</>}
            description="Sample sales — sign in for your real shop"
            actions={
              <Button variant="white" size="sm" className="h-[42px] px-4 text-[14.5px]" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />} onClick={() => gate("scan customers")}>
                Scan customer
              </Button>
            }
            illustration={<CarIllustration size={200} />}
          />
          <StatCard className="mx-4 mt-2.5" label="Sales today" value={peso(summary.totalCentavos)} trailing={<Badge variant="soft">Sample</Badge>}>
            <BarChart className="mt-1" data={hourly.slice(0, 7)} highlightIndex={2} tooltip={peso(120000)} width={318} height={100} ariaLabel="Sample sales by hour" />
          </StatCard>
          <StatCard
            className="mx-4 mt-2.5"
            label="Daily target"
            footer={
              <>
                <span className="flex flex-col leading-[1.2]">
                  <b className="text-[17px] font-extrabold">{peso(summary.totalCentavos)}</b>
                  <small className="text-[12px] font-semibold text-muted">of {peso(SAMPLE_TARGET.targetCentavos)}</small>
                </span>
                <Badge variant="soft">Sample</Badge>
              </>
            }
          >
            <div className="my-1.5 flex justify-center">
              <ProgressRing value={SAMPLE_TARGET.pct} size={100} thickness={10} label={`${SAMPLE_TARGET.pct}%`} labelSize={20} ariaLabel="Sample target" />
            </div>
          </StatCard>
          <SectionHeader className="px-5 pb-2 pt-5" title="Queue" aside="Sample" />
          <div className="px-4 pb-28">
            <QueueList
              label="Waiting"
              items={waiting.map((q, i) => ({
                id: q.id,
                leading: <Avatar name={q.plate ?? `#${q.queueNumber}`} preset={PRESETS[i % PRESETS.length]} size={36} />,
                title: q.plate ?? `Car #${q.queueNumber}`,
                subtitle: "Walk-in · preview",
                trailing: `#${q.queueNumber}`,
              }))}
            />
            <Button className="mt-3" fullWidth onClick={() => gate("add a walk-in")}>
              Add walk-in
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden min-w-0 lg:block">
        <GuestBanner />
        <Topbar
          title="Preview your shop dashboard"
          subtitle="Sample data · sign in to connect your carwash"
          actions={
            <Button size="sm" leadingIcon={<LogIn size={18} strokeWidth={1.75} />} onClick={() => gate("use your shop")}>
              Sign in
            </Button>
          }
        />
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_286px]">
          <HeroBanner
            size="lg"
            eyebrow={<>Preview · {longDatePHT(new Date())}</>}
            title={<>Today: {peso(summary.totalCentavos)} · {summary.cars} cars</>}
            titleSize="lg"
            description={`${waiting.length} cars waiting · sample River Mobile bookings`}
            contentWidth={440}
            actions={
              <>
                <Button variant="white" size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />} onClick={() => gate("scan customers")}>
                  Scan customer
                </Button>
                <Button variant="ghost-inverse" size="md" onClick={() => gate("add a walk-in")}>
                  Add walk-in
                </Button>
              </>
            }
            illustration={<CarIllustration size={372} />}
            illustrationClassName="right-[18px] bottom-1.5 hidden md:block"
          />
          <StatCard
            className="px-5 pb-4 pt-[18px]"
            layout="title"
            label="Daily target"
            footer={
              <>
                <span className="flex flex-col leading-[1.2]">
                  <b className="text-[17px] font-extrabold">{peso(summary.totalCentavos)}</b>
                  <small className="text-[12px] font-semibold text-muted">of {peso(SAMPLE_TARGET.targetCentavos)}</small>
                </span>
                <Badge variant="soft">Sample</Badge>
              </>
            }
          >
            <div className="my-1.5 flex justify-center">
              <ProgressRing value={SAMPLE_TARGET.pct} size={124} thickness={11.5} label={`${SAMPLE_TARGET.pct}%`} labelSize={23} ariaLabel="Sample target" />
            </div>
          </StatCard>
        </div>
        <SectionHeader className="mb-2.5 mt-[18px]" title="Bays" aside="Sample" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ResourceCard
            density="comfortable"
            icon={<IconTile size={56}><Icon3D name="bubbles" size={38} /></IconTile>}
            eyebrow="Bay 1 · Washing"
            title="Regular Wash"
            meta="RTY 5566"
            progress={{ value: 55, label: "12m", ariaLabel: "Bay 1 sample" }}
          />
          <ResourceCard
            density="comfortable"
            variant="inverse"
            icon={<IconTile size={56} tone="dark"><Icon3D name="car" size={38} /></IconTile>}
            eyebrow={<>Bay 2 · <b className="text-on-ink">Free</b></>}
            title={`Next: ${waiting[0]?.plate ?? "—"}`}
            meta="Walk-in"
            action={
              <Button variant="white" size="sm" onClick={() => gate("assign a bay")}>
                Assign
              </Button>
            }
          />
        </div>
        <div className="mt-[18px] grid gap-5 pb-6 lg:grid-cols-2 xl:grid-cols-3">
          <Card padding="none" className="px-[18px] pb-2.5 pt-4 lg:min-h-[260px]">
            <CardHeader title="Sales today" subtitle="Sample by hour" />
            <BarChart className="mt-3.5" data={hourly} highlightIndex={2} tooltip={peso(120000)} width={470} height={180} ariaLabel="Sample sales" />
          </Card>
          <Card padding="none" className="px-[18px] pb-2.5 pt-4">
            <CardHeader title="Bookings" subtitle="Sample requests" />
            <ul className="mt-2">
              {GUEST_BOOKINGS.map((b, i) => (
                <ListItem
                  key={b.id}
                  as="li"
                  variant="row"
                  leading={<Avatar name={b.customerSnapshot.name} preset={PRESETS[i % PRESETS.length]} size={36} />}
                  title={b.customerSnapshot.name}
                  subtitle={`${b.plate} · ${b.status}`}
                  trailing={
                    b.status === "requested" ? (
                      <Button size="sm" onClick={() => gate("accept bookings")}>
                        Accept
                      </Button>
                    ) : (
                      <Badge variant="soft">{b.status}</Badge>
                    )
                  }
                />
              ))}
            </ul>
          </Card>
          <Card padding="none" className="px-[18px] pb-2.5 pt-4">
            <CardHeader title="Recent sales" subtitle="Sample" />
            <ul>
              {summary.recent.map((r) => (
                <ListItem
                  key={r.id}
                  as="li"
                  variant="row"
                  leading={<IconTile size={40}><Icon3D name="bubbles" size={26} /></IconTile>}
                  title={r.customerName ?? r.plate ?? "Sale"}
                  subtitle={r.method.toUpperCase()}
                  trailing={
                    <span className="flex flex-col items-end leading-[1.3]">
                      <b className="text-[14px] font-extrabold">{peso(r.amountCentavos)}</b>
                      <small className="text-[12px] font-medium text-muted">{timePHT(r.paidAt)}</small>
                    </span>
                  }
                />
              ))}
            </ul>
          </Card>
        </div>
        <p className="sr-only">{me.user.name} preview for {shop.name}</p>
      </div>
    </ShopShell>
  );
}
