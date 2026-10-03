"use client";

import { CarIllustration, Icon3D } from "@river-apps/icons";
import {
  Avatar, Badge, Button, DateStrip, EmptyState, HeroBanner, IconButton, IconTile, ListItem, MobileTabBar, MonoText, SectionHeader,
} from "@river-apps/ui";
import { Check, ScanLine, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api, type Booking, type MeResponse, type Service } from "@/lib/api";
import { dayKeyPHT, peso, timePHT, weekStrip } from "@/lib/format";
import { bookingPrice, serviceIcon, serviceNames } from "@/lib/shop";
import { useLoad } from "@/lib/use-load";
import { firstName, Greeting, PARTNER_TABS } from "./common";

const PRESETS = ["rose", "mint", "butter", "lilac", "peach", "indigo"] as const;
const STATUS_LABEL: Record<string, string> = { requested: "New request", accepted: "Accepted", checked_in: "Checked in", completed: "Served" };

/** 04 · Partner home: River Mobile bookings (real data from the API) and Scan. */
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

  const active = useMemo(() => (bookings ?? []).filter((b) => ["requested", "accepted", "checked_in"].includes(b.status)), [bookings]);
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

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col pb-32 pt-3">
        <Greeting title={`Hi, ${firstName(me.user.name, shop.name)} 👋`} name={me.user.name ?? shop.name} alerts={newCount} />
        <HeroBanner
          className="mx-4 mt-2"
          eyebrow="River Mobile"
          title="Scan River Mobile customers"
          description="Check in bookings fast."
          contentWidth={184}
          actions={<Button href="/scan" variant="white" size="md" className="h-11 px-4 text-[14.5px]" leadingIcon={<ScanLine size={20} strokeWidth={1.75} />}>Scan customer</Button>}
          illustration={<CarIllustration size={214} />}
          illustrationClassName="-right-[58px] bottom-3"
        />
        <SectionHeader className="px-5 pb-3 pt-[22px]" title="Schedule" aside={now.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", year: "numeric" })} />
        <DateStrip className="px-5" items={weekStrip(now, counts)} selectedKey={selected} onSelect={setSelected} />
        <SectionHeader className="px-5 pb-3 pt-[18px]" title={isToday ? "Today" : "Bookings"} aside={`${dayList.length} booking${dayList.length === 1 ? "" : "s"}`} />
        <div className="flex flex-col gap-2.5 px-4">
          {error ? <p role="alert" className="px-1 text-[14px] font-semibold">{error}</p> : null}
          {bookings === null && !error ? <p className="px-1 text-[14px] font-medium text-muted">Loading bookings…</p> : null}
          {bookings !== null && dayList.length === 0 ? (
            <EmptyState
              illustration={<Icon3D name="car" size={64} />}
              title="No bookings yet"
              description={shop.role === "owner" ? "Turn on River Mobile listing in your shop profile so customers can book you." : "New River Mobile bookings will show up here."}
            />
          ) : null}
          {dayList.map((b, i) => {
            const price = bookingPrice(b.serviceIds, b.vehicleSize, services);
            const name = serviceNames(b.serviceIds, services);
            return (
              <ListItem
                key={b.id}
                leading={<IconTile><Icon3D name={serviceIcon(name)} size={34} /></IconTile>}
                title={name}
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
                        <IconButton size="md" label="Decline" icon={<X size={18} strokeWidth={1.75} />} className="size-10 text-muted" onClick={() => act(b.id, "decline")} />
                        <Button size="sm" pill className="h-10 px-4 text-[14px]" leadingIcon={<Check size={17} strokeWidth={2.2} />} onClick={() => act(b.id, "accept")}>Accept</Button>
                      </span>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </div>
        <MobileTabBar items={PARTNER_TABS} activeKey="home" className="mx-auto max-w-[408px]" />
      </div>
    </div>
  );
}
