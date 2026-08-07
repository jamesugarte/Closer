"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Lock, Plus } from "lucide-react";
import { BatteryMeter } from "@/components/BatteryMeter";
import { DemoBanner } from "@/components/DemoBanner";
import { GoalAdvisoryCard } from "@/components/GoalAdvisoryCard";
import { GoalArt } from "@/components/GoalArt";
import { GoalHealthCard } from "@/components/GoalHealthCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/AppContext";
import { assessGoalFeasibility } from "@/lib/goal-feasibility";
import { isTimeSensitiveGoal } from "@/lib/deadline";
import {
  installmentDueThisMonth,
  monthsUntilGoalEnd,
} from "@/lib/goal-installments";
import type { Goal } from "@/lib/types";
import { cn, formatLongDate, formatMoney } from "@/lib/utils";

const LEVEL_PILL: Record<
  string,
  { label: string; className: string }
> = {
  unreachable: {
    label: "Unlikely",
    className: "bg-rose-100 text-rose-900",
  },
  stretch: {
    label: "Stretch",
    className: "bg-amber-100 text-amber-950",
  },
  achievable: {
    label: "Achievable",
    className: "bg-[var(--accent-soft)] text-[var(--accent-deep)]",
  },
  on_track: {
    label: "On track",
    className: "bg-emerald-100 text-emerald-900",
  },
};

function GoalRankRow({
  goal,
  open,
  onToggle,
  fundingPct,
  daysAway,
  demoToday,
  dailyRate,
  user,
  risk,
  otherGoals,
}: {
  goal: Goal;
  open: boolean;
  onToggle: () => void;
  fundingPct: (g: Goal) => number;
  daysAway: (g: Goal) => number;
  demoToday: string;
  dailyRate: number;
  user: ReturnType<typeof useApp>["state"]["user"];
  risk: ReturnType<typeof useApp>["state"]["risk"];
  otherGoals: Goal[];
}) {
  const pct = fundingPct(goal);
  const ready = pct >= 100 || goal.completed;
  const advisory = useMemo(
    () =>
      assessGoalFeasibility({
        targetPrice: goal.targetPrice,
        fundedAmount: goal.fundedAmount,
        optionalTargetDate:
          goal.optionalTargetDate || goal.projectedPurchaseDate,
        demoToday,
        dailyContributionRate: dailyRate,
        user,
        risk,
        goals: otherGoals,
        prioritize: goal.priority === 1,
        goalName: goal.name,
      }),
    [goal, demoToday, dailyRate, user, risk, otherGoals]
  );
  const pill = LEVEL_PILL[advisory.level] ?? LEVEL_PILL.achievable;
  const fixed = isTimeSensitiveGoal(goal);
  const installment = installmentDueThisMonth(demoToday, goal);
  const monthsLeft = monthsUntilGoalEnd(demoToday, goal);

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-black/[0.02]"
      >
        <GoalArt
          category={goal.category}
          name={goal.name}
          className="h-14 w-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Rank #{goal.priority}
                {fixed ? " · Fixed date" : " · Flexible"}
              </p>
              <h3 className="font-display text-lg font-semibold leading-tight">
                {goal.name}
              </h3>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  pill.className
                )}
              >
                {advisory.likelihoodPct}% · {pill.label}
              </span>
              {open ? (
                <ChevronUp className="h-4 w-4 text-[var(--muted)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
              )}
            </div>
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {formatMoney(goal.fundedAmount)} / {formatMoney(goal.targetPrice)}
          </p>
          <div className="mt-1.5">
            <BatteryMeter percent={pct} />
          </div>
          <p className="mt-1.5 text-sm font-medium text-[var(--accent-deep)]">
            {ready
              ? "Ready today"
              : goal.optionalTargetDate
                ? `Want by ${formatLongDate(goal.optionalTargetDate)} · proj ${formatLongDate(goal.projectedPurchaseDate)}`
                : `${formatLongDate(goal.projectedPurchaseDate)} · ${daysAway(goal)} days`}
          </p>
          {!ready && installment > 0 && (
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Payment plan {formatMoney(installment)}/mo · ~{monthsLeft} mo left
              (after bills &amp; risk)
            </p>
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-black/5 px-4 pb-4 pt-3">
          <GoalAdvisoryCard advisory={advisory} />
          <Link
            href={`/goals/${goal.id}`}
            className="block text-center text-sm font-semibold text-[var(--accent-deep)]"
          >
            Open goal detail →
          </Link>
        </div>
      )}
    </Card>
  );
}

