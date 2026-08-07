/**
 * Disposable surplus → goal funding.
 * Free-to-spend is not just a display number: it can finish (or shorten) goals
 * without relying only on habit-cut recommendations.
 */

import {
  daysFromSavings,
  estimatedPurchaseDate,
  remainingAmount,
  safeSpendBreakdown,
} from "./calculations";
import { isRunningDeficit } from "./deficit";
import { netProtectedObligations } from "./income";
import { riskReserveAvailable } from "./risk";
import type {
  Goal,
  Recommendation,
  RiskState,
  UserProfile,
} from "./types";
import { formatMoney } from "./utils";

export function obligationsNetForUser(user: UserProfile): number {
  return netProtectedObligations(
    user.upcomingObligations,
    user.incomeStreams ?? []
  );
}

export function surplusBreakdown(
  user: UserProfile,
  risk: RiskState,
  goals: Goal[]
) {
  return safeSpendBreakdown({
    checkingBalance: user.checkingBalance,
    goalReserveBalance: user.goalReserveBalance,
    obligationsTotal: obligationsNetForUser(user),
    riskEarmark: Math.min(
      riskReserveAvailable(risk),
      Math.max(0, user.riskReserveBalance)
    ),
    goals,
  });
}

/**
 * Cash that can still move into this goal from checking without
 * raiding other goals’ parked reserves or the risk cushion.
 *
 * Headline free-to-spend includes goal pots (until purchased). Surplus for
 * topping up a goal is only the unallocated slice, capped by checking —
 * never invent money that isn’t in Student Checking.
 */
export function surplusAvailableForGoal(
  user: UserProfile,
  risk: RiskState,
  goals: Goal[],
  _goalId: string
): number {
  const unallocated = Math.max(0, surplusBreakdown(user, risk, goals).unallocated);
  return Math.max(0, Math.min(unallocated, user.checkingBalance));
}

/** Surplus for a not-yet-added goal (create flow). */
export function surplusAvailableForNewGoal(
  user: UserProfile,
  risk: RiskState,
  existingGoals: Goal[],
  targetPrice: number,
  fundedAmount = 0
): number {
  const ghost: Goal = {
    id: "__new__",
    name: "New",
    targetPrice,
    originalTargetPrice: targetPrice,
    fundedAmount,
    category: "Other",
    projectedPurchaseDate: user.nextPaycheckDate,
    originalProjectedDate: user.nextPaycheckDate,
    completed: false,
    purchased: false,
    saleApplied: false,
    createdAt: user.nextPaycheckDate,
    priority: 1,
    contributions: [],
  };
  return surplusAvailableForGoal(user, risk, [ghost, ...existingGoals], ghost.id);
}

export function projectGoalPurchaseDate(
  goal: Pick<Goal, "fundedAmount" | "targetPrice" | "id">,
  user: UserProfile,
  risk: RiskState,
  goals: Goal[],
  demoToday: string
): string {
  const surplus = surplusAvailableForGoal(user, risk, goals, goal.id);
  return estimatedPurchaseDate(
    goal.fundedAmount,
    goal.targetPrice,
    user.dailyContributionRate,
    demoToday,
    surplus
  );
}

/** True when reserve already covers the price, or free-to-spend can finish it. */
export function canCompleteGoalNow(
  goal: Pick<Goal, "id" | "fundedAmount" | "targetPrice" | "purchased">,
  user: UserProfile,
  risk: RiskState,
  goals: Goal[]
): boolean {
  if (goal.purchased) return false;
  const remaining = remainingAmount(goal.fundedAmount, goal.targetPrice);
  if (remaining <= 0) return true;
  return surplusAvailableForGoal(user, risk, goals, goal.id) >= remaining;
}

/** $ still needed from checking to finish the goal reserve. */
export function shortfallToComplete(
  goal: Pick<Goal, "fundedAmount" | "targetPrice">
): number {
  return remainingAmount(goal.fundedAmount, goal.targetPrice);
}

/**
 * Recommend moving free-to-spend into the goal reserve.
 * This is a first-class “get closer” path alongside habit tips.
 */
export function buildSurplusAllocationRecommendation(input: {
  goal: Goal;
  user: UserProfile;
  risk: RiskState;
  goals: Goal[];
  demoToday: string;
  makeId: () => string;
  history?: Recommendation[];
}): Recommendation | null {
  const { goal, user, risk, goals, makeId, history = [] } = input;
  if (goal.purchased || goal.completed) return null;
  // Never recommend moving “free” cash while income < bills
  if (isRunningDeficit(user, goals, input.demoToday)) return null;

  const remaining = remainingAmount(goal.fundedAmount, goal.targetPrice);
  if (remaining <= 0) return null;

  const tipKey = "surplus-allocate";
  const already = history.some(
    (r) =>
      r.goalId === goal.id &&
      r.tipKey === tipKey &&
      (r.status === "pending" ||
        r.status === "accepted" ||
        r.status === "rejected" ||
        r.status === "superseded")
  );
  if (already) return null;

  const breakdown = surplusBreakdown(user, risk, goals);
  // Only unallocated cash can move without raiding other goals' pots
  if (breakdown.unallocated < 25) return null;

  const amount = Math.min(remaining, Math.round(breakdown.unallocated));
  if (amount < 1) return null;

  const coversAll = amount >= remaining;
  const daysGained = coversAll
    ? daysFromSavings(remaining, Math.max(1, user.dailyContributionRate))
    : daysFromSavings(amount, Math.max(1, user.dailyContributionRate));

  return {
    id: makeId(),
    tipKey,
    repeatable: false,
    kind: "surplus_allocation",
    title: coversAll
      ? `Finish ${goal.name} from free-to-spend`
      : `Put ${formatMoney(amount)} of free cash toward ${goal.name}`,
    description: coversAll
      ? `You have ${formatMoney(breakdown.unallocated)} flexible after bills, other goal pots, and risk — enough to move the remaining ${formatMoney(remaining)} into ${goal.name} today without cutting habits.`
      : `Flexible cash is ${formatMoney(breakdown.unallocated)}. Move ${formatMoney(amount)} from checking into ${goal.name}’s reserve to get closer without waiting on coffee/shuttle tips.`,
    savingsAmount: amount,
    estimatedDaysGained: Math.max(1, daysGained),
    disruptionScore: 1,
    category: "surplus",
    lifestyleImpact: "Low",
    status: "pending",
    goalId: goal.id,
    evidenceSummary: `Flexible ${formatMoney(breakdown.unallocated)} · still to fund ${formatMoney(remaining)}`,
  };
}
