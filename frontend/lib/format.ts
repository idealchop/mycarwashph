/** Formatting helpers. Shop-facing times are always shown in Philippine time. */
const TZ = "Asia/Manila";

export const peso = (centavos: number | null | undefined) =>
  centavos == null ? "" : `₱${(centavos / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

export const timePHT = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export const dayKeyPHT = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const longDatePHT = (d: Date) =>
  d.toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });

export function greeting(d = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(d));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Next 5 days starting yesterday, for the schedule strip. */
export function weekStrip(now: Date, counts: Record<string, number>) {
  return [-1, 0, 1, 2, 3].map((offset) => {
    const d = new Date(now.getTime() + offset * 86_400_000);
    const key = dayKeyPHT(d);
    return {
      key,
      weekday: d.toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short" }),
      day: Number(key.slice(8)),
      count: counts[key] ?? 0,
    };
  });
}
