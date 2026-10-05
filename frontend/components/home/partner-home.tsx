"use client";

import { CarIllustration, Icon3D } from "@river-apps/icons";
import {
  Avatar, Badge, Button, Card, DateStrip, EmptyState, HeroBanner, IconButton, IconTile, ListItem, MonoText, SectionHeader, Topbar,
} from "@river-apps/ui";
import { Bell, Check, LogOut, ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ShopPageFrame } from "@/components/shop/page-frame";
import { ShopShell } from "@/components/shop/shop-shell";
import { api, type Booking, type MeResponse, type Service } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { dayKeyPHT, peso, timePHT, weekStrip } from "@/lib/format";
import { bookingPrice, serviceIcon, serviceNames } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";
import { firstName, Greeting } from "./common";

const PRESETS = ["rose", "mint", "butter", "lilac", "peach", "indigo"] as const;
const STATUS_LABEL: Record<string, string> = {
  requested: "New request",
  accepted: "Accepted",
  checked_in: "Checked in",
  completed: "Served",
};

/** Partner home: River Mobile bookings — phone stack + desktop multi-column. */
export function PartnerHome({ me, shop }: { me: MeResponse; shop: MeResponse["businesses"][number] }) {
  const { data, error, reload } = useLoad(
    () =>
      Promise.all([
        api<{ data: Booking[] }>(`/businesses/${shop.id}/bookings`),
        api<{ data: Service[] }>(`/businesses/${shop.id}/services`),
      ]),
    shop.id,
  );
  const bookings = data ? data[0].data : null;
  const services = data ? data[1].data : [];
  const [now] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dayKeyPHT(new Date()));

  async function act(id: string, action: "accept" | "decline") {
    await api(`/businesses/${shop.id}/bookings/${id}/${action}`, { method: "POST" });
    reload();
  }

  const active = useMemo(
    () => (bookings ?? []).filter((b) => ["requested", "accepted", "checked_in"].includes(b.status)),
    [bookings],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of active) c[dayKeyPHT(new Date(b.scheduledStart))] = (c[dayKeyPHT(new Date(b.scheduledStart))] ?? 0) + 1;
    return c;
  }, [active]);
  const dayList = active
    .filter((b) => dayKeyPHT(new Date(b.scheduledStart)) === selected)
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const newCount = active.filter((b) => b.status === "requested").length;
  const isToday = selected === dayKeyPHT(now);
  const name = firstName(me.user.name, shop.name);

  const props = {
    me, shop, bookings, services, error, dayList, counts, selected, setSelected, now, isToday, newCount, name, act,
  };

  return (
    <ShopShell plan="partner" newBookings={newCount} waiting={0} mobileTab="home">
      <div className="lg:hidden"><PartnerPhone {...props} /></div>
      <div className="hidden min-w-0 lg:block">
        <ShopPageFrame wide className="!pt-0 lg:!pt-0">
          <PartnerDesktop {...props} />
        </ShopPageFrame>
      </div>
    </ShopShell>
  );
}

type Props = {
  me: MeResponse;
  shop: MeResponse["businesses"][number];
  bookings: Booking[] | null;
  services: Service[];
  error: string | null;
  dayList: Booking[];
  counts: Record<string, number>;
  selected: string;
  setSelected: (k: string) => void;
  now: Date;
  isToday: boolean;
  newCount: number;
  name: string;
  act: (id: string, action: "accept" | "decline") => Promise<void>;
};

function BookingCard({ b, i, services, act }: { b: Booking; i: number; services: Service[]; act: Props["act"] }) {
  const price = bookingPrice(b.serviceIds, b.vehicleSize, services);
  const svc = serviceNames(b.serviceIds, services);
  return (
    <ListItem
      leading={<IconTile><Icon3D name={serviceIcon(svc)} size={34} /></IconTile>}
      title={svc}
      subtitle={<>{timePHT(b.scheduledStart)}{b.plate ? <> · <MonoText>{b.plate}</MonoText></> : null}</>}
      trailing={price != null ? <span className="text-[16px] font-extrabold">{peso(price)}</span> : <Badge variant="soft">{b.reference}</Badge>}
      footer={
        <>
          <span className="flex items-center gap-[11px]">
            <Avatar name={b.customerSnapshot.name} preset={PRESETS[i % PRESETS.length]} size={30} />
            <span className="flex flex-col leading-[1.2]">
              <b className="text-[13.5px]">{b.customerSnapshot.name}</b>
              <small className="text-[12px] font-semibold text-muted">{STATUS_LABEL[b.status] ?? b.status}</small>
            </span>
          </span>
          {b.status === "requested" ? (
            <span className="flex items-center gap-2">
              <IconButton size="md" label="Decline" icon={<X size={18} strokeWidth={1.75} />} className="size-10 text-muted" onClick={() => void act(b.id, "decline")} />
              <Button size="sm" pill className="h-10 px-4 text-[14px]" leadingIcon={<Check size={17} strokeWidth={2.2} />} onClick={() => void act(b.id, "accept")}>Accept</Button>
            </span>
          ) : null}
        </>
      }
    />
  );
}

