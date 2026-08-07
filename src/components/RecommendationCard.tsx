"use client";

import { Check, Leaf, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useApp } from "@/context/AppContext";
import type { Recommendation } from "@/lib/types";
import { formatLongDate, formatMoney } from "@/lib/utils";

interface RecommendationCardProps {
  recommendation: Recommendation;
  newDateISO: string;
  feedback: "accepted" | "rejected" | null;
  onAccept: () => void;
  onReject: () => void;
}

export function RecommendationCard({
  recommendation,
  newDateISO,
  feedback,
  onAccept,
  onReject,
}: RecommendationCardProps) {
  const { state } = useApp();
  const studentName = state.user.name;
  if (feedback === "accepted") {
    const isRealloc = recommendation.kind === "reallocation";
    const isPortfolio = recommendation.kind === "portfolio";
    const isBridge = recommendation.kind === "income_bridge";
    const isGrowth = recommendation.kind === "income_growth";
    return (
      <Card className="animate-celebrate border-[var(--accent)]/20 bg-gradient-to-br from-[#ecfdf5] to-white">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-[var(--accent-deep)]">
              {isBridge
                ? "Bills covered by aid bridge."
                : isGrowth
                  ? "Income up."
                  : recommendation.category === "goal-health"
                    ? "Trade-off approved."
                    : isPortfolio
                      ? "Portfolio updated."
                      : `${recommendation.estimatedDaysGained} days closer.`}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {isBridge
                ? `${formatMoney(recommendation.applyLoanForBills ?? recommendation.savingsAmount)} → protected bills · ${formatMoney(recommendation.applyLoanForGoals ?? 0)} → goals. Not free-to-spend.`
                : isGrowth
                  ? `+${formatMoney(recommendation.savingsAmount)}/mo liquid. Cashflow should climb out of the red.`
                  : recommendation.category === "goal-health" || isPortfolio
                    ? recommendation.description
                    : isRealloc
                      ? `${formatMoney(recommendation.savingsAmount)} rearranged. ${formatLongDate(newDateISO)}.`
                      : `${formatMoney(recommendation.savingsAmount)} → reserve. ${formatLongDate(newDateISO)}.`}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (feedback === "rejected") {
    return (
      <Card className="animate-soft-in">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5">
            <Leaf className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div className="flex-1">
            <p className="font-display text-base font-semibold">
              Got it. Closer will learn which trade-offs fit your life.
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Next idea
            </p>
            <p className="mt-1 font-medium">{recommendation.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span className="rounded-full bg-black/[0.04] px-2.5 py-1">
                Save {formatMoney(recommendation.savingsAmount)}
              </span>
              <span className="rounded-full bg-black/[0.04] px-2.5 py-1">
                Gain {recommendation.estimatedDaysGained} days
              </span>
              <span className="rounded-full bg-black/[0.04] px-2.5 py-1">
                Impact: {recommendation.lifestyleImpact}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={onAccept} size="full">
                Gain {recommendation.estimatedDaysGained} days
              </Button>
              <Button onClick={onReject} variant="outline" size="full">
                Not for me
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="animate-soft-in border-[var(--accent)]/15 bg-gradient-to-br from-white via-white to-[#f0fdfa]">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" />
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          {recommendation.kind === "income_bridge"
            ? "Priority · cover bills"
            : recommendation.kind === "income_growth"
              ? "Earn more"
              : recommendation.category === "goal-health"
              ? "Trade-off"
              : recommendation.kind === "good_job_bonus"
                ? "Good-job bonus"
                : recommendation.kind === "portfolio"
                  ? "Portfolio"
                  : recommendation.kind === "reallocation"
                    ? "Rearrange"
                    : recommendation.kind === "surplus_allocation"
                      ? "Free-to-spend"
                      : recommendation.kind === "risk_avoidance"
                        ? "Risk"
                        : "Tip"}
        </p>
      </div>
      <h3 className="font-display text-xl font-semibold tracking-tight">
        {recommendation.title}
      </h3>
      <p className="mt-2 text-[15px] leading-snug text-foreground/90">
        {recommendation.description}
      </p>
      {recommendation.evidenceSummary && (
        <p className="mt-2 rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-[var(--muted)]">
          {recommendation.kind === "income_bridge" ||
          recommendation.kind === "income_growth" ||
          recommendation.kind === "portfolio" ||
          recommendation.kind === "surplus_allocation"
            ? recommendation.evidenceSummary
            : `Seen in ${studentName}'s history: ${recommendation.evidenceSummary}`}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-[var(--accent-soft)]/70 px-2.5 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {recommendation.kind === "income_bridge"
                ? "Loan"
                : recommendation.kind === "income_growth"
                  ? "+/mo"
                : recommendation.kind === "reallocation"
                ? "Move"
                : recommendation.kind === "surplus_allocation"
                  ? "Allocate"
                  : recommendation.kind === "portfolio"
                    ? "Adjust"
                    : "Save"}
          </p>
          <p className="font-display text-sm font-semibold text-[var(--accent-deep)]">
            {formatMoney(recommendation.savingsAmount)}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--accent-soft)]/70 px-2.5 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            New date
          </p>
          <p className="font-display text-sm font-semibold text-[var(--accent-deep)]">
            {formatLongDate(newDateISO)}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--accent-soft)]/70 px-2.5 py-2.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Impact
          </p>
          <p className="font-display text-sm font-semibold text-[var(--accent-deep)]">
            {recommendation.lifestyleImpact}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={onAccept} size="full" aria-label={`Gain ${recommendation.estimatedDaysGained} days`}>
          {recommendation.kind === "income_bridge"
            ? `Cover bills · ${formatMoney(recommendation.savingsAmount)}`
            : recommendation.kind === "income_growth"
              ? `Add ~${formatMoney(recommendation.savingsAmount)}/mo`
            : recommendation.category === "goal-health"
              ? recommendation.applyCancelGoal
                ? "Pause this goal"
                : recommendation.applyTargetPrice
                  ? "Right-size"
                  : recommendation.applyOptionalTargetDate
                    ? "Push date"
                    : "Approve"
              : recommendation.kind === "reallocation"
              ? `Rearrange · ${recommendation.estimatedDaysGained}d`
              : recommendation.kind === "portfolio"
                ? recommendation.applyDailyContributionRate
                  ? `$${recommendation.applyDailyContributionRate}/day`
                  : recommendation.applyOptionalTargetDate
                    ? "Adjust date"
                    : recommendation.applyTargetPrice
                      ? "Right-size"
                      : recommendation.applyPriority
                        ? "Update rank"
                        : "Optimize"
                : `Gain ${recommendation.estimatedDaysGained} days`}
        </Button>
        <Button onClick={onReject} variant="outline" size="full">
          <X className="h-4 w-4" />
          Not for me
        </Button>
      </div>
    </Card>
  );
}
