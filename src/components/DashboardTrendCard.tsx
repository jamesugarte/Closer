"use client";

import Link from "next/link";
import { Card } from "./ui/card";
import type { BalanceSnapshot } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

/**
 * Compact liquid + freedom sparklines for the Home health dashboard.
 * Full story lives on Analytics.
 */
export function DashboardTrendCard({
  history,
}: {
  history: BalanceSnapshot[];
}) {
  if (history.length === 0) {
    return (
      <Card className="space-y-2 py-3.5">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Trends
        </p>
        <p className="text-sm text-[var(--muted)]">
          Advance months with the Master Key (top right) to extend these charts.
        </p>
      </Card>
    );
  }

  const latest = history[history.length - 1];
  const first = history[0];
  const chartW = 280;
  const chartH = 48;

  function polyline(
    values: number[],
    pad = 4
  ): string {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(max - min, 1);
    return values
      .map((v, i) => {
        const x =
          values.length === 1 ? chartW / 2 : (i / (values.length - 1)) * chartW;
        const y = chartH - ((v - min) / span) * (chartH - pad * 2) - pad;
        return `${x},${y}`;
      })
      .join(" ");
  }

  const liquidLine = polyline(history.map((h) => h.liquidAssets));
  const freedomLine = polyline(history.map((h) => h.financialFreedomScore));
  const liquidDelta = latest.liquidAssets - first.liquidAssets;
  const scoreDelta =
    latest.financialFreedomScore - first.financialFreedomScore;

  return (
    <Card className="space-y-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Snapshot trends
          </p>
          <p className="font-display text-lg font-semibold tracking-tight">
            Liquid & freedom over time
          </p>
        </div>
        <Link
          href="/analytics"
          className="shrink-0 text-xs font-semibold text-[var(--accent-deep)]"
        >
          Full view →
        </Link>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--muted)]">Liquid assets</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(latest.liquidAssets)}
            <span className="ml-1 font-medium text-[var(--muted)]">
              {liquidDelta >= 0 ? `+${formatMoney(liquidDelta)}` : formatMoney(liquidDelta)}
            </span>
          </span>
        </div>
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="h-12 w-full"
          role="img"
          aria-label="Liquid assets over time"
        >
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={liquidLine}
          />
        </svg>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--muted)]">Freedom score</span>
          <span className="font-semibold tabular-nums">
            {latest.financialFreedomScore}/100
            <span className="ml-1 font-medium text-[var(--muted)]">
              {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}
            </span>
          </span>
        </div>
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="h-12 w-full"
          role="img"
          aria-label="Freedom score over time"
        >
          <polyline
            fill="none"
            stroke="var(--accent-deep)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={freedomLine}
          />
        </svg>
      </div>
    </Card>
  );
}
