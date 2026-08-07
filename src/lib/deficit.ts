/**
 * Deficit / income-bridge planning.
 *
 * Rule: if liquid monthly income < net protected obligations, the student
 * is running a deficit. Closer must NOT recommend discretionary cuts as the
 * primary fix — those cannot close a structural bills hole. Priority is new
 * income (loan / aid / hours) sized to:
 *   1) stop the monthly deficit for the rest of the term, and
 *   2) fund remaining active goals on the same horizon.
 */

import { remainingAmount, daysUntil } from "./calculations";
import { monthlyCashflow } from "./income";
import type {
  Goal,
  Recommendation,
  RiskState,
  UserProfile,
} from "./types";
import { formatMoney } from "./utils";

export const DEFICIT_TIP_KEY = "income-bridge-loan";
export const DEFICIT_REC_ID = "rec-income-bridge";

/** Academic months left in a typical fall/spring term from demo “today”. */
export function termMonthsRemaining(demoToday: string): number {
  const month = Number(demoToday.slice(5, 7));
  // Fall term ~ Aug–Dec (5 mo), Spring ~ Jan–May (5 mo); else 4.5 default
  if (month >= 8 && month <= 12) return Math.max(1, 13 - month);
  if (month >= 1 && month <= 5) return Math.max(1, 6 - month);
  return 4.5;
}

export interface DeficitPlan {
  runsDeficit: boolean;
  liquidMonthly: number;
  netObligations: number;
  /** max(0, bills − income) */
  monthlyDeficit: number;
  /** Sum of remaining on active goals */
  goalRemainingTotal: number;
  /** Months we size the bridge for (term or primary goal deadline) */
  monthsHorizon: number;
  /** Loan $ to cover the monthly bills hole through the horizon */
  loanToStopDeficit: number;
  /** Loan $ to finish active goals */
  loanForGoals: number;
  /** loanToStopDeficit + loanForGoals (rounded) */
  recommendedLoan: number;
  /** Extra $/mo income to break even on bills only */
  extraIncomeMonthlyToBreakeven: number;
  /** Extra $/mo to break even + fund goals over the horizon */
  extraIncomeMonthlyWithGoals: number;
  primaryGoalName: string | null;
}

export function assessDeficitPlan(input: {
  user: UserProfile;
  goals: Goal[];
  demoToday: string;
}): DeficitPlan {
  const flow = monthlyCashflow(
    input.user.incomeStreams ?? [],
    input.user.upcomingObligations
  );
  const monthlyDeficit = Math.max(0, Math.round(-flow.cashflow));
  const active = input.goals.filter((g) => !g.purchased);
  const goalRemainingTotal = active.reduce(
    (sum, g) => sum + remainingAmount(g.fundedAmount, g.targetPrice),
    0
  );
  const primary = [...active].sort((a, b) => a.priority - b.priority)[0];

  // Bills hole is sized to the academic term — never shrink it to a short goal deadline
  const termMonths = termMonthsRemaining(input.demoToday);
  let goalMonths = termMonths;
  if (primary?.optionalTargetDate) {
    const days = daysUntil(input.demoToday, primary.optionalTargetDate);
    if (days > 0) {
      goalMonths = Math.max(1, Math.round((days / 30.44) * 10) / 10);
    }
  }
  const monthsHorizon = Math.max(termMonths, goalMonths);

  const loanToStopDeficit = Math.round(monthlyDeficit * termMonths);
  const loanForGoals = Math.round(goalRemainingTotal);
  const recommendedLoan = Math.round(loanToStopDeficit + loanForGoals);
  const goalPaceMonthly =
    goalMonths > 0 ? Math.ceil(goalRemainingTotal / goalMonths) : goalRemainingTotal;

  return {
    runsDeficit: flow.cashflow < 0,
    liquidMonthly: flow.liquidMonthly,
    netObligations: flow.netObligations,
    monthlyDeficit,
    goalRemainingTotal,
    monthsHorizon,
    loanToStopDeficit,
    loanForGoals,
    recommendedLoan,
    extraIncomeMonthlyToBreakeven: monthlyDeficit,
    extraIncomeMonthlyWithGoals: monthlyDeficit + goalPaceMonthly,
    primaryGoalName: primary?.name ?? null,
  };
}

