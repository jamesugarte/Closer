"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BatteryMeter } from "./BatteryMeter";
import { CloserCalendar } from "./CloserCalendar";
import { GoalArt } from "./GoalArt";
import { Card } from "./ui/card";
import type { Goal, Recommendation } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

interface GoalCloserCardProps {
  goal: Goal;
  percent: number;
  daysAway: number;
  dailyContributionRate: number;
  recommendations: Recommendation[];
  demoToday: string;
  onDesiredDateChange: (iso: string) => void;
  onAcceptRecommendation: (id: string) => void;
  /** When true, hide in-card tips (Goals tab shows the main AI card) */
  hideInlineTips?: boolean;
}

/**
 * One composition: goal identity + funding battery + interactive “need by” calendar.
 * Replaces the old split between GoalHeroCard and Getting Closer.
 */
export function GoalCloserCard({
  goal,
  percent,
  dailyContributionRate,
  recommendations,
  demoToday,
  onDesiredDateChange,
  onAcceptRecommendation,
  hideInlineTips = false,
}: GoalCloserCardProps) {
  const ready = percent >= 100 || goal.completed;

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-[#0f766e]/[0.08] via-transparent to-[#14b8a6]/10 p-4">
        <div className="flex gap-3">
          <GoalArt category={goal.category} name={goal.name} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Getting closer
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

        <div className="mt-3">
          <BatteryMeter percent={percent} size="lg" />
        </div>

        <div className="mt-4 rounded-2xl bg-white/75 px-3 pb-3 pt-3">
          <CloserCalendar
            embedded
            originalDate={goal.originalProjectedDate}
            currentDate={goal.projectedPurchaseDate}
            isReady={ready}
            animateKey={`${goal.id}-${goal.projectedPurchaseDate}-${goal.fundedAmount}-${demoToday}`}
            demoToday={demoToday}
            fundedAmount={goal.fundedAmount}
            targetPrice={goal.targetPrice}
            dailyContributionRate={dailyContributionRate}
            desiredDate={goal.optionalTargetDate}
            onDesiredDateChange={onDesiredDateChange}
            recommendations={recommendations}
            onAcceptRecommendation={onAcceptRecommendation}
            hideTips={hideInlineTips}
          />
        </div>

        <Link
          href={`/goals/${goal.id}`}
          className={cn(
            "mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-deep)] transition-all hover:bg-[#b8f0e4] active:scale-[0.98]"
          )}
        >
          View goal
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}
