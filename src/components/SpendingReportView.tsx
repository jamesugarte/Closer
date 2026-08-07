"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Coffee,
  GraduationCap,
  Car,
  Heart,
  ShoppingBag,
  Utensils,
  Bus,
  PartyPopper,
  Repeat,
  ArrowLeftRight,
  CircleDot,
  Banknote,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  buildSpendingReport,
  listActivityDates,
  type CategoryBucket,
  type ReportPeriod,
} from "@/lib/spending-report";
import type { Transaction, TxCategory } from "@/lib/types";
import { cn, formatLongDate, formatMoney } from "@/lib/utils";

const CATEGORY_ICONS: Partial<
  Record<TxCategory, React.ComponentType<{ className?: string }>>
> = {
  food: Utensils,
  transport: Bus,
  coffee: Coffee,
  social: PartyPopper,
  shopping: ShoppingBag,
  education: GraduationCap,
  health: Heart,
  auto: Car,
  subscriptions: Repeat,
  transfer: ArrowLeftRight,
  income: Banknote,
  other: CircleDot,
};

const BAR_COLORS: Partial<Record<TxCategory, string>> = {
  food: "bg-orange-400",
  transport: "bg-sky-500",
  coffee: "bg-amber-700",
  social: "bg-violet-400",
  shopping: "bg-pink-400",
  education: "bg-indigo-400",
  health: "bg-rose-400",
  auto: "bg-slate-500",
  subscriptions: "bg-teal-500",
  transfer: "bg-zinc-400",
  other: "bg-stone-400",
  income: "bg-emerald-500",
};

interface SpendingReportViewProps {
  transactions: Transaction[];
  demoToday: string;
  studentName: string;
  activity?: import("@/lib/types").ActivityItem[];
}

