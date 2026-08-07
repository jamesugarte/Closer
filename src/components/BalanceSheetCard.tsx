"use client";

import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Card } from "./ui/card";
import type { BalanceSnapshot } from "@/lib/types";
import { formatLongDate, formatMoney } from "@/lib/utils";

interface BalanceSheetCardProps {
  history: BalanceSnapshot[];
  monthsAdvanced: number;
}

/**
 * Overall finance tracker — liquid assets + freedom score over simulated months.
 *
 * Score weights (interview-transparent):
 *   35% cushion after bills · 20% free/pool · 30% goal funding · 15% risk health
 */
export function BalanceSheetCard({
  history,
  monthsAdvanced,
}: BalanceSheetCardProps) {
  const [howOpen, setHowOpen] = useState(false);

  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const first = history[0];
  const scoreDelta = latest.financialFreedomScore - first.financialFreedomScore;
  const liquidDelta = latest.liquidAssets - first.liquidAssets;

  const maxScore = Math.max(
    100,
    ...history.map((h) => h.financialFreedomScore)
  );
  const chartW = 280;
  const chartH = 56;
  const points = history.map((h, i) => {
    const x =
      history.length === 1 ? chartW / 2 : (i / (history.length - 1)) * chartW;
    const y = chartH - (h.financialFreedomScore / maxScore) * (chartH - 8) - 4;
    return `${x},${y}`;
  });
  const polyline = points.join(" ");

  return (
    <Card className="space-y-3 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
          <TrendingUp className="h-5 w-5 text-[var(--accent-deep)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Financial freedom
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-[var(--accent-deep)]">
            {latest.financialFreedomScore}
            <span className="ml-1 text-base font-medium text-[var(--muted)]">
              / 100
            </span>
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {monthsAdvanced <= 12
              ? "Freshman year on the books · advance with the Master Key to keep compounding"
              : scoreDelta >= 0
                ? `+${scoreDelta} since demo start · saving habit building room to breathe`
                : `${scoreDelta} since demo start · spending outpaced saving`}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="h-14 w-full overflow-visible"
        role="img"
        aria-label="Freedom score over time"
      >
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
        {history.map((h, i) => {
          const [x, y] = points[i].split(",").map(Number);
          return (
            <circle
              key={h.date + i}
              cx={x}
              cy={y}
              r={i === history.length - 1 ? 4 : 2.5}
              fill={
                i === history.length - 1 ? "var(--accent-deep)" : "var(--accent)"
              }
            />
          );
        })}
      </svg>

      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="rounded-2xl bg-black/[0.03] px-2 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Liquid
          </p>
          <p className="font-display text-sm font-semibold tabular-nums">
            {formatMoney(latest.liquidAssets)}
          </p>
          {monthsAdvanced > 0 && (
            <p className="text-[10px] text-[var(--muted)]">
              {liquidDelta >= 0 ? "+" : ""}
              {formatMoney(liquidDelta)}
            </p>
          )}
        </div>
        <div
          className={`rounded-2xl px-2 py-2 ${
            (latest.monthlyCashflow ?? 0) < 0 ? "bg-rose-50" : "bg-black/[0.03]"
          }`}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Cashflow / mo
          </p>
          <p
            className={`font-display text-sm font-semibold tabular-nums ${
              (latest.monthlyCashflow ?? 0) < 0 ? "text-rose-800" : ""
            }`}
          >
            {latest.monthlyCashflow != null
              ? formatMoney(latest.monthlyCashflow)
              : "—"}
          </p>
          {latest.liquidMonthly != null && (
            <p className="text-[10px] text-[var(--muted)]">
              {formatMoney(latest.liquidMonthly)} in −{" "}
              {formatMoney(latest.obligations)} bills
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-black/[0.03] px-2 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Goals held
          </p>
          <p className="font-display text-sm font-semibold tabular-nums">
            {formatMoney(latest.reservedTowardGoals)}
          </p>
        </div>
        <div className="rounded-2xl bg-black/[0.03] px-2 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Risk cushion
          </p>
          <p className="font-display text-sm font-semibold tabular-nums">
            {formatMoney(latest.riskReserve)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl bg-black/[0.03] px-3 py-2 text-left text-xs font-medium text-[var(--muted)]"
        aria-expanded={howOpen}
      >
        How this score is calculated
        {howOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {howOpen && (
        <div className="animate-soft-in space-y-2 px-1 text-[11px] leading-snug text-[var(--muted)]">
          <p>
            Weighted blend (capped 0–100). Each input is a 0–1 ratio, then scaled:
          </p>
          <ul className="space-y-1.5">
            <li className="flex justify-between gap-2">
              <span>
                <strong className="text-foreground">35%</strong> Cushion after
                bills — liquid ÷ ~2× monthly obligations
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>
                <strong className="text-foreground">20%</strong> Free share of
                pool — free-to-spend ÷ after-bills pool
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>
                <strong className="text-foreground">30%</strong> Goal progress —
                reserved toward goals ÷ active targets
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>
                <strong className="text-foreground">15%</strong> Risk health —
                cushion ÷ 1.5× monthly risk budget
              </span>
            </li>
          </ul>
          <p>
            As of {formatLongDate(latest.date)}: checking{" "}
            {formatMoney(latest.checking)} + goal reserves{" "}
            {formatMoney(latest.goalReserves)} + risk{" "}
            {formatMoney(latest.riskReserve)}. Monthly cashflow{" "}
            {latest.monthlyCashflow != null
              ? formatMoney(latest.monthlyCashflow)
              : "n/a"}{" "}
            = income − protected bills (can be negative). Free-to-spend is a
            separate stock of balances after bills.
          </p>
        </div>
      )}
    </Card>
  );
}