function PartnerPhone({ me, shop, bookings, services, error, dayList, counts, selected, setSelected, now, isToday, newCount, act }: Props) {
  return (
    <div className="shop-phone pb-4">
      <Greeting title={`Hi, ${firstName(me.user.name, shop.name)} 👋`} name={me.user.name ?? shop.name} alerts={newCount} />
      <HeroBanner
        className="mt-3"
        eyebrow="River Mobile"
        title="Scan River Mobile customers"
        description="Check in bookings fast."
        contentWidth={184}
        actions={<Button href="/scan" variant="white" size="md" className="h-11 px-4 text-[14.5px]" leadingIcon={<ScanLine size={20} strokeWidth={1.75} />}>Scan customer</Button>}
        illustration={<CarIllustration size={214} />}
        illustrationClassName="-right-[58px] bottom-3"
      />
      <SectionHeader className="shop-section-title" title="Schedule" aside={now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", year: "numeric" })} />
      <DateStrip className="px-0" items={weekStrip(now, counts)} selectedKey={selected} onSelect={setSelected} />
      <SectionHeader className="shop-section-title" title={isToday ? "Today" : "Bookings"} aside={`${dayList.length} booking${dayList.length === 1 ? "" : "s"}`} />
      <div className="shop-stack pb-28">
        {error ? <p role="alert" className="px-1 text-[14px] font-semibold">{error}</p> : null}
        {bookings === null && !error ? <p className="px-1 text-[14px] font-medium text-muted">Loading bookings…</p> : null}
        {bookings !== null && dayList.length === 0 ? (
          <EmptyState
            illustration={<Icon3D name="car" size={64} />}
            title="No bookings yet"
            description={shop.role === "owner" ? "Turn on River Mobile listing in your shop profile so customers can book you." : "New River Mobile bookings will show up here."}
          />
        ) : null}
        {dayList.map((b, i) => <BookingCard key={b.id} b={b} i={i} services={services} act={act} />)}
      </div>
    </div>
  );
}

function PartnerDesktop({ me, shop, bookings, services, error, dayList, counts, selected, setSelected, now, isToday, newCount, name, act }: Props) {
  const router = useRouter();
  return (
    <>
      <Topbar
        title={`Hi ${name}, here’s today`}
        subtitle={<>{now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric" })} · {shop.name}</>}
        actions={
          <>
            <IconButton variant="surface" label="Notifications" count={newCount || undefined} onClick={() => router.push("/messages")} icon={<Bell size={20} strokeWidth={1.75} />} />
            <Button href="/scan" size="sm" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan customer</Button>
            <IconButton variant="surface" label="Sign out" icon={<LogOut size={20} strokeWidth={1.75} />} onClick={() => signOut()} />
            <Avatar name={me.user.name ?? name} preset="sky" size={44} />
          </>
        }
      />
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <HeroBanner
          size="lg"
          eyebrow="River Mobile"
          title="Scan River Mobile customers"
          titleSize="lg"
          description={<>{newCount} new booking{newCount === 1 ? "" : "s"} to review · Partner plan</>}
          contentWidth={360}
          actions={
            <>
              <Button href="/scan" variant="white" size="md" leadingIcon={<ScanLine size={18} strokeWidth={1.75} />}>Scan customer</Button>
              <Button href="/bookings" variant="ghost-inverse" size="md">All bookings</Button>
            </>
          }
          illustration={<CarIllustration size={320} />}
          illustrationClassName="right-[12px] bottom-1.5 hidden md:block"
        />
        <Card className="flex flex-col justify-center px-5 py-6">
          <b className="text-[16px]">Schedule</b>
          <p className="mt-1 text-[13.5px] font-medium text-muted">
            {now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", year: "numeric" })}
          </p>
          <DateStrip className="mt-4" items={weekStrip(now, counts)} selectedKey={selected} onSelect={setSelected} />
        </Card>
      </div>
      <SectionHeader
        className="mb-3 mt-6"
        title={isToday ? "Today’s bookings" : "Bookings"}
        aside={`${dayList.length} booking${dayList.length === 1 ? "" : "s"}`}
      />
      {error ? <p role="alert" className="mb-3 text-[14px] font-semibold">{error}</p> : null}
      {bookings === null && !error ? <p className="text-[14px] font-medium text-muted">Loading bookings…</p> : null}
      {bookings !== null && dayList.length === 0 ? (
        <EmptyState
          className="mt-2"
          illustration={<Icon3D name="car" size={64} />}
          title="No bookings yet"
          description={shop.role === "owner" ? "Turn on River Mobile listing in Settings so customers can book you." : "New River Mobile bookings will show up here."}
        />
      ) : (
        <div className="grid gap-4 pb-8 sm:grid-cols-2 xl:grid-cols-3">
          {dayList.map((b, i) => <BookingCard key={b.id} b={b} i={i} services={services} act={act} />)}
        </div>
      )}
    </>
  );
}