export function SpendingReportView({
  transactions,
  demoToday,
  studentName,
  activity = [],
}: SpendingReportViewProps) {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<TxCategory | null>(null);

  const activityDates = useMemo(
    () => listActivityDates(transactions, demoToday, period, activity),
    [transactions, demoToday, period, activity]
  );

  // Drop selected date if it falls outside the new period
  const effectiveDate =
    selectedDate && activityDates.some((d) => d.date === selectedDate)
      ? selectedDate
      : null;

  const report = useMemo(
    () =>
      buildSpendingReport(
        transactions,
        demoToday,
        period,
        effectiveDate,
        activity
      ),
    [transactions, demoToday, period, effectiveDate, activity]
  );

  const spendCats = report.categories.filter((c) => c.category !== "income");
  const incomeCat = report.categories.find((c) => c.category === "income");

  function changePeriod(next: ReportPeriod) {
    setPeriod(next);
    setSelectedDate(null);
    setOpenCat(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-2xl border border-black/8 bg-white/70 p-1">
        <PeriodTab
          active={period === "month"}
          onClick={() => changePeriod("month")}
          label="This month"
        />
        <PeriodTab
          active={period === "year"}
          onClick={() => changePeriod("year")}
          label="Past 12 months"
        />
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          <CalendarDays className="h-3.5 w-3.5" />
          Activity by date
        </span>
        <div className="relative">
          <select
            className="w-full appearance-none rounded-2xl border border-black/10 bg-white/90 py-3 pl-4 pr-10 text-sm font-semibold text-foreground outline-none ring-accent focus:ring-2"
            value={effectiveDate ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedDate(v === "" ? null : v);
              setOpenCat(null);
            }}
          >
            <option value="">
              All dates in {period === "month" ? "this month" : "past 12 months"}
              {activityDates.length > 0
                ? ` (${activityDates.length} days with activity)`
                : ""}
            </option>
            {activityDates.map((d) => (
              <option key={d.date} value={d.date}>
                {formatLongDate(d.date)}
                {" — "}
                {d.count} tx
                {d.spent > 0 ? ` · ${formatMoney(d.spent)} spent` : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
      </label>

      <Card className="space-y-4 overflow-hidden py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Spending report
              {effectiveDate ? " · day" : ""}
            </p>
            <p className="font-display mt-0.5 text-lg font-semibold">
              {report.periodLabel}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {studentName} · {report.txCount} transaction
              {report.txCount === 1 ? "" : "s"}
              {effectiveDate
                ? " on this day"
                : period === "month"
                  ? " this month"
                  : " in range"}
            </p>
          </div>
          {effectiveDate && (
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setOpenCat(null);
              }}
              className="shrink-0 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-foreground"
            >
              Clear day
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <SummaryStat
            label="Spent"
            value={formatMoney(report.totalSpent)}
            tone="spend"
          />
          <SummaryStat
            label="Income"
            value={formatMoney(report.totalIncome)}
            tone="income"
          />
          <SummaryStat
            label="Net"
            value={`${report.net >= 0 ? "+" : ""}${formatMoney(report.net)}`}
            tone={report.net >= 0 ? "income" : "spend"}
          />
        </div>

        {report.shockSpend > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-snug text-rose-900/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {formatMoney(report.shockSpend)} tagged unforeseen in this period
            (not discretionary fun).
          </p>
        )}

        {/* Stacked composition bar */}
        {report.totalSpent > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Spend mix
            </p>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-black/[0.06]"
              role="img"
              aria-label="Spending by category"
            >
              {spendCats.map((c) => (
                <div
                  key={c.category}
                  className={cn(
                    "h-full transition-all",
                    BAR_COLORS[c.category] ?? "bg-zinc-400"
                  )}
                  style={{ width: `${Math.max(1.5, c.shareOfSpend * 100)}%` }}
                  title={`${c.label}: ${formatMoney(c.spent)}`}
                />
              ))}
            </div>
          </div>
        )}
      </Card>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          By category
        </h2>
        {spendCats.length === 0 && (
          <Card className="py-6 text-center text-sm text-muted">
            No spending in this period yet.
          </Card>
        )}
        {spendCats.map((cat) => (
          <CategoryRow
            key={cat.category}
            cat={cat}
            open={openCat === cat.category}
            onToggle={() =>
              setOpenCat((prev) =>
                prev === cat.category ? null : cat.category
              )
            }
          />
        ))}
        {incomeCat && (
          <CategoryRow
            cat={incomeCat}
            open={openCat === "income"}
            onToggle={() =>
              setOpenCat((prev) => (prev === "income" ? null : "income"))
            }
            income
          />
        )}
      </section>

      {report.topMerchants.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Top merchants
          </h2>
          <Card className="divide-y divide-black/[0.05] py-1">
            {report.topMerchants.map((m, i) => (
              <div
                key={m.merchant}
                className="flex items-center justify-between gap-3 px-1 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[11px] font-bold text-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.merchant}</p>
                    <p className="text-[11px] text-muted">
                      {m.count} charge{m.count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(m.amount)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function PeriodTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-accent text-white shadow-sm"
          : "text-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "spend" | "income";
}) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-2.5 py-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-display text-base font-semibold tabular-nums sm:text-lg",
          tone === "income" ? "text-emerald-700" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CategoryRow({
  cat,
  open,
  onToggle,
  income = false,
}: {
  cat: CategoryBucket;
  open: boolean;
  onToggle: () => void;
  income?: boolean;
}) {
  const Icon = CATEGORY_ICONS[cat.category] ?? CircleDot;
  const amount = income ? cat.received : cat.spent;

  return (
    <Card className="overflow-hidden py-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            income ? "bg-emerald-50 text-emerald-700" : "bg-black/[0.04]"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold">{cat.label}</p>
            <p
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                income ? "text-emerald-700" : "text-foreground"
              )}
            >
              {income ? "+" : ""}
              {formatMoney(amount)}
            </p>
          </div>
          {!income && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    BAR_COLORS[cat.category] ?? "bg-zinc-400"
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(4, cat.shareOfSpend * 100))}%`,
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-[10px] font-medium tabular-nums text-muted">
                {Math.round(cat.shareOfSpend * 100)}%
              </span>
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted">
            {cat.count} transaction{cat.count === 1 ? "" : "s"}
            {cat.unforeseenCount > 0
              ? ` · ${cat.unforeseenCount} unforeseen`
              : ""}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
        )}
      </button>

      {open && (
        <ul className="border-t border-black/[0.05] bg-black/[0.015] px-3.5 py-2">
          {cat.transactions.map((tx) => (
            <li
              key={tx.id}
              className="flex items-start justify-between gap-3 border-b border-black/[0.04] py-2.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{tx.merchant}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {formatLongDate(tx.date)} · {tx.source}
                  {tx.unforeseen && (
                    <span className="font-semibold text-rose-700">
                      {" "}
                      · unforeseen
                    </span>
                  )}
                </p>
                {tx.note && (
                  <p className="mt-0.5 text-[11px] text-muted">{tx.note}</p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  tx.amount > 0 ? "text-emerald-700" : "text-foreground"
                )}
              >
                {tx.amount > 0 ? "+" : ""}
                {formatMoney(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
