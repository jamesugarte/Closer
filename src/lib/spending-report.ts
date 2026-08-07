/**
 * Credit-card-style spending report — roll ledger + bill activity into
 * categories for a month or year window relative to the demo clock.
 */

import type { ActivityItem, Transaction, TxCategory } from "./types";
import { parseLocalDate, toISODate } from "./utils";

export type ReportPeriod = "month" | "year";

export const CATEGORY_LABELS: Record<TxCategory, string> = {
  transport: "Transport & rideshare",
  food: "Food & delivery",
  coffee: "Coffee & cafés",
  social: "Social & nightlife",
  education: "Education",
  shopping: "Shopping",
  health: "Health",
  auto: "Auto & parking",
  subscriptions: "Subscriptions",
  income: "Income",
  transfer: "Transfers",
  other: "Bills & other",
};

/** Display order for spend categories (income separate). */
export const SPEND_CATEGORY_ORDER: TxCategory[] = [
  "food",
  "transport",
  "social",
  "coffee",
  "shopping",
  "subscriptions",
  "education",
  "health",
  "auto",
  "other",
  "transfer",
];

export interface CategoryBucket {
  category: TxCategory;
  label: string;
  /** Absolute dollars spent (positive) */
  spent: number;
  /** Absolute dollars received (positive) — mainly income */
  received: number;
  count: number;
  shareOfSpend: number;
  transactions: Transaction[];
  unforeseenCount: number;
}

export interface SpendingReport {
  period: ReportPeriod;
  /** Inclusive range labels */
  rangeStart: string;
  rangeEnd: string;
  periodLabel: string;
  /** ISO date when filtered to a single day; null = whole period */
  selectedDate: string | null;
  totalSpent: number;
  totalIncome: number;
  net: number;
  txCount: number;
  shockSpend: number;
  categories: CategoryBucket[];
  /** Top merchants by spend in the window */
  topMerchants: { merchant: string; amount: number; count: number }[];
}

