/** Server-safe helpers for Philippine mobile numbers. */
/** Formats national digits as "917 123 4567". Strips a leading 0 or 63. */
export function formatPhilippineMobile(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("63")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(" ");
}
/** Returns the E.164 number (+639171234567) or null when incomplete. */
export function toE164Philippines(input: string): string | null {
  const d = formatPhilippineMobile(input).replace(/\s/g, "");
  return d.length === 10 ? `+63${d}` : null;
}