export function isRunningDeficit(
  user: UserProfile,
  goals: Goal[] = [],
  demoToday = user.nextPaycheckDate
): boolean {
  return assessDeficitPlan({ user, goals, demoToday }).runsDeficit;
}

/**
 * Build the hard-priority income-bridge recommendation.
 * savingsAmount = recommended loan (one-time / semester disbursement).
 */
export function buildDeficitLoanRecommendation(input: {
  user: UserProfile;
  goals: Goal[];
  demoToday: string;
  makeId?: () => string;
  history?: Recommendation[];
}): Recommendation | null {
  const plan = assessDeficitPlan(input);
  if (!plan.runsDeficit || plan.recommendedLoan < 1) return null;

  const history = input.history ?? [];
  const alreadyPending = history.some(
    (r) =>
      r.tipKey === DEFICIT_TIP_KEY &&
      (r.status === "pending" || r.status === "accepted")
  );
  if (alreadyPending) return null;

  const goalId =
    [...input.goals]
      .filter((g) => !g.purchased)
      .sort((a, b) => a.priority - b.priority)[0]?.id ?? "__income__";

  const goalBit =
    plan.loanForGoals > 0
      ? ` ${formatMoney(plan.loanForGoals)} for goals.`
      : "";

  return {
    id: input.makeId?.() ?? DEFICIT_REC_ID,
    tipKey: DEFICIT_TIP_KEY,
    repeatable: false,
    kind: "income_bridge",
    title: `Close the ${formatMoney(plan.monthlyDeficit)}/mo bills hole`,
    description: `Income ${formatMoney(plan.liquidMonthly)}/mo vs bills ${formatMoney(plan.netObligations)}/mo. Aid bridge ${formatMoney(plan.recommendedLoan)}: ${formatMoney(plan.loanToStopDeficit)} covers protected bills this term — earmarked, not free-to-spend.${goalBit}`,
    savingsAmount: plan.recommendedLoan,
    estimatedDaysGained: Math.max(1, Math.round(plan.monthsHorizon * 30)),
    disruptionScore: 3,
    category: "income",
    lifestyleImpact: "High",
    status: "pending",
    goalId,
    evidenceSummary: `${formatMoney(plan.loanToStopDeficit)} → bills · ${formatMoney(plan.loanForGoals)} → goals`,
    applyLoanAmount: plan.recommendedLoan,
    applyLoanForBills: plan.loanToStopDeficit,
    applyLoanForGoals: plan.loanForGoals,
    applyLoanMonthlyBillCredit: plan.monthlyDeficit,
    applyLoanMonthlyEquivalent: plan.monthlyDeficit,
  };
}

/**
 * When running a deficit: keep only the income-bridge tip pending;
 * supersede discretionary / surplus / portfolio tips.
 */
