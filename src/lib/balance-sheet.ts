/**
 * Balance sheet / financial freedom tracker for the Closer demo.
 *
 * Liquid assets grow when Maya saves and shrink with living spend + bills.
 * Financial freedom is a 0–100 interview-friendly score: more cushion,
 * more goal funding progress, and less reliance on paycheck-to-paycheck.
 */

import { remainingAmount, safeSpendBreakdown } from "./calculations";
import { monthlyCashflow } from "./income";
import { riskReserveAvailable } from "./risk";
import type { BalanceSnapshot, Goal, RiskState, UserProfile } from "./types";

export type { BalanceSnapshot };

export function computeFinancialFreedomScore(input: {
  liquidAssets: number;
  obligations: number;
  freeToSpend: number;
  pool: number;
  reservedTowardGoals: number;
  goalTargets: number;
  riskReserve: number;
  riskMonthlyBudget: number;
  /** Signed monthly income − bills; negative hurts the score */
  monthlyCashflow?: number;
}): number {
  const afterBills = Math.max(0, input.liquidAssets - input.obligations);
  const cushionRatio = Math.min(1, afterBills / Math.max(800, input.obligations * 2));
  const freeRatio =
    input.pool > 0 ? Math.min(1, input.freeToSpend / input.pool) : 0;
  const goalProgress =
    input.goalTargets > 0
      ? Math.min(1, input.reservedTowardGoals / input.goalTargets)
      : 0.5;
  const riskHealth = Math.min(
    1,
    input.riskReserve / Math.max(40, input.riskMonthlyBudget * 1.5)
  );

  // Cashflow health: 0 when income covers bills; penalize deficits up to −1
  const cf = input.monthlyCashflow;
  let cashflowHealth = 1;
  if (cf != null) {
    if (cf >= 0) {
      cashflowHealth = Math.min(1, cf / Math.max(200, input.obligations * 0.15));
    } else {
      cashflowHealth = Math.max(-1, cf / Math.max(400, input.obligations * 0.5));
    }
  }

  const raw =
    cushionRatio * 30 +
    freeRatio * 15 +
    goalProgress * 25 +
    riskHealth * 15 +
    ((cashflowHealth + 1) / 2) * 15; // map [-1,1] → [0,1], weight 15%
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function captureBalanceSnapshot(input: {
  date: string;
  monthsAdvanced: number;
  user: UserProfile;
  goals: Goal[];
  risk: RiskState;
}): BalanceSnapshot {
  const streams = input.user.incomeStreams ?? [];
  // Risk earmark can’t exceed cash actually sitting in the risk pot
  const riskEarmark = Math.min(
    riskReserveAvailable(input.risk),
    Math.max(0, input.user.riskReserveBalance)
  );
  const flow = monthlyCashflow(streams, input.user.upcomingObligations);
  const obligationsNet = flow.netObligations;
  const breakdown = safeSpendBreakdown({
    checkingBalance: input.user.checkingBalance,
    goalReserveBalance: input.user.goalReserveBalance,
    obligationsTotal: obligationsNet,
    riskEarmark,
    goals: input.goals,
  });

  const liquidAssets =
    input.user.checkingBalance +
    input.user.goalReserveBalance +
    input.user.riskReserveBalance;

  const goalTargets = input.goals
    .filter((g) => !g.purchased)
    .reduce((s, g) => s + g.targetPrice, 0);

  const financialFreedomScore = computeFinancialFreedomScore({
    liquidAssets,
    obligations: obligationsNet,
    freeToSpend: breakdown.free,
    pool: breakdown.pool,
    reservedTowardGoals: breakdown.reservedTowardGoals,
    goalTargets,
    riskReserve: input.user.riskReserveBalance,
    riskMonthlyBudget: input.risk.monthlyBudget,
    monthlyCashflow: flow.cashflow,
  });

  return {
    date: input.date,
    monthsAdvanced: input.monthsAdvanced,
    checking: input.user.checkingBalance,
    goalReserves: input.user.goalReserveBalance,
    riskReserve: input.user.riskReserveBalance,
    liquidAssets,
    obligations: obligationsNet,
    pool: breakdown.pool,
    freeToSpend: breakdown.free,
    reservedTowardGoals: breakdown.reservedTowardGoals,
    stillToFund: breakdown.stillToFund,
    financialFreedomScore,
    liquidMonthly: flow.liquidMonthly,
    monthlyCashflow: flow.cashflow,
  };
}

/** Weight for monthly auto-save — priority 1 gets the largest share. */
export function priorityWeight(priority: number): number {
  const p = Math.max(1, priority);
  return 1 / p;
}

/**
 * Split a monthly savings pool across active goals by Maya's ranking,
 * then by remaining need so finished goals don’t keep absorbing cash.
 */
export function splitSavingsByPriority(
  pool: number,
  goals: {
    id: string;
    priority: number;
    fundedAmount: number;
    targetPrice: number;
  }[]
): Record<string, number> {
  const active = goals.filter(
    (g) => remainingAmount(g.fundedAmount, g.targetPrice) > 0
  );
  if (active.length === 0 || pool <= 0) return {};

  const weightedNeed = active.map((g) => {
    const remaining = remainingAmount(g.fundedAmount, g.targetPrice);
    const weight = priorityWeight(g.priority) * remaining;
    return { id: g.id, remaining, weight };
  });
  const totalWeight = weightedNeed.reduce((s, g) => s + g.weight, 0);
  if (totalWeight <= 0) return {};

  const out: Record<string, number> = {};
  let allocated = 0;
  for (let i = 0; i < weightedNeed.length; i++) {
    const g = weightedNeed[i];
    const raw =
      i === weightedNeed.length - 1
        ? pool - allocated
        : Math.round((g.weight / totalWeight) * pool);
    const add = Math.min(g.remaining, Math.max(0, raw));
    out[g.id] = add;
    allocated += add;
  }
  return out;
}
