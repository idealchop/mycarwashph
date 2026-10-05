"use client";

import { CarIllustration, Icon3D, TyreIcon } from "@river-apps/icons";
import {
  Avatar, Badge, BarChart, Button, Card, CardHeader, EmptyState, HeroBanner, IconButton, IconTile, ListItem, ProgressRing,
  QueueList, ResourceCard, SearchInput, SectionHeader, StatCard, Topbar,
} from "@river-apps/ui";
import { ArrowRight, Bell, LogOut, Plus, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type Bay, type Booking, type MeResponse, type QueueItem, type SalesSummary, type Service } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { longDatePHT, peso, timePHT } from "@/lib/format";
import { serviceIcon, serviceNames } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";
import { firstName, Greeting } from "./common";

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
  return useLoad(async () => {
    const [bays, queue, services, bookings, summary] = await Promise.all([
      api<{ data: Bay[] }>(`/businesses/${shopId}/bays`),
      api<{ data: QueueItem[] }>(`/businesses/${shopId}/queue`),
      api<{ data: Service[] }>(`/businesses/${shopId}/services`),
      api<{ data: Booking[] }>(`/businesses/${shopId}/bookings?status=requested`),
      api<{ data: SalesSummary }>(`/businesses/${shopId}/sales/summary`),
    ]);
    return {
      bays: bays.data,
      queue: queue.data,
      services: services.data,
      bookings: bookings.data,
      summary: summary.data,
    };
  }, shopId);
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

function changeLabel(today: number, prev: number) {
  if (prev <= 0) return today > 0 ? "New today" : "—";
  const pct = Math.round(((today - prev) / prev) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs yesterday`;
}

/** 06 + 07 · Paid shop home with live sales, queue and bay assign. */
export function PaidHome({ me, shop }: { me: MeResponse; shop: MeResponse["businesses"][number] }) {
  const { data, error, reload } = useShopData(shop.id);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const views = data ? bayViews(data.bays, data.queue, data.services, now) : [];
  const waiting = (data?.queue ?? []).filter((q) => q.status === "queued");
  const busyCount = views.filter((v) => v.item).length;
  const name = firstName(me.user.name, "there");
  const target = shop.settings?.dailyTargetCentavos ?? null;
  const total = data?.summary.totalCentavos ?? 0;
  const cars = data?.summary.cars ?? 0;
  const targetPct = target && target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const hourly = (data?.summary.byHour ?? []).map((h) => ({
    value: Math.round(h.centavos / 100),
    label: h.label,
  }));
  const peak = hourly.reduce((best, h, i) => (h.value > (hourly[best]?.value ?? -1) ? i : best), 0);

  async function assign(bayId: string, queueItemId: string) {
    setBusy(true);
    try {
      await api(`/businesses/${shop.id}/queue/${queueItemId}`, { method: "PATCH", body: { status: "in_bay", bayId } });
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function walkIn() {
    setBusy(true);
    try {
      await api(`/businesses/${shop.id}/queue`, { method: "POST", body: { serviceIds: [], plate: null, vehicleSize: null } });
      router.push("/queue");
    } finally {
      setBusy(false);
    }
  }

  const props = { me, shop, data, error, views, waiting, busy: busyCount, name, total, cars, target, targetPct, hourly, peak, assign, walkIn, actionBusy: busy };

  return (
    <ShopShell plan="paid" newBookings={data?.bookings.length ?? 0} waiting={waiting.length} mobileTab="home">
      <div className="lg:hidden"><PaidPhone {...props} /></div>
      <div className="hidden min-w-0 lg:block"><PaidDesktop {...props} /></div>
    </ShopShell>
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
  total: number;
  cars: number;
  target: number | null;
  targetPct: number;
  hourly: { value: number; label: string }[];
  peak: number;
  assign: (bayId: string, queueItemId: string) => Promise<void>;
  walkIn: () => Promise<void>;
  actionBusy: boolean;
};

function FreeBay({ view, next, comfortable, onAssign, disabled }: { view: BayView; next?: QueueItem; comfortable?: boolean; onAssign?: () => void; disabled?: boolean }) {
  return (
    <ResourceCard
      density={comfortable ? "comfortable" : undefined}
      variant="inverse"
      icon={comfortable ? <IconTile size={56} tone="dark"><TyreIcon size={38} /></IconTile> : <TyreIcon size={38} />}
      eyebrow={<>{view.bay.name} · <b className="text-on-ink">Free</b></>}
      title={next ? (comfortable ? `Next: ${next.plate ?? `#${next.queueNumber}`}` : "Assign next car") : "No cars waiting"}
      meta={next ? (comfortable ? (next.source === "booking" ? "River Mobile" : "Walk-in") : next.plate ?? `#${next.queueNumber}`) : "Queue is empty"}
      action={next ? (comfortable
        ? <Button variant="white" size="sm" className="h-[34px] text-[12.5px]" disabled={disabled} onClick={onAssign} trailingIcon={<ArrowRight size={15} strokeWidth={2.2} />}>Assign</Button>
        : <IconButton variant="white" label={`Assign next car to ${view.bay.name}`} className="size-[34px]" disabled={disabled} onClick={onAssign} icon={<ArrowRight size={20} strokeWidth={2.2} />} />) : undefined}
    />
  );
}

