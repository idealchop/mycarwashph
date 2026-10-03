/**
 * SAMPLE DATA ONLY. Shown with a "Sample data" tag until the matching features are
 * built (sales record and daily targets arrive with Paid shop operations, Phase 2).
 * None of these numbers are real.
 */
export const SAMPLE_SALES_TODAY = { totalCentavos: 535_000, cars: 18, changeLabel: "+12% vs last week" };
export const SAMPLE_TARGET = { targetCentavos: 750_000, pct: 71 };

export const sampleHourlyPhone = [420, 650, 1200, 800, 980, 700, 600].map((value, i) => ({
  value,
  label: ["7a", "8a", "9a", "10a", "11a", "12p", "1p"][i]!,
}));

export const sampleHourlyDesktop = [420, 650, 1200, 800, 980, 700, 600, 450, 380].map((value, i) => ({
  value,
  label: ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM"][i]!,
}));

export const sampleRecentSales = [
  { id: "r1", icon: "bubbles", service: "Regular Wash", detail: "XYZ 9876 · Cash", amount: "₱250", time: "9:58 AM" },
  { id: "r2", icon: "vacuum", service: "Wash + Vacuum", detail: "GHJ 1122 · QR Ph", amount: "₱350", time: "9:41 AM" },
  { id: "r3", icon: "sparkle", service: "Full Detail", detail: "RTY 5566 · QR Ph", amount: "₱1,200", time: "9:05 AM" },
  { id: "r4", icon: "bubbles", service: "Regular Wash", detail: "BNM 3344 · Cash", amount: "₱250", time: "8:40 AM" },
] as const;
