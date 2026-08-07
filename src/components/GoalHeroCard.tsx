"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { BatteryMeter } from "./BatteryMeter";
import { GoalArt } from "./GoalArt";
import { Card } from "./ui/card";
import type { Goal } from "@/lib/types";
import { cn, formatLongDate, formatMoney } from "@/lib/utils";

interface GoalHeroCardProps {
  goal: Goal;
  percent: number;
  daysAway: number;
  dateKey?: string;
}

export function GoalHeroCard({ goal, percent, daysAway, dateKey }: GoalHeroCardProps) {
  const ready = percent >= 100 || goal.completed;

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-[#0f766e]/[0.08] via-transparent to-[#14b8a6]/10 p-4">
        <div className="flex gap-3">
          <GoalArt category={goal.category} name={goal.name} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Primary goal
            </p>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {goal.name}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {formatMoney(goal.fundedAmount)} of {formatMoney(goal.targetPrice)}
              {goal.saleApplied && (
                <span className="ml-1.5 text-[var(--success)]">Sale price</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <BatteryMeter percent={percent} size="lg" />
        </div>

        <div
          key={dateKey ?? goal.projectedPurchaseDate}
          className="animate-date mt-4 rounded-2xl bg-white/70 px-3.5 py-3"
        >
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">
                Projected purchase
              </p>
              <p className="font-display text-2xl font-semibold tracking-tight text-[var(--accent-deep)]">
                {ready ? "Today" : formatLongDate(goal.projectedPurchaseDate)}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {ready
                  ? "Fully funded — ready when you are"
                  : `${daysAway} days away`}
              </p>
            </div>
          </div>
        </div>

        <Link
          href={`/goals/${goal.id}`}
          className={cn(
            "mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-deep)] transition-all hover:bg-[#b8f0e4] active:scale-[0.98]"
          )}
        >
          View goal
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}
