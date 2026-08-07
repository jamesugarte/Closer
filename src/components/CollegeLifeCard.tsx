"use client";

import { Building2, Sofa, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "./ui/card";
import {
  collegeCostProjections,
  COST_DATA_SOURCES,
  fourYearTotalNeeded,
  type CollegeYear,
  type YearCostProjection,
} from "@/lib/college-life";
import { cn, formatMoney } from "@/lib/utils";

interface CollegeLifeCardProps {
  collegeYear: CollegeYear;
  monthsAdvanced: number;
  studentName?: string;
}

/**
 * Interactive college arc — years 1–4 vs projected $ needed.
 * Distinct from Free-to-spend’s protected-obligations accordion.
 */
export function CollegeLifeCard({
  collegeYear,
  monthsAdvanced,
  studentName = "the student",
}: CollegeLifeCardProps) {
  const projections = useMemo(() => collegeCostProjections(), []);
  const fourYearTotal = useMemo(() => fourYearTotalNeeded(), []);
  const [picked, setPicked] = useState<{
    year: CollegeYear;
    atCollegeYear: CollegeYear;
  } | null>(null);
  const [mode, setMode] = useState<"annual" | "monthly">("annual");

  const selectedYear: CollegeYear =
    picked && picked.atCollegeYear === collegeYear
      ? picked.year
      : collegeYear;

  const selected: YearCostProjection =
    projections.find((p) => p.year === selectedYear) ?? projections[0];

  const chartH = 120;
  const chartPadTop = 16;
  const barMaxH = chartH - chartPadTop - 28;

  const yearIn = (monthsAdvanced % 12) + 1;
  const isCurrent = selected.year === collegeYear;
  const barValue = (p: YearCostProjection) =>
    mode === "annual" ? p.projectedNeeded : p.monthly;

  const modeMax =
    mode === "annual"
      ? Math.max(...projections.map((p) => p.projectedNeeded))
      : Math.max(...projections.map((p) => p.monthly));

  return (
    <Card className="space-y-3 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
          <Building2 className="h-5 w-5 text-[var(--accent-deep)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            College arc · cost forecast
          </p>
          <p className="font-display text-xl font-semibold tracking-tight">
            Years 1–4 projected need
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            You&apos;re in {labelFor(projections, collegeYear)} · month {yearIn}
            /12 · tap a year to explore
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl bg-black/[0.04] p-1">
        <button
          type="button"
          onClick={() => setMode("annual")}
          className={cn(
            "flex-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors",
            mode === "annual"
              ? "bg-white text-[var(--accent-deep)] shadow-sm"
              : "text-[var(--muted)]"
          )}
        >
          $/year
        </button>
        <button
          type="button"
          onClick={() => setMode("monthly")}
          className={cn(
            "flex-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors",
            mode === "monthly"
              ? "bg-white text-[var(--accent-deep)] shadow-sm"
              : "text-[var(--muted)]"
          )}
        >
          $/month
        </button>
      </div>

      <div className="relative">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Projected {mode === "annual" ? "annual" : "monthly"} need
        </p>
        <div
          className="flex items-end justify-between gap-2 px-1"
          style={{ height: chartH }}
          role="img"
          aria-label="College cost by year chart"
        >
          {projections.map((p) => {
            const value = barValue(p);
            const h = Math.max(8, (value / modeMax) * barMaxH);
            const active = p.year === selected.year;
            const current = p.year === collegeYear;
            const recurringH =
              mode === "annual"
                ? Math.max(4, (p.annualRecurring / modeMax) * barMaxH)
                : h;
            const oneTimeH =
              mode === "annual" && p.oneTime > 0
                ? Math.max(4, (p.oneTime / modeMax) * barMaxH)
                : 0;

            return (
              <button
                key={p.year}
                type="button"
                onClick={() =>
                  setPicked({ year: p.year, atCollegeYear: collegeYear })
                }
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
                aria-pressed={active}
                aria-label={`${p.label}: ${formatMoney(value)}`}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold tabular-nums transition-opacity",
                    active
                      ? "text-[var(--accent-deep)] opacity-100"
                      : "opacity-0 group-hover:opacity-70"
                  )}
                >
                  {formatMoney(value)}
                </span>
                <div
                  className="relative flex w-full max-w-[52px] flex-col justify-end overflow-hidden rounded-t-lg"
                  style={{ height: h }}
                >
                  {mode === "annual" && oneTimeH > 0 ? (
                    <>
                      <div
                        className={cn(
                          "w-full transition-colors",
                          active ? "bg-amber-400" : "bg-amber-300/80"
                        )}
                        style={{ height: oneTimeH }}
                        title="Furniture / move-in"
                      />
                      <div
                        className={cn(
                          "w-full transition-colors",
                          active
                            ? "bg-[var(--accent)]"
                            : current
                              ? "bg-[var(--accent)]/70"
                              : "bg-[var(--accent)]/35"
                        )}
                        style={{ height: recurringH }}
                      />
                    </>
                  ) : (
                    <div
                      className={cn(
                        "h-full w-full rounded-t-lg transition-colors",
                        active
                          ? "bg-[var(--accent)]"
                          : current
                            ? "bg-[var(--accent)]/70"
                            : "bg-[var(--accent)]/35"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    active ? "text-[var(--accent-deep)]" : "text-[var(--muted)]"
                  )}
                >
                  Y{p.year}
                </span>
                {current && (
                  <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--accent-deep)]">
                    Now
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {mode === "annual" && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-[var(--accent)]" />
              Recurring bills × 12
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-amber-400" />
              One-time (furniture)
            </span>
          </div>
        )}
      </div>

      <div
        key={selected.year}
        className="animate-soft-in space-y-2 rounded-2xl bg-black/[0.03] px-3 py-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-base font-semibold">
              {selected.label}
              {isCurrent ? " · current" : " · preview"}
            </p>
            <p className="text-xs text-[var(--muted)]">{selected.housingLabel}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-semibold tabular-nums text-[var(--accent-deep)]">
              {formatMoney(
                mode === "annual" ? selected.projectedNeeded : selected.monthly
              )}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              {mode === "annual" ? "projected / year" : "protected / month"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {selected.mealPlan ? (
            <>
              <Utensils className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <span className="text-[13px] text-[var(--muted)]">
                Meal plan + dorm furniture included
              </span>
            </>
          ) : (
            <>
              <Sofa className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-[13px] text-[var(--muted)]">
                {selected.year === 3
                  ? `Groceries + ~${formatMoney(selected.oneTime)} furniture spike (Marketplace)`
                  : "Groceries · furniture already bought junior year"}
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {selected.categories.map((c) => (
            <div
              key={c.key}
              className="rounded-xl bg-white/80 px-2 py-2 text-center"
            >
              <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {c.label}
              </p>
              <p className="font-display text-sm font-semibold tabular-nums">
                {formatMoney(mode === "annual" ? c.monthly * 12 : c.monthly)}
              </p>
            </div>
          ))}
        </div>

        {selected.creepNote && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-950/80">
            <span className="font-semibold">Lifestyle creep: </span>
            {selected.creepNote}
          </p>
        )}

        <p className="text-[11px] leading-snug text-[var(--muted)]">
          <span className="font-semibold text-foreground">Why these $: </span>
          {selected.rationale}
        </p>

        {!isCurrent && (
          <p className="text-[11px] leading-snug text-[var(--muted)]">
            Preview only — Activity&apos;s{" "}
            <strong className="text-foreground">+1 academic year</strong> moves{" "}
            {studentName} here for real (bills + housing update).
          </p>
        )}
      </div>

      <p className="text-[11px] leading-snug text-[var(--muted)]">
        Four-year protected need ≈ {formatMoney(fourYearTotal)} (recurring +
        junior furniture). {COST_DATA_SOURCES} Line-item bills for this month
        live under Free to spend → Protected obligations.
      </p>
    </Card>
  );
}

function labelFor(projections: YearCostProjection[], year: CollegeYear): string {
  return projections.find((p) => p.year === year)?.label ?? "Freshman";
}
