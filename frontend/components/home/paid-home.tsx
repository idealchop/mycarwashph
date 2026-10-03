"use client";

import { CarIllustration, Icon3D, TyreIcon } from "@river-apps/icons";
import {
  AppShell, Avatar, Badge, BarChart, Button, Card, CardHeader, EmptyState, HeroBanner, IconButton, IconTile, ListItem, MobileTabBar,
  ProgressRing, QueueList, ResourceCard, SampleDataTag, SearchInput, SectionHeader, SegmentedControl, Sidebar, StatCard, Topbar,
} from "@river-apps/ui";
import {
  ArrowRight, Bell, Calendar, ChartColumn, CircleHelp, LayoutGrid, List, LogOut, MessageSquare, Plus, ScanLine, Settings, TrendingUp, Users,
} from "lucide-react";
import { useState } from "react";
import { MycarwashBrand } from "@/components/brand";
import { api, type Bay, type Booking, type MeResponse, type QueueItem, type Service } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { longDatePHT, peso } from "@/lib/format";
import { SAMPLE_SALES_TODAY, SAMPLE_TARGET, sampleHourlyDesktop, sampleHourlyPhone, sampleRecentSales } from "@/lib/sample-data";
import { serviceIcon, serviceNames } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";
import { firstName, Greeting, PAID_TABS } from "./common";

const ic = { size: 20, strokeWidth: 1.75 } as const;
const PRESETS = ["lilac", "peach", "indigo", "mint", "rose", "butter"] as const;

interface BayView {
  bay: Bay;
  item: QueueItem | null;
  service: string;
  pct: number;
  minsLeft: number;
}

function useShopData(shopId: string) {
  const { data, error } = useLoad(async () => {
    const [bays, queue, services, bookings] = await Promise.all([
      api<{ data: Bay[] }>(`/businesses/${shopId}/bays`),
      api<{ data: QueueItem[] }>(`/businesses/${shopId}/queue`),
      api<{ data: Service[] }>(`/businesses/${shopId}/services`),
      api<{ data: Booking[] }>(`/businesses/${shopId}/bookings?status=requested`),
    ]);
    return { bays: bays.data, queue: queue.data, services: services.data, bookings: bookings.data };
  }, shopId);
  return { data, error };
}

