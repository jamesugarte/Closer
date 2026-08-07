"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import type { GoalHealthReport } from "@/lib/goal-health";
import type { Recommendation } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

const LEVEL_UI = {
  green: {
    ring: "ring-emerald-400/50",
    scoreBg: "bg-emerald-500 text-white",
    banner: "border-emerald-200 bg-emerald-50 text-emerald-950",
    label: "Recommendable",
  },
  yellow: {
    ring: "ring-amber-400/50",
    scoreBg: "bg-amber-400 text-amber-950",
    banner: "border-amber-200 bg-amber-50 text-amber-950",
    label: "Possible · not recommendable",
  },
  red: {
    ring: "ring-rose-400/50",
    scoreBg: "bg-rose-500 text-white",
    banner: "border-rose-200 bg-rose-50 text-rose-950",
    label: "Not possible · locked",
  },
} as const;

interface GoalHealthCardProps {
  report: GoalHealthReport;
  tradeoffs: Recommendation[];
  onApprove: (recommendationId: string) => void;
  onReject?: (recommendationId: string) => void;
  compact?: boolean;
}

export function GoalHealthCard({
  report,
  tradeoffs,
  onApprove,
  onReject,
  compact = false,
}: GoalHealthCardProps) {
  const ui = LEVEL_UI[report.level];
  const failing = report.lines.filter((l) => !l.okRecommendable);

  return (
    <Card
      className={cn(
        "space-y-3 ring-2",
        ui.ring,
        report.locked && "border-rose-300"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl shadow-sm",
            ui.scoreBg
          )}
          aria-label={`Goal health score ${report.score}`}
        >
          <span className="font-display text-2xl font-bold leading-none">
            {report.score}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wide opacity-90">
            Health
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold leading-tight">
              {report.headline}
            </h2>
            {report.locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {ui.label}
          </p>
          {!compact && (
            <p className="mt-1.5 text-sm leading-snug text-foreground/85">
              {report.detail}
            </p>
          )}
        </div>
      </div>

      <div className={cn("rounded-xl border px-3 py-2.5 text-sm", ui.banner)}>
        <p className="flex items-start gap-2 font-medium leading-snug">
          {report.level === "green" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{report.consequence}</span>
        </p>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-xl bg-black/[0.03] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Plans due / mo
            </p>
            <p className="font-display text-sm font-semibold">
              {formatMoney(report.monthlyInstallmentsDue)}
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.03] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Still to fund
            </p>
            <p className="font-display text-sm font-semibold">
              {formatMoney(report.totalRemaining)}
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.03] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Checking now
            </p>
            <p className="font-display text-sm font-semibold">
              {formatMoney(report.checkingNow)}
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.03] px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              If you force all
            </p>
            <p className="font-display text-sm font-semibold">
              → {formatMoney(report.projectedCheckingIfPursueAll)}
            </p>
          </div>
        </div>
      )}

      {failing.length > 0 && !compact && (
        <ul className="space-y-1 text-xs text-[var(--muted)]">
          {failing.slice(0, 4).map((l) => (
            <li key={l.goalId} className="flex justify-between gap-2">
              <span className="truncate">
                #{l.priority} {l.name}
                {!l.okPossible ? " · miss" : " · stretch"}
              </span>
              <span className="shrink-0 font-medium text-foreground/80">
                {formatMoney(l.installmentDue)}/mo
              </span>
            </li>
          ))}
        </ul>
      )}

      {report.level !== "green" && (
        <div className="space-y-2 border-t border-black/5 pt-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              Trade-offs · you approve
            </p>
          </div>
          {tradeoffs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              <Link
                href="/recommendations"
                className="font-semibold text-[var(--accent-deep)]"
              >
                See tips →
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {tradeoffs.slice(0, compact ? 2 : 4).map((rec) => (
                <li
                  key={rec.id}
                  className="rounded-xl border border-black/8 bg-white/80 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold leading-snug">
                    {rec.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">
                    {rec.description}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => onApprove(rec.id)}
                    >
                      {rec.applyCancelGoal
                        ? "Pause"
                        : rec.applyTargetPrice
                          ? "Right-size"
                          : rec.applyOptionalTargetDate
                            ? "Push date"
                            : "Approve"}
                      {rec.savingsAmount > 0
                        ? ` · −${formatMoney(rec.savingsAmount)}/mo`
                        : ""}
                    </Button>
                    {onReject && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(rec.id)}
                      >
                        Skip
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {report.locked && (
        <p className="rounded-xl bg-rose-600/10 px-3 py-2 text-center text-[12px] font-medium text-rose-900">
          Locked until trade-offs make the stack feasible.
        </p>
      )}
    </Card>
  );
}