function PaidPhone({ me, shop, data, error, views, waiting, busy, name, total, cars, target, targetPct, hourly, peak, assign, walkIn, actionBusy }: Props) {
  return (
    <div className="mx-auto max-w-[440px] pt-3">
      <Greeting title={shop.name} name={me.user.name ?? name} alerts={data?.bookings.length ?? 0} />
      <HeroBanner
        className="mx-4 mt-2"
        size="sm"
        eyebrow={<>Today · {longDatePHT(new Date())}</>}
        title={<>{peso(total)} · {cars} cars</>}
        description={<>{cars} cars washed · {waiting.length} waiting</>}
        actions={<Button href="/scan" variant="white" size="sm" className="h-[42px] px-4 text-[14.5px]" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan customer</Button>}
        illustration={<CarIllustration size={200} />}
      />
      {error ? <p role="alert" className="mx-4 mt-3 text-[14px] font-semibold">{error}</p> : null}
      <StatCard className="mx-4 mt-2.5" label="Sales today" value={peso(total)} trailing={<Badge variant="soft">{changeLabel(total, data?.summary.previousDayTotalCentavos ?? 0)}</Badge>}>
        {hourly.length ? (
          <BarChart className="mt-1" data={hourly} highlightIndex={peak} tooltip={peso((hourly[peak]?.value ?? 0) * 100)} width={318} height={100} ariaLabel="Sales by hour" />
        ) : (
          <p className="mt-2 text-[13px] font-medium text-muted">No sales recorded yet today.</p>
        )}
      </StatCard>
      {target != null ? (
        <StatCard className="mx-4 mt-2.5" label="Daily target" footer={<>
          <span className="flex flex-col leading-[1.2]"><b className="text-[17px] font-extrabold">{peso(total)}</b><small className="text-[12px] font-semibold text-muted">of {peso(target)}</small></span>
          <Badge variant="soft">{peso(Math.max(0, target - total))} to go</Badge>
        </>}>
          <div className="my-1.5 flex justify-center"><ProgressRing value={targetPct} size={100} thickness={10} label={`${targetPct}%`} labelSize={20} ariaLabel={`${targetPct}% of daily target`} /></div>
        </StatCard>
      ) : (
        <p className="mx-4 mt-2 text-[13px] font-medium text-muted">Set a daily target in <a className="underline" href="/settings">Settings</a>.</p>
      )}
      <SectionHeader className="px-5 pb-2 pt-5" title="Bays" aside={`${busy} of ${views.length} busy`} />
      <div className="flex flex-col gap-2.5 px-4">
        {views.map((v) =>
          v.item ? (
            <ResourceCard key={v.bay.id}
              icon={<IconTile><Icon3D name={serviceIcon(v.service)} size={34} /></IconTile>}
              eyebrow={`${v.bay.name} · Washing`} title={v.service} meta={v.item.plate ?? `#${v.item.queueNumber}`}
              progress={{ value: v.pct, label: `${v.minsLeft}m`, ariaLabel: `${v.bay.name}: ${v.minsLeft} minutes left` }} />
          ) : (
            <FreeBay key={v.bay.id} view={v} next={waiting[0]} disabled={actionBusy} onAssign={waiting[0] ? () => void assign(v.bay.id, waiting[0]!.id) : undefined} />
          ),
        )}
      </div>
      <SectionHeader className="px-5 pb-2 pt-5" title="Queue" aside={<Button size="sm" variant="ghost" href="/queue">Open</Button>} />
      <div className="px-4 pb-28">
        {waiting.length === 0 ? <p className="text-[14px] font-medium text-muted">No cars waiting. <button type="button" className="font-bold underline" disabled={actionBusy} onClick={() => void walkIn()}>Add walk-in</button></p> : (
          <QueueList label="Waiting" items={waiting.slice(0, 4).map((q, i) => ({
            id: q.id,
            leading: <Avatar name={q.plate ?? `#${q.queueNumber}`} preset={PRESETS[i % PRESETS.length]} size={36} />,
            title: data ? serviceNames(q.serviceIds, data.services) || `Car #${q.queueNumber}` : `#${q.queueNumber}`,
            subtitle: <><span className="font-mono">{q.plate ?? `#${q.queueNumber}`}</span></>,
            trailing: `#${q.queueNumber}`,
          }))} />
        )}
      </div>
    </div>
  );
}

