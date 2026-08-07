"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { Card } from "./ui/card";
import {
  HEALTH_BAND_STYLE,
  healthBandFromSnapshot,
  timePhraseForDollars,
  type HealthBand,
} from "@/lib/wallet-integrity";
import type { BalanceSnapshot } from "@/lib/types";
import { cn, formatLongDate, formatMoney } from "@/lib/utils";

/**
 * Interactive health-over-time calendar.
 * Students don't feel "$4,280" — they feel weeks of breathing room.
 * Each month cell is colored by wallet health (crisis → strong).
 */
export function HealthTimeCalendar({
  history,
  typicalDailyBurn,
  demoToday,
}: {
  history: BalanceSnapshot[];
  typicalDailyBurn: number;
  demoToday: string;
}) {
  const months = useMemo(() => {
    // One cell per unique YYYY-MM, prefer latest snapshot that month
    const byMonth = new Map<string, BalanceSnapshot>();
    for (const s of history) {
      const key = s.date.slice(0, 7);
      const prev = byMonth.get(key);
      if (!prev || s.date >= prev.date) byMonth.set(key, s);
    }
    return [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, snap]) => ({
        key,
        snap,
        band: healthBandFromSnapshot(snap),
        label: new Date(snap.date + "T12:00:00").toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
      }));
  }, [history]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected =
    months.find((m) => m.key === (selectedKey ?? months[months.length - 1]?.key)) ??
    null;

  if (months.length === 0) {
    return (
      <Card className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Time · financial health
        </p>
        <p className="text-sm text-[var(--muted)]">
          Advance months with the Master Key to paint this calendar.
        </p>
      </Card>
    );
  }

  const latest = months[months.length - 1];
  const first = months[0];
  const scoreDelta =
    latest.snap.financialFreedomScore - first.snap.financialFreedomScore;

  return (
    <Card className="space-y-3 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[var(--accent)]">
            <CalendarDays className="h-3.5 w-3.5" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]">
              Time = choice
            </p>
          </div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Health calendar
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            Tap a month. Color = health.
          </p>
        </div>
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white shadow-sm",
            HEALTH_BAND_STYLE[latest.band].fill
          )}
        >
          <span className="font-display text-lg font-bold leading-none">
            {latest.snap.financialFreedomScore}
          </span>
          <span className="text-[8px] font-semibold uppercase opacity-90">
            now
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {months.map((m) => {
          const active = selected?.key === m.key;
          const isToday = m.snap.date === demoToday || m.key === demoToday.slice(0, 7);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedKey(m.key)}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition",
                active
                  ? `ring-2 ${HEALTH_BAND_STYLE[m.band].ring} bg-black/[0.03]`
                  : "hover:bg-black/[0.03]"
              )}
              aria-label={`${m.label}: ${HEALTH_BAND_STYLE[m.band].label}`}
            >
              <span
                className={cn(
                  "h-7 w-7 rounded-full shadow-inner",
                  HEALTH_BAND_STYLE[m.band].fill,
                  isToday && "ring-2 ring-offset-1 ring-black/20"
                )}
              />
              <span className="text-[10px] font-semibold tabular-nums text-foreground/80">
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-[var(--muted)]">
        {(Object.keys(HEALTH_BAND_STYLE) as HealthBand[]).map((band) => (
          <span key={band} className="inline-flex items-center gap-1">
            <span
              className={cn("h-2.5 w-2.5 rounded-full", HEALTH_BAND_STYLE[band].fill)}
            />
            {HEALTH_BAND_STYLE[band].label}
          </span>
        ))}
      </div>

      {selected && (
        <div className="animate-soft-in space-y-2 rounded-xl border border-black/8 bg-gradient-to-br from-white to-black/[0.02] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              {formatLongDate(selected.snap.date)}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
                HEALTH_BAND_STYLE[selected.band].fill
              )}
            >
              {HEALTH_BAND_STYLE[selected.band].label}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <p className="text-sm font-medium leading-snug">
              Breathing room:{" "}
              {timePhraseForDollars(
                selected.snap.freeToSpend,
                typicalDailyBurn
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-black/[0.03] px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Freedom score
              </p>
              <p className="font-display text-base font-semibold">
                {selected.snap.financialFreedomScore}
              </p>
            </div>
            <div className="rounded-lg bg-black/[0.03] px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Free-to-spend
              </p>
              <p className="font-display text-base font-semibold">
                {formatMoney(selected.snap.freeToSpend)}
              </p>
            </div>
            <div className="rounded-lg bg-black/[0.03] px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Checking
              </p>
              <p className="font-display text-base font-semibold">
                {formatMoney(selected.snap.checking)}
              </p>
            </div>
            <div className="rounded-lg bg-black/[0.03] px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Monthly flow
              </p>
              <p
                className={cn(
                  "font-display text-base font-semibold",
                  (selected.snap.monthlyCashflow ?? 0) < 0
                    ? "text-rose-700"
                    : "text-emerald-800"
                )}
              >
                {selected.snap.monthlyCashflow == null
                  ? "—"
                  : formatMoney(selected.snap.monthlyCashflow)}
              </p>
            </div>
          </div>

          <p className="text-[11px] leading-snug text-[var(--muted)]">
            Wallet snapshot. Score {scoreDelta >= 0 ? "+" : ""}
            {scoreDelta} since {first.label}.
          </p>
        </div>
      )}
    </Card>
  );
}
