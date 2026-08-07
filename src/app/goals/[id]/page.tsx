"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PartyPopper, Tag } from "lucide-react";
import { BatteryMeter } from "@/components/BatteryMeter";
import { DateTimeline } from "@/components/DateTimeline";
import { DemoBanner } from "@/components/DemoBanner";
import { GoalAdvisoryCard } from "@/components/GoalAdvisoryCard";
import { GoalArt } from "@/components/GoalArt";
import { PurchaseModal } from "@/components/PurchaseModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/AppContext";
import { daysUntil, priceOpportunityEligible } from "@/lib/calculations";
import { assessGoalFeasibility } from "@/lib/goal-feasibility";
import {
  installmentDueThisMonth,
  monthsUntilGoalEnd,
} from "@/lib/goal-installments";
import {
  canCompleteGoalNow,
  shortfallToComplete,
} from "@/lib/surplus";
import { formatLongDate, formatMoney } from "@/lib/utils";

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    state,
    hydrated,
    fundingPct,
    daysAway,
    focusGoal,
    setDesiredDate,
    acceptRecommendation,
    simulatePriceOpportunity,
    confirmPurchase,
  } = useApp();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [saleFlash, setSaleFlash] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const goal = useMemo(
    () => state.goals.find((g) => g.id === params.id),
    [state.goals, params.id]
  );

  useEffect(() => {
    if (params.id && goal && !goal.purchased) focusGoal(params.id);
  }, [params.id, goal, focusGoal]);

  const history = useMemo(
    () =>
      state.recommendations.filter(
        (r) => r.goalId === params.id && r.status !== "pending"
      ),
    [state.recommendations, params.id]
  );

  if (!hydrated) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="space-y-4">
        <p>Goal not found.</p>
        <Link href="/goals">
          <Button variant="outline">Back to goals</Button>
        </Link>
      </div>
    );
  }

  const pct = fundingPct(goal);
  const reserveReady = pct >= 100 || goal.completed;
  const canBuy = canCompleteGoalNow(goal, state.user, state.risk, state.goals);
  const topUp = shortfallToComplete(goal);
  const ready = reserveReady || canBuy;
  const purchased = goal.purchased;
  const daysEarlier = daysUntil(state.demoToday, goal.originalProjectedDate);
  const saleEligible = priceOpportunityEligible(
    goal.fundedAmount,
    goal.targetPrice
  );
  const stillNeed = Math.max(0, goal.targetPrice - goal.fundedAmount);

  const advisory = assessGoalFeasibility({
    targetPrice: goal.targetPrice,
    fundedAmount: goal.fundedAmount,
    optionalTargetDate: goal.optionalTargetDate || goal.projectedPurchaseDate,
    demoToday: state.demoToday,
    dailyContributionRate: state.user.dailyContributionRate,
    user: state.user,
    risk: state.risk,
    goals: state.goals.filter((g) => g.id !== goal.id),
    prioritize: goal.priority === 1,
    goalName: goal.name,
  });

  function handleSale() {
    if (!saleEligible) return;
    simulatePriceOpportunity(goal!.id);
    setSaleFlash(true);
  }

  function handleConfirmPurchase() {
    const result = confirmPurchase(goal!.id);
    if (!result.ok) {
      setPurchaseError(
        result.message ??
          (result.reason === "insufficient_funds"
            ? "Not enough in checking / free cash to finish this purchase."
            : "Purchase didn’t go through.")
      );
      return;
    }
    setPurchaseError(null);
    setPurchaseOpen(false);
    // Home shows free-to-spend, checking, and the new spend in one place
    router.push("/?spent=1");
  }

  if (purchased) {
    return (
      <div className="animate-celebrate space-y-4">
        <DemoBanner />
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <PartyPopper className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Goal achieved</h1>
          <p className="mt-2 text-[var(--muted)]">
            You reached {goal.name} {daysEarlier} days earlier than the original
            projection.
          </p>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Simulated purchase at Campus Tech Store for{" "}
            {formatMoney(goal.targetPrice)}.
          </p>
          <Link href="/goals/new" className="mt-6 block">
            <Button size="full">Create your next goal</Button>
          </Link>
          <Link href="/spending" className="mt-2 block">
            <Button size="full" variant="ghost">
              View spending
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DemoBanner />
      <button
        type="button"
        onClick={() => router.push("/goals")}
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Goals
      </button>

      <div className="flex gap-3">
        <GoalArt category={goal.category} name={goal.name} className="h-24 w-24" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            {goal.category}
            {typeof goal.priority === "number" && (
              <span className="ml-2 text-[var(--accent-deep)]">
                Preference #{goal.priority}
              </span>
            )}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {goal.name}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Target {formatMoney(goal.targetPrice)}
            {goal.saleApplied && goal.originalTargetPrice !== goal.targetPrice && (
              <span className="ml-2 line-through">
                {formatMoney(goal.originalTargetPrice)}
              </span>
            )}
          </p>
        </div>
      </div>

      {ready && (
        <Card className="animate-celebrate border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-start gap-3">
            <PartyPopper className="h-6 w-6 text-emerald-600" />
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold text-emerald-900">
                {reserveReady ? "Fully funded" : "Ready to buy"}
              </h2>
              <p className="mt-1 text-sm text-emerald-900/70">
                {reserveReady
                  ? "Your reserve covers the current price. Review a simulated purchase when you’re ready — nothing happens without your confirmation."
                  : `Free-to-spend covers the remaining ${formatMoney(topUp)}. Confirm purchase and Closer moves that from checking into the goal, then completes the buy.`}
              </p>
              <Button
                className="mt-4"
                size="full"
                onClick={() => setPurchaseOpen(true)}
              >
                Review purchase
              </Button>
            </div>
          </div>
        </Card>
      )}

      {saleFlash && goal.saleApplied && (
        <Card className="animate-soft-in border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <div className="flex gap-3">
            <Tag className="h-5 w-5 text-amber-700" />
            <div>
              <h2 className="font-display text-lg font-semibold">
                Price drop · you can buy now
              </h2>
              <p className="mt-1 text-sm">
                {goal.name} is {formatMoney(goal.targetPrice)} this week (was{" "}
                {formatMoney(goal.originalTargetPrice)}). Your{" "}
                {formatMoney(goal.fundedAmount)} reserve covers it.
              </p>
              <p className="mt-2 text-sm font-medium text-amber-900">
                Waiting unlocked the purchase — review it below when ready.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex justify-between text-sm">
          <span className="text-[var(--muted)]">Amount funded</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(goal.fundedAmount)}
          </span>
        </div>
        <BatteryMeter percent={pct} size="lg" />
        {!purchased && stillNeed > 0 && (
          <p className="mt-3 rounded-xl bg-[var(--accent-soft)]/60 px-3 py-2 text-[12px] leading-snug text-[var(--accent-deep)]">
            Payment plan{" "}
            <span className="font-semibold tabular-nums">
              {formatMoney(installmentDueThisMonth(state.demoToday, goal))}
            </span>
            /mo · ~{monthsUntilGoalEnd(state.demoToday, goal)} mo left — paid
            after bills &amp; risk, before discretionary spend.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/[0.03] p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Projected
            </p>
            <p
              key={goal.projectedPurchaseDate}
              className="animate-date font-display text-lg font-semibold text-[var(--accent-deep)]"
            >
              {ready ? "Today" : formatLongDate(goal.projectedPurchaseDate)}
            </p>
          </div>
          <div className="rounded-2xl bg-black/[0.03] p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Days remaining
            </p>
            <p className="font-display text-lg font-semibold">
              {ready ? "0" : daysAway(goal)}
            </p>
          </div>
        </div>
      </Card>

      {!ready && <GoalAdvisoryCard advisory={advisory} />}

      <DateTimeline
        originalDate={goal.originalProjectedDate}
        currentDate={goal.projectedPurchaseDate}
        isReady={ready}
        animateKey={`${goal.id}-${goal.projectedPurchaseDate}-${goal.fundedAmount}-${goal.saleApplied}`}
        fundedAmount={goal.fundedAmount}
        targetPrice={goal.targetPrice}
        dailyContributionRate={state.user.dailyContributionRate}
        desiredDate={goal.optionalTargetDate}
        onDesiredDateChange={(iso) => setDesiredDate(goal.id, iso)}
        recommendations={state.recommendations.filter((r) => r.goalId === goal.id)}
        onAcceptRecommendation={acceptRecommendation}
        demoToday={state.demoToday}
      />

      <Card>
        <h3 className="font-display text-base font-semibold">Recent contributions</h3>
        <ul className="mt-3 space-y-3">
          {goal.contributions.length === 0 && (
            <li className="text-sm text-[var(--muted)]">No contributions yet</li>
          )}
          {goal.contributions.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-[var(--muted)]">{formatLongDate(c.date)}</p>
              </div>
              <span className="font-semibold tabular-nums text-[var(--success)]">
                +{formatMoney(c.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-display text-base font-semibold">
          Recommendation history
        </h3>
        <ul className="mt-3 space-y-3">
          {history.length === 0 && (
            <li className="text-sm text-[var(--muted)]">
    Accept or skip a tip on Goals to see history here.
            </li>
          )}
          {history.map((r) => (
            <li key={r.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium leading-snug">{r.description}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    r.status === "accepted"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-black/5 text-[var(--muted)]"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {formatMoney(r.savingsAmount)} · {r.estimatedDaysGained} days ·{" "}
                {r.lifestyleImpact} impact
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {!goal.saleApplied && (
        <div className="space-y-2">
          <Button
            variant="warm"
            size="full"
            onClick={handleSale}
            disabled={!saleEligible}
          >
            <Tag className="h-4 w-4" />
            {saleEligible
              ? "Simulate price opportunity"
              : "Price drop locked"}
          </Button>
          <p className="px-1 text-center text-[11px] leading-snug text-[var(--muted)]">
            {saleEligible
              ? "A realistic sale will drop the price to what you’ve already reserved — then you can buy."
              : stillNeed > 0
                ? `A sale only helps when you’re close. Reserve ~${formatMoney(Math.max(0, stillNeed - 50))}–${formatMoney(stillNeed)} more (accept tips) so a discount can unlock purchase.`
                : "Already funded at full price — no sale needed."}
          </p>
        </div>
      )}

      <Link href="/goals/new" className="block">
        <Button variant="outline" size="full">
          Add a new goal
        </Button>
      </Link>

      <PurchaseModal
        goal={goal}
        open={purchaseOpen}
        onClose={() => {
          setPurchaseOpen(false);
          setPurchaseError(null);
        }}
        onConfirm={handleConfirmPurchase}
        surplusTopUp={reserveReady ? 0 : topUp}
        checkingBalance={state.user.checkingBalance}
        goalReserveBalance={state.user.goalReserveBalance}
        error={purchaseError}
      />
    </div>
  );
}