export function enforceDeficitPriority(
  recommendations: Recommendation[],
  user: UserProfile,
  goals: Goal[],
  demoToday: string,
  makeId?: () => string
): Recommendation[] {
  const plan = assessDeficitPlan({ user, goals, demoToday });
  if (!plan.runsDeficit) return recommendations;

  const bridge =
    recommendations.find(
      (r) => r.tipKey === DEFICIT_TIP_KEY && r.status === "pending"
    ) ??
    buildDeficitLoanRecommendation({
      user,
      goals,
      demoToday,
      makeId,
      history: recommendations,
    });

  const cleared = recommendations.map((r) => {
    if (r.tipKey === DEFICIT_TIP_KEY) return r;
    // Goal-health trade-offs stay available alongside the income bridge
    if (r.category === "goal-health") return r;
    if (
      r.status === "pending" &&
      (r.kind === "spend_pattern" ||
        r.kind === "surplus_allocation" ||
        r.kind === "reallocation" ||
        r.kind === "portfolio" ||
        r.kind === "pace" ||
        r.kind === "risk_avoidance" ||
        r.kind === "good_job_bonus")
    ) {
      return { ...r, status: "superseded" as const };
    }
    return r;
  });

  if (!bridge) return cleared;
  if (cleared.some((r) => r.id === bridge.id || r.tipKey === DEFICIT_TIP_KEY)) {
    return cleared.map((r) =>
      r.tipKey === DEFICIT_TIP_KEY && r.status !== "accepted"
        ? { ...bridge, id: r.id, status: "pending" as const }
        : r
    );
  }
  return [bridge, ...cleared];
}

/** True when this tip is allowed while cashflow is negative. */
export function tipAllowedDuringDeficit(kind: Recommendation["kind"]): boolean {
  return kind === "income_bridge" || kind === "income_growth";
}

/**
 * Apply an accepted income-bridge loan.
 *
 * Bills portion → monthly bill credit (landsInChecking: false). That money
 * never hits free-to-spend — it pays dorm / meal / tuition.
 * Goals portion → checking only (sized to active goals at accept time).
 */
export function applyIncomeBridgeLoan(input: {
  user: UserProfile;
  loanAmount: number;
  /** Term $ earmarked for protected obligations */
  loanForBills?: number;
  /** $ allowed into checking for goals */
  loanForGoals?: number;
  /** Monthly bill credit = monthly deficit */
  monthlyBillCredit?: number;
  /** @deprecated — ignored for liquid deposits; use monthlyBillCredit */
  monthlyEquivalent?: number;
  demoToday: string;
}): UserProfile {
  const forBills = Math.max(
    0,
    Math.round(input.loanForBills ?? input.loanAmount)
  );
  const forGoals = Math.max(0, Math.round(input.loanForGoals ?? 0));
  const monthlyCredit = Math.max(
    0,
    Math.round(
      input.monthlyBillCredit ??
        input.monthlyEquivalent ??
        (forBills > 0 ? Math.round(forBills / 5) : 0)
    )
  );

  const streams = [...(input.user.incomeStreams ?? [])].filter(
    (s) =>
      s.id !== "inc-income-bridge" &&
      s.id !== "inc-income-bridge-mo" &&
      s.id !== "inc-income-bridge-bills"
  );

  // Fun / clear: loan shows up as covering protected life costs
  if (monthlyCredit > 0) {
    streams.push({
      id: "inc-income-bridge-bills",
      label: "Loan · dorm, meals & tuition covered",
      amount: monthlyCredit,
      cadence: "monthly",
      source: "Student loan / aid (bill credit)",
      landsInChecking: false,
      note: `Earmarked for protected bills · ${formatMoney(forBills)} term package · never free-to-spend`,
    });
  }

  // Document the package (not a liquid deposit)
  if (forBills > 0) {
    streams.push({
      id: "inc-income-bridge",
      label: "Aid bridge package (bills · recorded)",
      amount: forBills,
      cadence: "one_time",
      source: "Bursar / aid office",
      landsInChecking: false,
      note: `Term bill cover ${formatMoney(forBills)} — applied as monthly credits, not checking cash`,
    });
  }

  return {
    ...input.user,
    // Only goal-sized cash enters the wallet
    checkingBalance: input.user.checkingBalance + forGoals,
    incomeStreams: streams,
    typicalDiscretionaryPerDay: Math.min(
      input.user.typicalDiscretionaryPerDay,
      Math.max(12, 16)
    ),
    dailyContributionRate: Math.max(
      input.user.dailyContributionRate,
      forGoals > 0 ? 4 : input.user.dailyContributionRate
    ),
  };
}