function PaidDesktop({ me, shop, data, error, views, waiting, busy, name, total, cars, target, targetPct, hourly, peak, assign, walkIn, actionBusy }: Props) {
  const router = useRouter();
  const recent = data?.summary.recent ?? [];
  return (
    <>
      <Topbar
        title={`Hi ${name}, here’s today`}
        subtitle={<>{new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" })} · {shop.name}</>}
        actions={<>
          <SearchInput className="hidden w-[300px] md:flex" placeholder="Search plate or customer" label="Search plate or customer" />
          <IconButton variant="surface" label="Notifications" count={data?.bookings.length || undefined} onClick={() => router.push("/messages")} icon={<Bell {...ic} />} />
          <IconButton variant="surface" label="Sign out" icon={<LogOut {...ic} />} onClick={() => signOut()} />
          <Avatar name={me.user.name ?? name} preset="sky" size={44} />
        </>}
      />
      {error ? <p role="alert" className="mt-3 text-[14px] font-semibold">{error}</p> : null}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_286px]">
        <HeroBanner
          size="lg"
          eyebrow={<>Today · {longDatePHT(new Date())}</>}
          title={<>Today: {peso(total)} · {cars} cars</>}
          titleSize="lg"
          description={<>{waiting.length} cars waiting · {data?.bookings.length ?? 0} new River Mobile bookings</>}
          contentWidth={440}
          actions={<>
            <Button href="/scan" variant="white" size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan customer</Button>
            <Button variant="ghost-inverse" size="md" disabled={actionBusy} onClick={() => void walkIn()} leadingIcon={<Plus size={18} strokeWidth={1.75} />}>Add walk-in</Button>
          </>}
          illustration={<CarIllustration size={372} />}
          illustrationClassName="right-[18px] bottom-1.5 hidden md:block"
        />
        {target != null ? (
          <StatCard className="px-5 pb-4 pt-[18px]" layout="title" label="Daily target"
            footer={<>
              <span className="flex flex-col leading-[1.2]"><b className="text-[17px] font-extrabold">{peso(total)}</b><small className="text-[12px] font-semibold text-muted">of {peso(target)}</small></span>
              <Badge variant="soft">{peso(Math.max(0, target - total))} to go</Badge>
            </>}>
            <div className="my-1.5 flex justify-center"><ProgressRing value={targetPct} size={124} thickness={11.5} label={`${targetPct}%`} labelSize={23} ariaLabel={`${targetPct}% of daily target`} /></div>
          </StatCard>
        ) : (
          <Card className="flex flex-col justify-center px-5 py-6">
            <b className="text-[16px]">Set a daily target</b>
            <p className="mt-1 text-[13.5px] font-medium text-muted">Owners can edit this in Settings.</p>
            <Button className="mt-3" size="sm" href="/settings">Open Settings</Button>
          </Card>
        )}
      </div>
      <SectionHeader className="mb-2.5 mt-[18px]" title="Bays" aside={`${busy} of ${views.length} busy`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {views.map((v) =>
          v.item ? (
            <ResourceCard key={v.bay.id} density="comfortable"
              icon={<IconTile size={56}><Icon3D name={serviceIcon(v.service)} size={38} /></IconTile>}
              eyebrow={`${v.bay.name} · Washing`} title={v.service} meta={v.item.plate ?? `#${v.item.queueNumber}`}
              progress={{ value: v.pct, label: `${v.minsLeft}m`, ariaLabel: `${v.bay.name}: ${v.minsLeft} minutes left` }} />
          ) : (
            <FreeBay key={v.bay.id} view={v} next={waiting[0]} comfortable disabled={actionBusy} onAssign={waiting[0] ? () => void assign(v.bay.id, waiting[0]!.id) : undefined} />
          ),
        )}
      </div>
      <div className="mt-[18px] grid gap-5 pb-6 lg:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr]">
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 lg:min-h-[282px]">
          <CardHeader title="Sales today" subtitle="By hour" />
          {hourly.length ? (
            <BarChart className="mt-3.5" data={hourly} highlightIndex={peak} tooltip={peso((hourly[peak]?.value ?? 0) * 100)} width={470} height={192} ariaLabel="Sales by hour" />
          ) : (
            <EmptyState className="mt-8" title="No sales yet" description="Record payment on the Queue page." />
          )}
        </Card>
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 lg:min-h-[282px]">
          <CardHeader className="mb-1.5" title="Queue" subtitle={`${waiting.length} waiting`} action={<Button size="sm" variant="ghost" href="/queue">Open</Button>} />
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
        <Card padding="none" className="px-[18px] pb-2.5 pt-4 lg:min-h-[282px]">
          <CardHeader className="mb-1.5" title="Recent sales" subtitle="Today" action={<Button size="sm" variant="ghost" href="/sales">All</Button>} />
          {recent.length === 0 ? <p className="pt-6 text-center text-[14px] font-medium text-muted">No sales yet today.</p> : (
            <ul aria-label="Recent sales">
              {recent.slice(0, 4).map((r) => (
                <ListItem as="li" key={r.id} variant="row"
                  leading={<IconTile size={40}><Icon3D name="bubbles" size={26} /></IconTile>}
                  title={r.customerName ?? r.plate ?? "Sale"}
                  subtitle={`${r.method.toUpperCase()}${r.paymentRef ? ` · ${r.paymentRef}` : ""}`}
                  trailing={<span className="flex flex-col items-end leading-[1.3]"><b className="text-[14px] font-extrabold">{peso(r.amountCentavos)}</b><small className="text-[12px] font-medium text-muted">{timePHT(r.paidAt)}</small></span>} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
