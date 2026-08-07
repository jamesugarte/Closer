/**
 * Goals as installment plans — like loan payments due until the end date.
 *
 * Each active goal has a monthly payment:
 *   remaining ÷ months until end date (want-by or projected)
 * Higher-priority goals are paid first when cash is tight.
 */

import { daysUntil, remainingAmount } from "./calculations";
import type { Goal } from "./types";

export function goalEndDate(goal: Pick<Goal, "optionalTargetDate" | "projectedPurchaseDate">): string {
  return goal.optionalTargetDate || goal.projectedPurchaseDate;
}

/** Whole months left until the goal’s end date (≥ 1 while still open). */
export function monthsUntilGoalEnd(
  demoToday: string,
  goal: Pick<Goal, "optionalTargetDate" | "projectedPurchaseDate">
): number {
  const days = daysUntil(demoToday, goalEndDate(goal));
  if (days <= 0) return 1;
  return Math.max(1, Math.ceil(days / 30.44));
}

/** This month’s installment due to stay on plan. */
export function installmentDueThisMonth(
  demoToday: string,
  goal: Pick<
    Goal,
    "fundedAmount" | "targetPrice" | "optionalTargetDate" | "projectedPurchaseDate" | "purchased"
  >
): number {
  if (goal.purchased) return 0;
  const remaining = remainingAmount(goal.fundedAmount, goal.targetPrice);
  if (remaining <= 0) return 0;
  const months = monthsUntilGoalEnd(demoToday, goal);
  return Math.max(1, Math.ceil(remaining / months));
}

/**
 * Pay installments in priority order (#1 first) from available checking.
 * Returns per-goal amounts and total paid.
 */
export function allocateGoalInstallments(input: {
  available: number;
  demoToday: string;
  goals: Goal[];
}): { splits: Record<string, number>; total: number } {
  let cash = Math.max(0, Math.floor(input.available));
  const splits: Record<string, number> = {};
  if (cash <= 0) return { splits, total: 0 };

  const active = input.goals
    .filter((g) => !g.purchased && remainingAmount(g.fundedAmount, g.targetPrice) > 0)
    .sort((a, b) => a.priority - b.priority);

  for (const g of active) {
    if (cash <= 0) break;
    const due = installmentDueThisMonth(input.demoToday, g);
    const pay = Math.min(due, cash, remainingAmount(g.fundedAmount, g.targetPrice));
    if (pay <= 0) continue;
    splits[g.id] = pay;
    cash -= pay;
  }

  const total = Object.values(splits).reduce((s, n) => s + n, 0);
  return { splits, total };
}

/** Human label for UI / activity. */
export function installmentLabel(
  demoToday: string,
  goal: Goal
): string {
  const due = installmentDueThisMonth(demoToday, goal);
  const months = monthsUntilGoalEnd(demoToday, goal);
  return `$${due}/mo × ~${months} mo to ${goalEndDate(goal)}`;
}