function bayViews(bays: Bay[], queue: QueueItem[], services: Service[], now: number): BayView[] {
  return bays
    .filter((b) => b.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((bay) => {
      const item = queue.find((q) => q.status === "in_bay" && q.bayId === bay.id) ?? null;
      if (!item) return { bay, item, service: "", pct: 0, minsLeft: 0 };
      const duration = item.serviceIds.reduce((t, id) => t + (services.find((s) => s.id === id)?.durationMins ?? 0), 0) || 30;
      const elapsed = item.startedAt ? (now - new Date(item.startedAt).getTime()) / 60_000 : 0;
      return {
        bay,
        item,
        service: serviceNames(item.serviceIds, services),
        pct: Math.min(99, Math.max(1, Math.round((elapsed / duration) * 100))),
        minsLeft: Math.max(1, Math.round(duration - elapsed)),
      };
    });
}

/** 06 + 07 · Paid shop home: phone layout below `lg`, desktop dashboard from `lg` up. */
export function PaidHome({ me, shop }: { me: MeResponse; shop: MeResponse["businesses"][number] }) {
  const { data, error } = useShopData(shop.id);
  const [now] = useState(() => Date.now());
  const views = data ? bayViews(data.bays, data.queue, data.services, now) : [];
  const waiting = (data?.queue ?? []).filter((q) => q.status === "queued");
  const busy = views.filter((v) => v.item).length;
  const name = firstName(me.user.name, "there");
  const props = { me, shop, data, error, views, waiting, busy, name, now };

  return (
    <AppShell
      sidebar={<DesktopSidebar newBookings={data?.bookings.length ?? 0} waiting={waiting.length} />}
      mobileTabBar={<MobileTabBar items={PAID_TABS} activeKey="home" />}
      mainClassName="lg:px-[30px] lg:pt-6"
    >
      <div className="lg:hidden"><PaidPhone {...props} /></div>
      <div className="hidden lg:block"><PaidDesktop {...props} /></div>
    </AppShell>
  );
}

type Props = {
  me: MeResponse;
  shop: MeResponse["businesses"][number];
  data: ReturnType<typeof useShopData>["data"];
  error: string | null;
  views: BayView[];
  waiting: QueueItem[];
  busy: number;
  name: string;
  now: number;
};

function FreeBay({ view, next, comfortable }: { view: BayView; next?: QueueItem; comfortable?: boolean }) {
  return (
    <ResourceCard
      density={comfortable ? "comfortable" : undefined}
      variant="inverse"
      icon={comfortable ? <IconTile size={56} tone="dark"><TyreIcon size={38} /></IconTile> : <TyreIcon size={38} />}
      eyebrow={<>{view.bay.name} · <b className="text-on-ink">Free</b></>}
      title={next ? (comfortable ? `Next: ${next.plate ?? `#${next.queueNumber}`}` : "Assign next car") : "No cars waiting"}
      meta={next ? (comfortable ? next.source === "booking" ? "River Mobile" : "Walk-in" : next.plate ?? `#${next.queueNumber}`) : "Queue is empty"}
      action={next ? (comfortable
        ? <Button variant="white" size="sm" className="h-[34px] text-[12.5px]" trailingIcon={<ArrowRight size={15} strokeWidth={2.2} />}>Assign</Button>
        : <IconButton variant="white" label={`Assign next car to ${view.bay.name}`} className="size-[34px]" icon={<ArrowRight size={20} strokeWidth={2.2} />} />) : undefined}
    />
  );
}

function PaidPhone({ me, shop, data, error, views, waiting, busy, name }: Props) {
  return (
    <div className="mx-auto max-w-[440px] pt-3">
      <Greeting title={shop.name} name={me.user.name ?? name} alerts={data?.bookings.length ?? 0} />
      <HeroBanner
        className="mx-4 mt-2"
        size="sm"
        eyebrow={<>Today · {longDatePHT(new Date())}</>}
        title={peso(SAMPLE_SALES_TODAY.totalCentavos)}
        titleSize="display"
        description={<>{SAMPLE_SALES_TODAY.cars} cars washed · {waiting.length} waiting <SampleDataTag className="ml-1 align-middle">Sample sales</SampleDataTag></>}
        contentWidth={200}
        actions={<Button href="/scan" variant="white" size="sm" className="h-[42px] px-4 text-[14.5px]" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan customer</Button>}
        illustration={<CarIllustration size={196} />}
        illustrationClassName="-right-[30px] bottom-2"
      />
      <SectionHeader className="px-5 pb-2.5 pt-4" title="Bays" aside={`${busy} of ${views.length} busy`} />
      {error ? <p role="alert" className="px-5 text-[14px] font-semibold">{error}</p> : null}
      {data && views.length === 0 ? <EmptyState className="mx-4" title="Add your bays" description="Bays let you assign cars and track wash time." /> : null}
      <div className="grid grid-cols-2 gap-2.5 px-4">
        {views.map((v) =>
          v.item ? (
            <ResourceCard key={v.bay.id}
              icon={<IconTile size={48} className="-ml-[5px] -mt-[5px]"><Icon3D name={serviceIcon(v.service)} size={38} /></IconTile>}
              eyebrow={v.bay.name} title={v.service} meta={v.item.plate ?? `#${v.item.queueNumber}`}
              progress={{ value: v.pct, label: `${v.minsLeft}m`, ariaLabel: `${v.bay.name}: ${v.minsLeft} minutes left` }} />
          ) : (
            <FreeBay key={v.bay.id} view={v} next={waiting[0]} />
          ),
        )}
      </div>
      <StatCard className="mx-4 mt-2.5" label={<>Sales today <SampleDataTag className="ml-1 align-middle" /></>} value={peso(SAMPLE_SALES_TODAY.totalCentavos)} trailing={<Badge variant="soft">{SAMPLE_SALES_TODAY.changeLabel}</Badge>}>
        <BarChart className="mt-1" data={sampleHourlyPhone} highlightIndex={2} tooltip="₱1,200" width={318} height={100} ariaLabel="Sample sales by hour" />
      </StatCard>
    </div>
  );
}

function DesktopSidebar({ newBookings, waiting }: { newBookings: number; waiting: number }) {
  const nav = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutGrid {...ic} />, href: "/home" },
    { key: "queue", label: "Queue", icon: <List {...ic} />, badge: waiting || undefined },
    { key: "bookings", label: "Bookings", icon: <Calendar {...ic} />, badge: newBookings || undefined },
    { key: "sales", label: "Sales", icon: <ChartColumn {...ic} /> },
    { key: "customers", label: "Customers", icon: <Users {...ic} /> },
    { key: "messages", label: "Messages", icon: <MessageSquare {...ic} /> },
    { key: "growth", label: "Growth", icon: <TrendingUp {...ic} /> },
    { key: "settings", label: "Settings", icon: <Settings {...ic} /> },
  ];
  return (
    <Sidebar
      className="sticky top-0 h-dvh"
      brand={<MycarwashBrand />}
      items={nav}
      activeKey="dashboard"
      secondaryItems={[{ key: "help", label: "Help", icon: <CircleHelp {...ic} /> }]}
      footer={
        <div className="relative rounded-[22px] bg-grey-100 px-4 pb-4 pt-[66px]">
          <div className="absolute inset-x-1 -top-7 flex justify-center"><CarIllustration size={200} /></div>
          <b className="block text-[14.5px]">River Mobile bookings</b>
          <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">{newBookings} new to review</small>
          <Button size="sm" fullWidth href="/home">View bookings</Button>
        </div>
      }
    />
  );
}

function PaidDesktop({ me, shop, data, error, views, waiting, busy, name }: Props) {
  return (
    <>
      <Topbar
        title={`Hi ${name}, here’s today`}
        subtitle={<>{new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" })} · {shop.name}</>}
        actions={<>
          <SearchInput className="hidden w-[300px] md:flex" placeholder="Search plate or customer" label="Search plate or customer" />
          <IconButton variant="surface" label="Notifications" count={data?.bookings.length || undefined} icon={<Bell {...ic} />} />
          <IconButton variant="surface" label="Sign out" icon={<LogOut {...ic} />} onClick={() => signOut()} />
          <Avatar name={me.user.name ?? name} preset="sky" size={44} />
        </>}
      />
      {error ? <p role="alert" className="mt-3 text-[14px] font-semibold">{error}</p> : null}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_286px]">
        <HeroBanner
          size="lg"
          eyebrow={<>Today · {longDatePHT(new Date())}</>}
          title={<>Today: {peso(SAMPLE_SALES_TODAY.totalCentavos)} · {SAMPLE_SALES_TODAY.cars} cars</>}
          titleSize="lg"
          description={<>{waiting.length} cars waiting in the queue · {data?.bookings.length ?? 0} new River Mobile bookings <SampleDataTag className="ml-1 align-middle">Sample sales</SampleDataTag></>}
          contentWidth={440}
          actions={<>
            <Button href="/scan" variant="white" size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan customer</Button>
            <Button variant="ghost-inverse" size="md" leadingIcon={<Plus size={18} strokeWidth={1.75} />}>Add walk-in</Button>
          </>}
          illustration={<CarIllustration size={372} />}
          illustrationClassName="right-[18px] bottom-1.5 hidden md:block"
        />
        <StatCard className="px-5 pb-4 pt-[18px]" layout="title" label="Daily target" trailing={<SampleDataTag />}
          footer={<>
            <span className="flex flex-col leading-[1.2]"><b className="text-[17px] font-extrabold">{peso(SAMPLE_SALES_TODAY.totalCentavos)}</b><small className="text-[12px] font-semibold text-muted">of {peso(SAMPLE_TARGET.targetCentavos)}</small></span>
            <Badge variant="soft">{peso(SAMPLE_TARGET.targetCentavos - SAMPLE_SALES_TODAY.totalCentavos)} to go</Badge>
          </>}>
          <div className="my-1.5 flex justify-center"><ProgressRing value={SAMPLE_TARGET.pct} size={124} thickness={11.5} label={`${SAMPLE_TARGET.pct}%`} labelSize={23} ariaLabel={`${SAMPLE_TARGET.pct}% of daily target`} /></div>
        </StatCard>
      </div>
      <SectionHeader className="mb-2.5 mt-[18px]" title="Bays" aside={`${busy} of ${views.length} busy`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {views.map((v) =>
          v.item ? (
            <ResourceCard key={v.bay.id} density="comfortable"
              icon={<IconTile size={56}><Icon3D name={serviceIcon(v.service)} size={38} /></IconTile>}
              eyebrow={`${v.bay.name} · Washing`} title={v.service} meta={v.item.plate ?? `#${v.item.queueNumber}`}
              progress={{ value: v.pct, label: `${v.minsLeft}m`, ariaLabel: `${v.bay.name}: ${v.minsLeft} minutes left` }} />
          ) : (
            <FreeBay key={v.bay.id} view={v} next={waiting[0]} comfortable />
          ),
        )}
      </div>
      <div className="mt-[18px] grid gap-5 pb-6 xl:grid-cols-[1.25fr_1fr_1fr]">
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[282px]">
          <CardHeader title={<>Sales today <SampleDataTag className="ml-1 align-middle" /></>} subtitle="By hour" action={<SegmentedControl label="Range" options={[{ value: "today", label: "Today" }, { value: "week", label: "Week" }]} />} />
          <BarChart className="mt-3.5" data={sampleHourlyDesktop} highlightIndex={2} tooltip="₱1,200" width={470} height={192} ariaLabel="Sample sales by hour" />
        </Card>
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[282px]">
          <CardHeader className="mb-1.5" title="Queue" subtitle={`${waiting.length} waiting`} />
          {waiting.length ? (
            <QueueList label="Waiting cars" items={waiting.slice(0, 4).map((q, i) => {
              const svc = data ? serviceNames(q.serviceIds, data.services) : "";
              return {
                id: q.id,
                leading: <Avatar name={svc || `#${q.queueNumber}`} preset={PRESETS[i % PRESETS.length]} size={36} />,
                title: svc || `Car #${q.queueNumber}`,
                subtitle: <><span className="font-mono">{q.plate ?? `#${q.queueNumber}`}</span> · {q.source === "booking" ? "River Mobile" : "Walk-in"}</>,
                trailing: `#${q.queueNumber}`,
              };
            })} />
          ) : <p className="pt-6 text-center text-[14px] font-medium text-muted">No cars waiting.</p>}
        </Card>
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 xl:h-[282px]">
          <CardHeader className="mb-1.5" title={<>Recent sales <SampleDataTag className="ml-1 align-middle" /></>} subtitle="Last 4" />
          <ul aria-label="Recent sales (sample)">
            {sampleRecentSales.map((r) => (
              <ListItem as="li" key={r.id} variant="row" leading={<IconTile size={40}><Icon3D name={r.icon} size={26} /></IconTile>} title={r.service} subtitle={r.detail}
                trailing={<span className="flex flex-col items-end leading-[1.3]"><b className="text-[14px] font-extrabold">{r.amount}</b><small className="text-[12px] font-medium text-muted">{r.time}</small></span>} />
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