export default function GoalsPage() {
  const {
    state,
    hydrated,
    activeGoals,
    fundingPct,
    daysAway,
    goalHealth,
    goalHealthTips,
    acceptRecommendation,
    rejectRecommendation,
  } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [hasToggled, setHasToggled] = useState(false);

  const completed = state.goals.filter((g) => g.purchased);
  const openGoalId = hasToggled ? openId : (activeGoals[0]?.id ?? null);
  const locked = goalHealth.locked;

  if (!hydrated) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <DemoBanner />
        <div className="flex items-end justify-between gap-3 pt-1">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Goals
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Stack too big? Approve trade-offs.
            </p>
          </div>
          {locked ? (
            <Button size="sm" disabled aria-label="New goal locked">
              <Lock className="h-4 w-4" />
              Locked
            </Button>
          ) : (
            <Link href="/goals/new">
              <Button size="sm" aria-label="Add a new goal">
                <Plus className="h-4 w-4" />
                New
              </Button>
            </Link>
          )}
        </div>
      </header>

      <GoalHealthCard
        report={goalHealth}
        tradeoffs={goalHealthTips}
        onApprove={acceptRecommendation}
        onReject={rejectRecommendation}
      />

      {/* Keep goals page focused; calendar lives on Home + Cashflow */}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            All active
          </h2>
          <p className="text-[11px] text-[var(--muted)]">
            {activeGoals.length} goal{activeGoals.length === 1 ? "" : "s"}
          </p>
        </div>

        {activeGoals.length === 0 ? (
          <Card className="space-y-2">
            <p className="font-display text-lg font-semibold">No active goals</p>
            <p className="text-sm text-[var(--muted)]">
              Start one — Closer will estimate the date and score feasibility.
            </p>
            {!locked && (
              <Link href="/goals/new" className="inline-block pt-1">
                <span className="text-sm font-semibold text-[var(--accent-deep)]">
                  + New goal
                </span>
              </Link>
            )}
          </Card>
        ) : (
          activeGoals.map((g) => (
            <GoalRankRow
              key={g.id}
              goal={g}
              open={openGoalId === g.id}
              onToggle={() => {
                setHasToggled(true);
                setOpenId((prev) => {
                  const current = hasToggled ? prev : activeGoals[0]?.id;
                  return current === g.id ? null : g.id;
                });
              }}
              fundingPct={fundingPct}
              daysAway={daysAway}
              demoToday={state.demoToday}
              dailyRate={state.user.dailyContributionRate}
              user={state.user}
              risk={state.risk}
              otherGoals={activeGoals.filter((x) => x.id !== g.id)}
            />
          ))
        )}
      </section>

      {completed.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Achieved · archived
          </h2>
          {completed.map((g) => (
            <Card key={g.id} className="opacity-70">
              <p className="font-display font-semibold">{g.name}</p>
              <p className="text-sm text-[var(--success)]">
                {g.completed ? "Purchased · cleared" : "Paused · archived"}
              </p>
            </Card>
          ))}
        </section>
      )}

      {locked ? (
        <Button variant="outline" size="full" disabled>
          <Lock className="h-4 w-4" />
          Approve trade-offs above to unlock new goals
        </Button>
      ) : (
        <Link href="/goals/new" className="block">
          <Button variant="outline" size="full">
            <Plus className="h-4 w-4" />
            Add a new goal
          </Button>
        </Link>
      )}
    </div>
  );
}
