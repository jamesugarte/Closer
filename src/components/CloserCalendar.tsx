"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripHorizontal, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  daysGained,
  daysUntil,
  gapFitScore,
  paceGapToDate,
} from "@/lib/calculations";
import { DEMO_TODAY } from "@/lib/mock-data";
import type { Recommendation } from "@/lib/types";
import { cn, formatLongDate, formatMoney, parseLocalDate, toISODate } from "@/lib/utils";

interface CloserCalendarProps {
  originalDate: string;
  currentDate: string;
  isReady?: boolean;
  animateKey?: string;
  demoToday?: string;
  /** Nest inside GoalCloserCard — no outer card / no duplicate title */
  embedded?: boolean;
  fundedAmount?: number;
  targetPrice?: number;
  dailyContributionRate?: number;
  desiredDate?: string;
  onDesiredDateChange?: (iso: string) => void;
  recommendations?: Recommendation[];
  onAcceptRecommendation?: (id: string) => void;
  /** Hide tip list (parent may show AI card instead) */
  hideTips?: boolean;
}

function eachDay(fromISO: string, toISO: string): string[] {
  const days: string[] = [];
  const cur = parseLocalDate(fromISO);
  const end = parseLocalDate(toISO);
  for (let i = 0; i < 140 && cur <= end; i++) {
    days.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  if (days.length === 0) days.push(fromISO);
  return days;
}

function addDaysISO(iso: string, n: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/**
 * Interactive pace calendar — forecast pin + draggable “Need by”.
 * Live savings HUD shows only while dragging; resting state stays quiet.
 */
export function CloserCalendar({
  originalDate,
  currentDate,
  isReady,
  animateKey,
  embedded = false,
  demoToday = DEMO_TODAY,
  fundedAmount = 0,
  targetPrice = 0,
  dailyContributionRate = 3,
  desiredDate,
  onDesiredDateChange,
  recommendations = [],
  onAcceptRecommendation,
  hideTips = false,
}: CloserCalendarProps) {
  const displayCurrent = isReady ? demoToday : currentDate;

  const trackEnd = useMemo(() => {
    const farther =
      parseLocalDate(originalDate) > parseLocalDate(displayCurrent)
        ? originalDate
        : displayCurrent;
    return addDaysISO(farther, 7);
  }, [originalDate, displayCurrent]);

  const days = useMemo(() => eachDay(demoToday, trackEnd), [demoToday, trackEnd]);

  const indexOf = useCallback(
    (iso: string) => {
      const i = days.indexOf(iso);
      if (i >= 0) return i;
      if (parseLocalDate(iso) <= parseLocalDate(days[0]!)) return 0;
      return days.length - 1;
    },
    [days]
  );

  const forecastIdx = indexOf(displayCurrent);
  const originalIdx = indexOf(originalDate);
  const initialWant = desiredDate && !isReady ? desiredDate : displayCurrent;

  const [wantIdx, setWantIdx] = useState(() => indexOf(initialWant));
  const [dragging, setDragging] = useState(false);
  const [forecastMarkerIdx, setForecastMarkerIdx] = useState(originalIdx);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dragging) return;
    const next = desiredDate && !isReady ? desiredDate : displayCurrent;
    const id = requestAnimationFrame(() => setWantIdx(indexOf(next)));
    return () => cancelAnimationFrame(id);
  }, [desiredDate, displayCurrent, isReady, indexOf, dragging, animateKey]);

  useEffect(() => {
    let t1 = 0;
    const prep = requestAnimationFrame(() => {
      setForecastMarkerIdx(originalIdx);
      t1 = window.setTimeout(() => setForecastMarkerIdx(forecastIdx), 90);
    });
    return () => {
      cancelAnimationFrame(prep);
      window.clearTimeout(t1);
    };
  }, [animateKey, originalIdx, forecastIdx]);

  const wantISO = days[wantIdx] ?? displayCurrent;
  const gap = paceGapToDate({
    fundedAmount,
    targetPrice,
    dailyContributionRate,
    fromDateISO: demoToday,
    projectedDateISO: displayCurrent,
    wantByDateISO: wantISO,
  });

  const aheadOfForecast = daysGained(displayCurrent, wantISO) > 0;
  const behindForecast =
    daysUntil(displayCurrent, wantISO) > 0 && wantISO !== displayCurrent;

  const rankedTips = useMemo(() => {
    if (gap.extraSavingsNeeded <= 0) return [];
    return [...recommendations]
      .filter((r) => r.status === "pending")
      .sort(
        (a, b) =>
          gapFitScore(b.savingsAmount, b.disruptionScore, gap.extraSavingsNeeded) -
          gapFitScore(a.savingsAmount, a.disruptionScore, gap.extraSavingsNeeded)
      )
      .slice(0, 2);
  }, [recommendations, gap.extraSavingsNeeded]);

  const pct = (idx: number) =>
    days.length <= 1 ? 0 : (idx / (days.length - 1)) * 100;

  const clientXToIdx = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || days.length <= 1) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(ratio * (days.length - 1));
    },
    [days.length]
  );

  const commitWant = useCallback(
    (idx: number) => {
      const iso = days[idx];
      if (iso && onDesiredDateChange) onDesiredDateChange(iso);
    },
    [days, onDesiredDateChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => setWantIdx(clientXToIdx(e.clientX));
    const onUp = (e: PointerEvent) => {
      const idx = clientXToIdx(e.clientX);
      setWantIdx(idx);
      setDragging(false);
      commitWant(idx);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, clientXToIdx, commitWant]);

  const away = daysUntil(demoToday, displayCurrent);
  const interactive = Boolean(onDesiredDateChange) && !isReady;

  // Track needs extra top space only while the drag HUD is visible
  const trackHeight = dragging ? "h-[5.5rem]" : "h-14";

  const body = (
    <>
      {!embedded && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold">Purchase calendar</h3>
          {daysGained(originalDate, displayCurrent) > 0 && (
            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-deep)]">
              −{daysGained(originalDate, displayCurrent)} days vs start
            </span>
          )}
        </div>
      )}

      {interactive && !embedded && (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Drag <span className="font-semibold text-[var(--accent-deep)]">Need by</span> to
          set your date.
        </p>
      )}

      <div
        ref={trackRef}
        className={cn(
          "relative touch-none select-none transition-[height] duration-200",
          trackHeight,
          interactive && "cursor-ew-resize"
        )}
        onPointerDown={(e) => {
          if (!interactive) return;
          e.preventDefault();
          setWantIdx(clientXToIdx(e.clientX));
          setDragging(true);
        }}
        role={interactive ? "slider" : undefined}
        aria-label={interactive ? "Need it by date" : undefined}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, days.length - 1)}
        aria-valuenow={wantIdx}
        aria-valuetext={formatLongDate(wantISO)}
      >
        <div
          className={cn(
            "absolute left-0 right-0 h-2 rounded-full bg-black/[0.06]",
            dragging ? "top-12" : "top-8"
          )}
        />

        {aheadOfForecast && (
          <div
            className={cn(
              "absolute h-2 rounded-full bg-gradient-to-r from-amber-300/80 to-[var(--accent)]/70",
              dragging ? "top-12" : "top-8"
            )}
            style={{
              left: `${pct(Math.min(wantIdx, forecastIdx))}%`,
              width: `${Math.max(0, pct(Math.max(wantIdx, forecastIdx)) - pct(Math.min(wantIdx, forecastIdx)))}%`,
            }}
          />
        )}

        {/* Now */}
        <div
          className={cn(
            "absolute flex -translate-x-1/2 flex-col items-center",
            dragging ? "top-5" : "top-1"
          )}
          style={{ left: `${pct(0)}%` }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Now
          </span>
          <div className="mt-0.5 h-2 w-2 rounded-full bg-foreground/35" />
        </div>

        {/* Forecast */}
        <div
          className={cn(
            "pointer-events-none absolute z-[5] flex -translate-x-1/2 flex-col items-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            dragging ? "top-4" : "top-0"
          )}
          style={{ left: `${pct(forecastMarkerIdx)}%` }}
        >
          <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
            Forecast
          </span>
          <div className="mt-0.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--accent-deep)] shadow-md" />
        </div>

        {/* Need-by + drag-only HUD */}
        <div
          className={cn(
            "absolute z-10 flex -translate-x-1/2 flex-col items-center",
            dragging ? "top-0 duration-0" : "top-0 transition-all duration-150"
          )}
          style={{ left: `${pct(wantIdx)}%` }}
        >
          {dragging && !isReady && (
            <div
              className={cn(
                "mb-1 whitespace-nowrap rounded-2xl px-2.5 py-1.5 text-center shadow-lg",
                aheadOfForecast
                  ? "bg-[#0f766e] text-white"
                  : behindForecast
                    ? "bg-black/80 text-white"
                    : "bg-white text-foreground ring-1 ring-black/10"
              )}
            >
              {aheadOfForecast ? (
                <>
                  <p className="font-display text-sm font-bold tabular-nums">
                    {gap.extraSavingsNeeded > 0
                      ? `${formatMoney(gap.extraSavingsNeeded)} more`
                      : "On pace"}
                  </p>
                  <p className="text-[10px] opacity-90">
                    {gap.daysSooner}d sooner · ~
                    {formatMoney(gap.requiredDailyRate)}/day
                  </p>
                </>
              ) : behindForecast ? (
                <p className="text-xs font-semibold">
                  +{daysUntil(displayCurrent, wantISO)}d buffer
                </p>
              ) : (
                <p className="text-xs font-semibold">Matches forecast</p>
              )}
            </div>
          )}

          <div
            className={cn(
              "flex flex-col items-center",
              interactive && "cursor-grab active:cursor-grabbing",
              !dragging && "mt-0"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold text-white shadow-md",
                aheadOfForecast ? "bg-amber-500" : "bg-[var(--accent)]",
                dragging && "scale-105"
              )}
            >
              <GripHorizontal className="h-3 w-3 opacity-80" />
              Need by
            </div>
            <div
              className={cn(
                "mt-0.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-[0_0_0_3px_rgba(15,118,110,0.15)]",
                aheadOfForecast ? "bg-amber-500" : "bg-[var(--accent)]"
              )}
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none mt-1 flex gap-px overflow-hidden">
        {days.map((d, i) => {
          const inGap =
            aheadOfForecast &&
            i >= Math.min(wantIdx, forecastIdx) &&
            i <= Math.max(wantIdx, forecastIdx);
          return (
            <div
              key={d}
              className={cn(
                "h-1 flex-1 rounded-sm",
                inGap ? "bg-amber-400/70" : "bg-black/[0.05]",
                i === wantIdx && "bg-amber-500",
                i === forecastIdx && "bg-[var(--accent-deep)]"
              )}
            />
          );
        })}
      </div>

      {/* Quiet resting summary — no floating HUD */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
            Forecast
          </p>
          <p className="font-display text-xl font-semibold text-[var(--accent-deep)]">
            {isReady ? "Today" : formatLongDate(displayCurrent)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {isReady ? "Fully funded" : `${away} days at current pace`}
          </p>
        </div>
        {interactive && (
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Need by
            </p>
            <p
              className={cn(
                "font-display text-xl font-semibold",
                aheadOfForecast ? "text-amber-700" : "text-foreground"
              )}
            >
              {formatLongDate(wantISO)}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {aheadOfForecast
                ? gap.extraSavingsNeeded > 0
                  ? `${formatMoney(gap.extraSavingsNeeded)} to close`
                  : "On pace"
                : behindForecast
                  ? "After forecast"
                  : "Same as forecast"}
            </p>
          </div>
        )}
      </div>

      {!hideTips &&
        interactive &&
        aheadOfForecast &&
        !gap.onPace &&
        rankedTips.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              <Sparkles className="h-3.5 w-3.5" />
              Tips to hit {formatLongDate(wantISO)}
            </p>
            {rankedTips.map((tip) => (
              <div
                key={tip.id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-black/5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{tip.description}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    Save {formatMoney(tip.savingsAmount)} · −
                    {tip.estimatedDaysGained} days
                  </p>
                </div>
                {onAcceptRecommendation && (
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() => onAcceptRecommendation(tip.id)}
                  >
                    +{tip.estimatedDaysGained}d
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
    </>
  );

  if (embedded) {
    return <div className="mt-1">{body}</div>;
  }

  return <Card className="p-4">{body}</Card>;
}
