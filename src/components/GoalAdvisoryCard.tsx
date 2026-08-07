"use client";

import { AlertTriangle, CheckCircle2, Gauge, ShieldAlert } from "lucide-react";
import { Card } from "./ui/card";
import type { GoalFeasibilityAdvisory } from "@/lib/goal-feasibility";
import { cn, formatLongDate, formatMoney } from "@/lib/utils";

const LEVEL_STYLE: Record<
  GoalFeasibilityAdvisory["level"],
  { label: string; bar: string; bg: string; text: string }
> = {
  unreachable: {
    label: "Unlikely",
    bar: "bg-rose-500",
    bg: "bg-rose-50",
    text: "text-rose-900",
  },
  stretch: {
    label: "Stretch",
    bar: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-950",
  },
  achievable: {
    label: "Achievable",
    bar: "bg-[var(--accent)]",
    bg: "bg-[var(--accent-soft)]/60",
    text: "text-[var(--accent-deep)]",
  },
  on_track: {
    label: "On track",
    bar: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
  },
};

export function GoalAdvisoryCard({
  advisory,
  compact,
}: {
  advisory: GoalFeasibilityAdvisory;
  compact?: boolean;
}) {
  const style = LEVEL_STYLE[advisory.level];
  const Icon =
    advisory.level === "unreachable"
      ? AlertTriangle
      : advisory.freedomAtRisk
        ? ShieldAlert
        : advisory.level === "on_track"
          ? CheckCircle2
          : Gauge;

  return (
    <Card className={cn("space-y-3", style.bg, "border-transparent")}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80",
            style.text
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Feasibility
          </p>
          <p className={cn("font-display text-lg font-semibold", style.text)}>
            {advisory.headline}
          </p>
          <p className="mt-1 text-sm leading-snug text-[var(--muted)]">
            {advisory.detail}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium text-[var(--muted)]">
            Likelihood · {style.label}
          </span>
          <span className={cn("font-semibold tabular-nums", style.text)}>
            {advisory.likelihoodPct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10">
          <div
            className={cn("h-full rounded-full transition-all", style.bar)}
            style={{ width: `${advisory.likelihoodPct}%` }}
          />
        </div>
      </div>

      {!compact && (
        <>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-white/70 px-2 py-2">
              <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--muted)]">
                By deadline
              </p>
              <p className="font-display text-sm font-semibold tabular-nums">
                {formatMoney(advisory.fundedByDeadline)}
              </p>
            </div>
            <div className="rounded-xl bg-white/70 px-2 py-2">
              <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Shortfall
              </p>
              <p className="font-display text-sm font-semibold tabular-nums">
                {formatMoney(advisory.shortfall)}
              </p>
            </div>
            <div className="rounded-xl bg-white/70 px-2 py-2">
              <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Pace savings
              </p>
              <p className="font-display text-sm font-semibold tabular-nums">
                {formatMoney(advisory.savingsFromPace)}
              </p>
            </div>
            <div className="rounded-xl bg-white/70 px-2 py-2">
              <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Risk bonuses
              </p>
              <p className="font-display text-sm font-semibold tabular-nums">
                ≈{formatMoney(advisory.expectedRiskBonus)}
              </p>
            </div>
          </div>

          {advisory.freedomAtRisk && (
            <p className="rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-snug text-rose-900/90">
              <span className="font-semibold">Freedom warning: </span>
              {advisory.freedomNote}
            </p>
          )}

          <p className="text-[10px] leading-snug text-[var(--muted)]">
            Pace projects {formatLongDate(advisory.projectedFromPace)} without a
            deadline. Assumes: {advisory.assumptions.slice(0, 3).join(" · ")}.
          </p>
        </>
      )}
    </Card>
  );
}
