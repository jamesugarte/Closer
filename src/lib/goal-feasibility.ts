/**
 * Goal feasibility advisory — likelihood of funding a goal by a date
 * if Maya keeps her current savings pace (and optional risk rollover bonuses).
 */

import { computeFinancialFreedomScore } from "./balance-sheet";
import {
  daysUntil,
  estimatedPurchaseDate,
  remainingAmount,
  safeSpendBreakdown,
} from "./calculations";
import { incomeSummary, netProtectedObligations } from "./income";
import { riskReserveAvailable } from "./risk";
import { surplusAvailableForNewGoal } from "./surplus";
import type { Goal, RiskState, UserProfile } from "./types";
import { formatLongDate, formatMoney } from "./utils";

export type FeasibilityLevel =
  | "unreachable"
  | "stretch"
  | "achievable"
  | "on_track";

export interface GoalFeasibilityAdvisory {
  level: FeasibilityLevel;
  /** 0–100 chance-style score under constant-pace assumptions */
  likelihoodPct: number;
  daysAvailable: number | null;
  monthsAvailable: number | null;
  remaining: number;
  projectedFromPace: string;
  fundedByDeadline: number;
  /** Base auto-save by deadline (daily rate × days) */
  savingsFromPace: number;
  /** Expected quiet-month risk→goal bonuses if she keeps accepting them */
  expectedRiskBonus: number;
  shortfall: number;
  /** True when doable on paper but would gut free cash / freedom score */
  freedomAtRisk: boolean;
  freedomImpactScore: number;
  freedomNote: string;
  headline: string;
  detail: string;
  assumptions: string[];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Expected $ from quiet-month risk bonuses before a deadline.
 * Assumes ~half of months stay quiet enough for a good-job tip (~20–25% of
 * monthly risk budget), and Maya accepts — optimistic but bounded.
 */
export function expectedRiskBonusesByDeadline(
  risk: RiskState,
  monthsAvailable: number
): number {
  if (monthsAvailable <= 0) return 0;
  const perQuiet = Math.min(25, Math.max(10, Math.round(risk.monthlyBudget * 0.25)));
  const quietMonths = monthsAvailable * 0.5;
  return Math.round(perQuiet * quietMonths);
}

export function assessGoalFeasibility(input: {
  targetPrice: number;
  fundedAmount?: number;
  optionalTargetDate?: string;
  demoToday: string;
  dailyContributionRate: number;
  user: UserProfile;
  risk: RiskState;
  goals: Goal[];
  /** If this new goal would take #1 preference */
  prioritize?: boolean;
  goalName?: string;
}): GoalFeasibilityAdvisory {
  const funded = input.fundedAmount ?? 0;
  const remaining = remainingAmount(funded, input.targetPrice);
  const rate =
    input.dailyContributionRate > 0 ? input.dailyContributionRate : 1;

  const surplusRaw = surplusAvailableForNewGoal(
    input.user,
    input.risk,
    input.goals,
    input.targetPrice,
    funded
  );
  // Unallocated cash only — parked goal pots must not fake “fundable today”
  const breakdown = safeSpendBreakdown({
    checkingBalance: input.user.checkingBalance,
    goalReserveBalance: input.user.goalReserveBalance,
    obligationsTotal: netProtectedObligations(
      input.user.upcomingObligations,
      input.user.incomeStreams ?? []
    ),
    riskEarmark: riskReserveAvailable(input.risk),
    goals: [
      {
        name: input.goalName ?? "Goal",
        targetPrice: input.targetPrice,
        fundedAmount: funded,
        purchased: false,
      },
      ...input.goals.filter((g) => !g.purchased),
    ],
  });
  const surplus = Math.min(surplusRaw, Math.max(0, breakdown.unallocated));

  const projectedFromPace = estimatedPurchaseDate(
    funded,
    input.targetPrice,
    rate,
    input.demoToday,
    surplus
  );

  const hasDeadline = Boolean(input.optionalTargetDate);
  const rawDays = hasDeadline
    ? daysUntil(input.demoToday, input.optionalTargetDate!)
    : daysUntil(input.demoToday, projectedFromPace);
  const deadlinePassed =
    hasDeadline &&
    daysUntil(input.demoToday, input.optionalTargetDate!) === 0 &&
    input.optionalTargetDate! < input.demoToday;
  const daysAvailable = rawDays;
  const monthsAvailable = daysAvailable / 30.44;

  // Competing goals: if not prioritized, she only gets a share of the $3/day
  const activeOthers = input.goals.filter((g) => !g.purchased);
  const priorityShare =
    input.prioritize !== false || activeOthers.length === 0
      ? 1
      : 1 / (activeOthers.length + 1);

  const effectiveDaily = rate * priorityShare;
  const savingsFromPace = Math.round(effectiveDaily * daysAvailable);
  const expectedRiskBonus = expectedRiskBonusesByDeadline(
    input.risk,
    monthsAvailable
  );
  // Risk bonus only meaningfully lands on the focused/#1 goal
  const riskBonusApplied =
    input.prioritize !== false ? expectedRiskBonus : Math.round(expectedRiskBonus * 0.35);

  // Disposable surplus can finish the goal without waiting on auto-save
  const surplusApplied = Math.min(remaining, surplus);
  const fundedByDeadline =
    funded + surplusApplied + savingsFromPace + riskBonusApplied;
  const shortfall = Math.max(0, input.targetPrice - fundedByDeadline);
  const coverage =
    input.targetPrice > 0 ? fundedByDeadline / input.targetPrice : 1;

  let likelihoodPct = Math.round(clamp(coverage * 100, 0, 100));
  // Soften: even 100% coverage isn't certainty — unless surplus covers it now
  if (surplusApplied >= remaining && remaining > 0) likelihoodPct = 98;
  else if (likelihoodPct >= 95) likelihoodPct = 92;
  if (hasDeadline && daysAvailable < 14 && shortfall > 0) {
    likelihoodPct = Math.min(likelihoodPct, 25);
  }

  let level: FeasibilityLevel;
  if (deadlinePassed) {
    level = "unreachable";
    likelihoodPct = 0;
  } else if (surplusApplied >= remaining && remaining >= 0)
    level = "on_track";
  else if (coverage >= 1.05 || (coverage >= 1 && !hasDeadline)) level = "on_track";
  else if (coverage >= 0.85) level = "achievable";
  else if (coverage >= 0.55) level = "stretch";
  else level = "unreachable";

  // Freedom impact: committing this goal's remaining into earmarks
  const riskEarmark = riskReserveAvailable(input.risk);
  const obligationsNet = netProtectedObligations(
    input.user.upcomingObligations,
    input.user.incomeStreams ?? []
  );
  const hypotheticalGoals = [
    {
      name: input.goalName ?? "New goal",
      targetPrice: input.targetPrice,
      fundedAmount: funded,
      purchased: false,
    },
    ...input.goals
      .filter((g) => !g.purchased)
      .map((g) => ({
        name: g.name,
        targetPrice: g.targetPrice,
        fundedAmount: g.fundedAmount,
        purchased: false,
      })),
  ];

  const before = safeSpendBreakdown({
    checkingBalance: input.user.checkingBalance,
    goalReserveBalance: input.user.goalReserveBalance,
    obligationsTotal: obligationsNet,
    riskEarmark,
    goals: input.goals,
  });
  const after = safeSpendBreakdown({
    checkingBalance: input.user.checkingBalance,
    goalReserveBalance: input.user.goalReserveBalance,
    obligationsTotal: obligationsNet,
    riskEarmark,
    goals: hypotheticalGoals,
  });

  const freedomBefore = computeFinancialFreedomScore({
    liquidAssets:
      input.user.checkingBalance +
      input.user.goalReserveBalance +
      input.user.riskReserveBalance,
    obligations: obligationsNet,
    freeToSpend: before.unallocated,
    pool: before.pool,
    reservedTowardGoals: before.reservedTowardGoals,
    goalTargets: before.goalTargets,
    riskReserve: input.user.riskReserveBalance,
    riskMonthlyBudget: input.risk.monthlyBudget,
  });

  const freedomAfter = computeFinancialFreedomScore({
    liquidAssets:
      input.user.checkingBalance +
      input.user.goalReserveBalance +
      input.user.riskReserveBalance,
    obligations: obligationsNet,
    freeToSpend: after.unallocated,
    pool: after.pool,
    reservedTowardGoals: after.reservedTowardGoals,
    goalTargets: after.goalTargets,
    riskReserve: input.user.riskReserveBalance,
    riskMonthlyBudget: input.risk.monthlyBudget,
  });

  const freedomDrop = freedomBefore - freedomAfter;
  const freeShareCommitted =
    before.unallocated > 0
      ? clamp(
          (before.unallocated - after.unallocated) / before.unallocated,
          0,
          1
        )
      : remaining > before.unallocated
        ? 1
        : 0;

  const freedomAtRisk =
    level !== "unreachable" &&
    (freedomDrop >= 18 ||
      freeShareCommitted >= 0.75 ||
      after.unallocated < 80);

  const freedomImpactScore = Math.round(
    clamp(freedomDrop * 2 + freeShareCommitted * 40, 0, 100)
  );

  const income = incomeSummary(input.user.incomeStreams ?? []);
  const monthlySave = Math.round(effectiveDaily * 30);

  const assumptions = [
    surplusApplied > 0
      ? `Free-to-spend can cover ${formatMoney(surplusApplied)} of the remaining ${formatMoney(remaining)} today`
      : "No disposable surplus available beyond bills, earmarks, and risk",
    `Pace $${rate}/day toward goals${priorityShare < 1 ? ` (≈${Math.round(priorityShare * 100)}% share if not #1)` : " as #1 preference"}`,
    `≈$${monthlySave}/mo auto-save under that share`,
    riskBonusApplied > 0
      ? `+≈$${riskBonusApplied} from expected quiet-month risk bonuses if accepted`
      : "No risk-bonus credit (lower preference)",
    `Obligations ~$${obligationsNet}/mo after bursar aid (aid is not extra income); liquid into checking ~$${income.liquidMonthly}/mo`,
    "No new shocks beyond the existing risk cushion story",
  ];

  let headline: string;
  let detail: string;
  const name = input.goalName?.trim() || "This goal";
  const byWhen = hasDeadline
    ? formatLongDate(input.optionalTargetDate!)
    : formatLongDate(projectedFromPace);

  if (deadlinePassed) {
    headline = `Deadline passed`;
    detail = `Pick a future date. Still need ≈${formatMoney(remaining)}.`;
  } else if (surplusApplied >= remaining && remaining > 0) {
    headline = `Fundable from free-to-spend`;
    detail = `${formatMoney(remaining)} left — surplus covers it. Move checking → goal.`;
  } else if (level === "unreachable") {
    headline = `Unlikely by ${byWhen}`;
    detail = `Need ${formatMoney(remaining)}; pace only gets ≈${formatMoney(fundedByDeadline)} (short ${formatMoney(shortfall)}).`;
  } else if (level === "stretch") {
    headline = `Stretch`;
    detail = `~${Math.round(coverage * 100)}% coverage by ${byWhen}. Little room for shocks.`;
  } else if (freedomAtRisk) {
    headline = `Doable · hits freedom`;
    detail = `Flexible cash → ${formatMoney(after.unallocated)} · freedom ${freedomBefore}→${freedomAfter}.`;
  } else if (level === "on_track") {
    headline = `On track for ${byWhen}`;
    detail = `$${rate}/day clears it${surplusApplied > 0 ? ` (+${formatMoney(surplusApplied)} surplus)` : ""}.`;
  } else {
    headline = `Achievable by ${byWhen}`;
    detail = `~${likelihoodPct}% if pace holds.`;
  }

  return {
    level,
    likelihoodPct,
    daysAvailable: hasDeadline || remaining > 0 ? daysAvailable : null,
    monthsAvailable: hasDeadline ? Math.round(monthsAvailable * 10) / 10 : null,
    remaining,
    projectedFromPace,
    fundedByDeadline,
    savingsFromPace,
    expectedRiskBonus: riskBonusApplied,
    shortfall,
    freedomAtRisk,
    freedomImpactScore,
    freedomNote: freedomAtRisk
      ? `Freedom score impact ~${freedomImpactScore}/100 (flexible cash ${formatMoney(before.unallocated)}→${formatMoney(after.unallocated)})`
      : `Freedom impact modest (~${freedomImpactScore}/100)`,
    headline,
    detail,
    assumptions,
  };
}