export function periodBounds(
  demoToday: string,
  period: ReportPeriod
): { start: string; end: string; label: string } {
  const end = parseLocalDate(demoToday);
  const start = parseLocalDate(demoToday);

  if (period === "month") {
    start.setDate(1);
    const label = end.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return { start: toISODate(start), end: demoToday, label };
  }

  // Year: trailing 12 months ending demoToday (statement-style)
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() + 1);
  const label = `${start.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })} – ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  return { start: toISODate(start), end: demoToday, label };
}

function inRange(dateISO: string, start: string, end: string): boolean {
  return dateISO >= start && dateISO <= end;
}

function categoryForActivity(item: ActivityItem): TxCategory {
  switch (item.kind) {
    case "paycheck":
      return "income";
    case "unforeseen":
      if (/tire|auto|parking/i.test(item.title + item.detail)) return "auto";
      if (/textbook|book|tuition/i.test(item.title + item.detail))
        return "education";
      if (/health|clinic|rx|pharmacy/i.test(item.title + item.detail))
        return "health";
      return "other";
    case "venmo":
      return "social";
    case "contribution":
    case "reallocation":
    case "good_job_bonus":
      return "transfer";
    case "purchase":
      return "shopping";
    case "living_spend":
      if (/obligation|bills|housing|tuition|meal/i.test(item.title + item.detail))
        return "other";
      return "food";
    default:
      return "other";
  }
}

/** Turn Closer's activity feed into statement rows (bills, paychecks, shocks). */
export function activityToLedgerRows(activity: ActivityItem[]): Transaction[] {
  return activity
    .filter(
      (a) =>
        a.amount != null &&
        a.amount !== 0 &&
        (a.kind === "living_spend" ||
          a.kind === "paycheck" ||
          a.kind === "unforeseen" ||
          a.kind === "venmo" ||
          a.kind === "purchase" ||
          a.kind === "contribution")
    )
    .map((a) => ({
      id: `ledger-${a.id}`,
      date: a.date,
      merchant: a.title,
      category: categoryForActivity(a),
      amount: a.amount as number,
      source: "Student Checking" as const,
      unforeseen: a.kind === "unforeseen",
      note: a.detail,
    }));
}

/**
 * Full statement ledger: card-style txs + monthly bill/income activity.
 * Dedupes by id.
 */
export function buildStatementLedger(
  transactions: Transaction[],
  activity: ActivityItem[] = []
): Transaction[] {
  const map = new Map<string, Transaction>();
  // Wallet ledger first — month sim already posts txs for income/bills/lifestyle
  for (const t of transactions) map.set(t.id, t);

  const seen = new Set(
    [...map.values()].map((t) => `${t.date}|${Math.round(t.amount * 100)}`)
  );
  // Only fold activity when no matching wallet tx (legacy seeds / tips)
  for (const row of activityToLedgerRows(activity)) {
    const key = `${row.date}|${Math.round(row.amount * 100)}`;
    if (seen.has(key)) continue;
    map.set(row.id, row);
    seen.add(key);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Distinct activity dates in a window, newest first — for the date dropdown. */
export function listActivityDates(
  transactions: Transaction[],
  demoToday: string,
  period: ReportPeriod,
  activity: ActivityItem[] = []
): { date: string; count: number; spent: number }[] {
  const ledger = buildStatementLedger(transactions, activity);
  const { start, end } = periodBounds(demoToday, period);
  const map = new Map<string, { count: number; spent: number }>();
  for (const t of ledger) {
    if (!inRange(t.date, start, end)) continue;
    const cur = map.get(t.date) ?? { count: 0, spent: 0 };
    cur.count += 1;
    if (t.amount < 0) cur.spent += Math.abs(t.amount);
    map.set(t.date, cur);
  }
  return [...map.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function buildSpendingReport(
  transactions: Transaction[],
  demoToday: string,
  period: ReportPeriod,
  /** Narrow to one calendar day within the period */
  selectedDate: string | null = null,
  activity: ActivityItem[] = []
): SpendingReport {
  const ledger = buildStatementLedger(transactions, activity);
  const { start, end, label } = periodBounds(demoToday, period);
  let inWindow = ledger.filter((t) => inRange(t.date, start, end));

  // Fallback: if the clock drifted ahead of the frozen ledger, show all history
  if (inWindow.length === 0 && ledger.length > 0 && !selectedDate) {
    inWindow = ledger;
  }

  if (selectedDate) {
    inWindow = ledger.filter((t) => t.date === selectedDate);
  }

  const periodLabel = selectedDate
    ? parseLocalDate(selectedDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : inWindow.length === ledger.length &&
        ledger.length > 0 &&
        !ledger.every((t) => inRange(t.date, start, end))
      ? "All available history"
      : label;

  const byCat = new Map<TxCategory, Transaction[]>();
  for (const t of inWindow) {
    const list = byCat.get(t.category) ?? [];
    list.push(t);
    byCat.set(t.category, list);
  }

  let totalSpent = 0;
  let totalIncome = 0;
  let shockSpend = 0;

  for (const t of inWindow) {
    if (t.amount < 0) {
      totalSpent += Math.abs(t.amount);
      if (t.unforeseen) shockSpend += Math.abs(t.amount);
    } else if (t.category === "income" || t.amount > 0) {
      totalIncome += t.amount;
    }
  }

  const categories: CategoryBucket[] = [];

  const allCats = new Set<TxCategory>([
    ...SPEND_CATEGORY_ORDER,
    ...byCat.keys(),
  ]);

  for (const category of allCats) {
    if (category === "income") continue;
    const txs = byCat.get(category) ?? [];
    if (txs.length === 0) continue;

    const spent = txs
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const received = txs
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    if (spent <= 0 && received <= 0) continue;

    categories.push({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      spent,
      received,
      count: txs.length,
      shareOfSpend: totalSpent > 0 ? spent / totalSpent : 0,
      transactions: [...txs].sort((a, b) => (a.date < b.date ? 1 : -1)),
      unforeseenCount: txs.filter((t) => t.unforeseen).length,
    });
  }

  categories.sort((a, b) => b.spent - a.spent);

  const incomeTxs = byCat.get("income") ?? [];
  if (incomeTxs.length > 0) {
    const received = incomeTxs
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    categories.push({
      category: "income",
      label: CATEGORY_LABELS.income,
      spent: 0,
      received,
      count: incomeTxs.length,
      shareOfSpend: 0,
      transactions: [...incomeTxs].sort((a, b) => (a.date < b.date ? 1 : -1)),
      unforeseenCount: 0,
    });
  }

  const merchantMap = new Map<string, { amount: number; count: number }>();
  for (const t of inWindow) {
    if (t.amount >= 0) continue;
    const cur = merchantMap.get(t.merchant) ?? { amount: 0, count: 0 };
    cur.amount += Math.abs(t.amount);
    cur.count += 1;
    merchantMap.set(t.merchant, cur);
  }
  const topMerchants = [...merchantMap.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    period,
    rangeStart: start,
    rangeEnd: end,
    periodLabel,
    selectedDate: selectedDate,
    totalSpent,
    totalIncome,
    net: totalIncome - totalSpent,
    txCount: inWindow.length,
    shockSpend,
    categories,
    topMerchants,
  };
}
