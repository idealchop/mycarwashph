import { notFound } from "../lib/errors.js";
import { manilaDayKey } from "../lib/time.js";
import type { Sale } from "../models/types.js";
import type { Doc, DocStore } from "../store/doc-store.js";
import { writeAudit } from "./audit-service.js";
import { paths } from "./paths.js";

/** A shop expense (supplies, water, wages…). Shop-scoped under businesses/{id}/expenses; API-only. */
export interface Expense {
  amountCentavos: number;
  note: string;
  /** Manila calendar day YYYYMMDD the expense counts on. */
  date: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function createExpense(store: DocStore, businessId: string, input: { amountCentavos: number; note: string; date?: string }, uid: string, now: Date): Promise<Doc<Expense>> {
  const id = store.newId();
  const at = now.toISOString();
  const exp: Expense = { amountCentavos: input.amountCentavos, note: input.note, date: input.date ?? manilaDayKey(now), createdBy: uid, createdAt: at, updatedAt: at };
  await store.create(paths.expense(businessId, id), { ...exp });
  await writeAudit(store, businessId, { actor: { type: "user", id: uid }, action: "expense.create", target: paths.expense(businessId, id), meta: { amountCentavos: exp.amountCentavos } }, now);
  return { ...exp, id };
}

export async function deleteExpense(store: DocStore, businessId: string, expenseId: string, uid: string, now: Date) {
  // Tenant wall: the path is built from the caller's shop, so another shop's id is simply not found.
  if (!(await store.get(paths.expense(businessId, expenseId)))) throw notFound("Expense not found.");
  await store.delete(paths.expense(businessId, expenseId));
  await writeAudit(store, businessId, { actor: { type: "user", id: uid }, action: "expense.delete", target: paths.expense(businessId, expenseId), meta: {} }, now);
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WeekDay { date: string; dow: string; salesCentavos: number; cars: number; expensesCentavos: number; profitCentavos: number }
export interface FinanceWeek {
  from: string;
  to: string;
  days: WeekDay[];
  totals: { salesCentavos: number; cars: number; expensesCentavos: number; profitCentavos: number };
  expenses: Doc<Expense>[];
}

/** Mon–Sun week holding `dayKey`: sales, expenses and profit (sales − expenses) per day + totals. */
export async function financeWeek(store: DocStore, businessId: string, dayKey: string): Promise<FinanceWeek> {
  const noon = Date.parse(`${dayKey.slice(0, 4)}-${dayKey.slice(4, 6)}-${dayKey.slice(6, 8)}T12:00:00+08:00`);
  const monday = noon - ((new Date(noon).getUTCDay() + 6) % 7) * 86_400_000;
  const keys = Array.from({ length: 7 }, (_, i) => manilaDayKey(new Date(monday + i * 86_400_000)));
  const [sales, expenses] = await Promise.all([
    store.list<Sale>(paths.sales(businessId), { orderBy: { field: "paidAt", direction: "desc" }, limit: 1000 }),
    store.list<Expense>(paths.expenses(businessId), { orderBy: { field: "createdAt", direction: "desc" }, limit: 1000 }),
  ]);
  const weekExpenses = expenses.filter((e) => keys.includes(e.date));
  const days = keys.map((date, i) => {
    const s = sales.filter((x) => x.status === "recorded" && manilaDayKey(new Date(x.paidAt)) === date);
    const salesCentavos = s.reduce((t, x) => t + x.amountCentavos, 0);
    const expensesCentavos = weekExpenses.filter((e) => e.date === date).reduce((t, e) => t + e.amountCentavos, 0);
    return { date, dow: DOW[new Date(monday + i * 86_400_000).getUTCDay()]!, salesCentavos, cars: s.length, expensesCentavos, profitCentavos: salesCentavos - expensesCentavos };
  });
  const sum = (k: "salesCentavos" | "cars" | "expensesCentavos" | "profitCentavos") => days.reduce((t, d) => t + d[k], 0);
  return { from: keys[0]!, to: keys[6]!, days, totals: { salesCentavos: sum("salesCentavos"), cars: sum("cars"), expensesCentavos: sum("expensesCentavos"), profitCentavos: sum("profitCentavos") }, expenses: weekExpenses.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) };
}
