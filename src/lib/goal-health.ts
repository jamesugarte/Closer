/**
 * Portfolio goal health — the core Closer judgment call.
 *
 * Green:  all active goals fundable on time AND recommendable
 *         (keeps a lifestyle floor + checking safety buffer)
 * Yellow: possible only by burning savings / killing lifestyle — not recommendable
 * Red:    not possible under income + current stock by the deadlines
 *
 * When red, the app should lock new goals until she approves trade-offs.
 */

import { remainingAmount } from "./calculations";
import {
  allocateGoalInstallments,
  installmentDueThisMonth,
  monthsUntilGoalEnd,
} from "./goal-installments";
import { isRunningDeficit } from "./deficit";
import { monthlyCashflow, recurringLiquidDeposit } from "./income";
import { enforceIncomeGrowthPriority } from "./income-growth";
import { reconcileAppWallet, timePhraseForDollars } from "./wallet-integrity";
import { addMonths, formatLongDate, formatMoney } from "./utils";
import type {
  AppState,
  Goal,
  Recommendation,
  RiskState,
  UserProfile,
} from "./types";

export const GOAL_HEALTH_CATEGORY = "goal-health";

export type GoalHealthLevel = "green" | "yellow" | "red";

export function isGoalHealthTip(r: Recommendation): boolean {
  return r.category === GOAL_HEALTH_CATEGORY;
}

export interface GoalHealthLine {
  goalId: string;
  name: string;
  priority: number;
  remaining: number;
  deadline: string;
  monthsLeft: number;
  installmentDue: number;
  /** Funded on time under recommendable sim */
  okRecommendable: boolean;
  /** Funded on time under austerity sim */
  okPossible: boolean;
}

export interface GoalTradeoffMove {
  id: string;
  tipKey: string;
  title: string;
  description: string;
  goalId: string;
  /** Soften deadline */
  applyOptionalTargetDate?: string;
  /** Shrink target */
  applyTargetPrice?: number;
  /** Drop / archive by marking purchased? better: set target to funded (cancel rest) */
  cancelRemaining?: boolean;
  /** Expected monthly installment relief */
  monthlyRelief: number;
}

export interface GoalHealthReport {
  level: GoalHealthLevel;
  score: number; // 0–100
  headline: string;
  detail: string;
  locked: boolean; // red → lock new goals / force repair
  liquidMonthly: number;
  netObligations: number;
  cashflowAfterBills: number;
  lifestyleTypical: number;
  lifestyleFloor: number; // used in recommendable path
  riskBudget: number;
  monthlyInstallmentsDue: number;
  monthlyGapRecommendable: number; // positive = shortfall
  totalRemaining: number;
  checkingNow: number;
  /** If she forces all plans (austerity): projected checking at last deadline */
  projectedCheckingIfPursueAll: number;
  /** Lowest checking touched on austerity path */
  checkingFloorOnPath: number;
  consequence: string;
  lines: GoalHealthLine[];
  moves: GoalTradeoffMove[];
}

function safetyBuffer(netObligations: number): number {
  return Math.max(300, Math.round(netObligations * 0.35));
}

function simulatePortfolio(input: {
  user: UserProfile;
  goals: Goal[];
  demoToday: string;
  risk: RiskState;
  /** Monthly discretionary allowed */
  lifestyleMo: number;
  /** Don't let checking go below this (skip installments/lifestyle that would) */
  checkingFloor: number;
  months: number;
}): {
  goals: Goal[];
  checkingEnd: number;
  checkingMin: number;
  lines: { id: string; met: boolean; funded: number }[];
} {
  const streams = input.user.incomeStreams ?? [];
  const flow = monthlyCashflow(streams, input.user.upcomingObligations);
  const recurring = recurringLiquidDeposit(streams);
  const netObl = flow.netObligations;
  const riskBudget = input.risk.monthlyBudget;

  let checking = input.user.checkingBalance;
  let riskBal = input.user.riskReserveBalance;
  let goals = input.goals
    .filter((g) => !g.purchased)
    .map((g) => ({ ...g, contributions: [...g.contributions] }));
  let checkingMin = checking;
  let demoToday = input.demoToday;

  // Opening month: hold bills+risk, then installments from remainder
  const hold = netObl + Math.max(0, riskBudget - riskBal);
  let available = Math.max(0, checking - hold);
  // Don't break floor on opening allocation
  available = Math.max(0, Math.min(available, checking - input.checkingFloor));
  {
    const { splits, total } = allocateGoalInstallments({
      available,
      demoToday,
      goals,
    });
    goals = goals.map((g) => {
      const add = splits[g.id] ?? 0;
      if (add <= 0) return g;
      const fundedAmount = g.fundedAmount + add;
      return {
        ...g,
        fundedAmount,
        completed: fundedAmount >= g.targetPrice,
      };
    });
    checking -= total;
    checkingMin = Math.min(checkingMin, checking);
  }

  for (let m = 1; m <= input.months; m++) {
    demoToday = addMonths(input.demoToday, m);
    const month = Number(demoToday.slice(5, 7));
    const semesterBoost =
      month === 8 || month === 1
        ? streams
            .filter((s) => s.landsInChecking && s.cadence === "semester")
            .reduce((s, x) => s + x.amount, 0)
        : 0;
    checking += recurring + semesterBoost;

    checking -= netObl;
    const need = Math.max(0, riskBudget - riskBal);
    const top = Math.min(need, Math.max(0, checking - input.checkingFloor));
    checking -= top;
    riskBal += top;

    if (m % 2 === 0) {
      const shock = 35;
      const fromRisk = Math.min(shock, riskBal);
      riskBal -= fromRisk;
      const fromCheck = Math.min(shock - fromRisk, Math.max(0, checking - input.checkingFloor));
      checking -= fromCheck;
    }

    const room = Math.max(0, checking - input.checkingFloor);
    const { splits, total } = allocateGoalInstallments({
      available: room,
      demoToday,
      goals,
    });
    goals = goals.map((g) => {
      const add = splits[g.id] ?? 0;
      if (add <= 0) return g;
      const fundedAmount = g.fundedAmount + add;
      return {
        ...g,
        fundedAmount,
        completed: fundedAmount >= g.targetPrice,
      };
    });
    checking -= total;

    const living = Math.min(input.lifestyleMo, Math.max(0, checking - input.checkingFloor));
    checking -= living;
    checkingMin = Math.min(checkingMin, checking);
  }

  return {
    goals,
    checkingEnd: checking,
    checkingMin,
    lines: input.goals
      .filter((g) => !g.purchased)
      .map((orig) => {
        const g = goals.find((x) => x.id === orig.id)!;
        const met = g.fundedAmount >= g.targetPrice;
        return { id: orig.id, met, funded: g.fundedAmount };
      }),
  };
}

export function assessPortfolioGoalHealth(input: {
  user: UserProfile;
  goals: Goal[];
  risk: RiskState;
  demoToday: string;
}): GoalHealthReport {
  const active = input.goals
    .filter((g) => !g.purchased)
    .sort((a, b) => a.priority - b.priority);
  const streams = input.user.incomeStreams ?? [];
  const flow = monthlyCashflow(streams, input.user.upcomingObligations);
  const lifestyleTypical = Math.max(
    40,
    Math.round(input.user.typicalDiscretionaryPerDay * 22)
  );
  const lifestyleFloor = Math.max(120, Math.round(lifestyleTypical * 0.45));
  const riskBudget = input.risk.monthlyBudget;
  const buffer = safetyBuffer(flow.netObligations);

  const installments = active.map((g) => ({
    goal: g,
    remaining: remainingAmount(g.fundedAmount, g.targetPrice),
    due: installmentDueThisMonth(input.demoToday, g),
    months: monthsUntilGoalEnd(input.demoToday, g),
    deadline: g.optionalTargetDate || g.projectedPurchaseDate,
  }));

  const monthlyInstallmentsDue = installments.reduce((s, x) => s + x.due, 0);
  const totalRemaining = installments.reduce((s, x) => s + x.remaining, 0);
  const recommendableBudget =
    flow.cashflow - riskBudget - lifestyleFloor;
  const monthlyGapRecommendable = Math.max(
    0,
    monthlyInstallmentsDue - Math.max(0, recommendableBudget)
  );

  const maxDeadlineMonths = Math.min(
    18,
    Math.max(
      3,
      ...installments.map((x) => x.months),
      1
    )
  );

  const recSim = simulatePortfolio({
    user: input.user,
    goals: active,
    demoToday: input.demoToday,
    risk: input.risk,
    lifestyleMo: lifestyleFloor,
    checkingFloor: buffer,
    months: maxDeadlineMonths,
  });

  const austereSim = simulatePortfolio({
    user: input.user,
    goals: active,
    demoToday: input.demoToday,
    risk: input.risk,
    lifestyleMo: 0,
    checkingFloor: 50,
    months: maxDeadlineMonths,
  });

  const lines: GoalHealthLine[] = installments.map((row) => {
    const rec = recSim.lines.find((l) => l.id === row.goal.id);
    const aus = austereSim.lines.find((l) => l.id === row.goal.id);
    const okRec =
      !!rec &&
      (rec.funded >= row.goal.targetPrice ||
        (row.months > maxDeadlineMonths &&
          rec.funded >= row.goal.targetPrice * (maxDeadlineMonths / row.months) * 0.95));
    const okPos =
      !!aus &&
      (aus.funded >= row.goal.targetPrice ||
        (row.months > maxDeadlineMonths &&
          aus.funded >= row.goal.targetPrice * (maxDeadlineMonths / row.months) * 0.95));
    // Prefer strict: must hit target if deadline within window
    const okRecommendable =
      row.months <= maxDeadlineMonths
        ? (rec?.funded ?? 0) >= row.goal.targetPrice
        : okRec;
    const okPossible =
      row.months <= maxDeadlineMonths
        ? (aus?.funded ?? 0) >= row.goal.targetPrice
        : okPos;

    return {
      goalId: row.goal.id,
      name: row.goal.name,
      priority: row.goal.priority,
      remaining: row.remaining,
      deadline: row.deadline,
      monthsLeft: row.months,
      installmentDue: row.due,
      okRecommendable,
      okPossible,
    };
  });

  const allPos = lines.every((l) => l.okPossible);
  // Monthly installment pressure above recommendable room means the stack
  // is not recommendable even if a stock-burn sim eventually funds dates.
  const allRec =
    lines.every((l) => l.okRecommendable) && monthlyGapRecommendable <= 0;

  let level: GoalHealthLevel;
  if (active.length === 0) {
    level = "green";
  } else if (allRec) {
    level = "green";
  } else if (allPos) {
    level = "yellow";
  } else {
    level = "red";
  }

  // Score
  const metRec = lines.filter((l) => l.okRecommendable).length;
  const metPos = lines.filter((l) => l.okPossible).length;
  let score = 100;
  if (level === "green") {
    score = Math.min(100, 78 + Math.round((metRec / Math.max(1, lines.length)) * 22));
  } else if (level === "yellow") {
    score = Math.round(35 + (metPos / Math.max(1, lines.length)) * 40);
  } else {
    score = Math.round((metPos / Math.max(1, lines.length)) * 34);
  }

  const projectedCheckingIfPursueAll = Math.round(austereSim.checkingEnd);
  const checkingFloorOnPath = Math.round(austereSim.checkingMin);

  let headline: string;
  let detail: string;
  let consequence: string;

  if (level === "green") {
    headline = "On track";
    detail = `All ${active.length} goals fit with ~${formatMoney(lifestyleFloor)}/mo lifestyle left.`;
    consequence = `Checking stays near ${formatMoney(recSim.checkingEnd)} — about ${timePhraseForDollars(Math.max(0, recSim.checkingEnd), Math.max(8, lifestyleTypical / 22))}.`;
  } else if (level === "yellow") {
    headline = "Possible · not recommendable";
    detail = `Plans want ${formatMoney(monthlyInstallmentsDue)}/mo; recommendable room is ~${formatMoney(Math.max(0, recommendableBudget))}.`;
    consequence = `Forcing it: checking bottoms ~${formatMoney(checkingFloorOnPath)}. That’s austerity, not a plan.`;
  } else {
    headline = "Not possible";
    detail = `Even at $0 lifestyle, a deadline still misses. Still to fund: ${formatMoney(totalRemaining)}.`;
    consequence = `Locked until you approve trade-offs. Checking path ends ~${formatMoney(projectedCheckingIfPursueAll)}.`;
  }

  const moves = buildTradeoffMoves({
    lines,
    goals: active,
    demoToday: input.demoToday,
    monthlyGap: monthlyGapRecommendable,
    level,
  });

  return {
    level,
    score,
    headline,
    detail,
    locked: level === "red",
    liquidMonthly: flow.liquidMonthly,
    netObligations: flow.netObligations,
    cashflowAfterBills: flow.cashflow,
    lifestyleTypical,
    lifestyleFloor,
    riskBudget,
    monthlyInstallmentsDue,
    monthlyGapRecommendable,
    totalRemaining,
    checkingNow: input.user.checkingBalance,
    projectedCheckingIfPursueAll,
    checkingFloorOnPath,
    consequence,
    lines,
    moves,
  };
}

function buildTradeoffMoves(input: {
  lines: GoalHealthLine[];
  goals: Goal[];
  demoToday: string;
  monthlyGap: number;
  level: GoalHealthLevel;
}): GoalTradeoffMove[] {
  if (input.level === "green") return [];

  const moves: GoalTradeoffMove[] = [];
  const failing = input.lines
    .filter((l) => !l.okRecommendable)
    .sort((a, b) => b.installmentDue - a.installmentDue);

  // Yellow can still have every line "funded" in the sim while the monthly
  // plan is unsustainable — pressure-rank by installment size instead.
  const targets =
    failing.length > 0
      ? failing
      : [...input.lines]
          .filter((l) => l.installmentDue > 0 || l.remaining > 0)
          .sort((a, b) => b.installmentDue - a.installmentDue);

  for (const line of targets.slice(0, 4)) {
    const goal = input.goals.find((g) => g.id === line.goalId);
    if (!goal) continue;

    // 1) Extend deadline by 3 months
    const newDate = addMonths(line.deadline, 3);
    const newMonths = monthsUntilGoalEnd(input.demoToday, {
      ...goal,
      optionalTargetDate: newDate,
    });
    const newDue = Math.ceil(line.remaining / Math.max(1, newMonths));
    const reliefExtend = Math.max(0, line.installmentDue - newDue);
    moves.push({
      id: `move-extend-${goal.id}`,
      tipKey: `goal-health-extend-${goal.id}`,
      title: `Push ${goal.name} to ${formatLongDate(newDate)}`,
      description: `${formatMoney(line.installmentDue)}/mo → ~${formatMoney(newDue)}/mo.`,
      goalId: goal.id,
      applyOptionalTargetDate: newDate,
      monthlyRelief: reliefExtend,
    });

    // 2) Cut target ~30% (min $50 cut)
    if (line.remaining >= 100) {
      const newTarget = Math.max(
        goal.fundedAmount + 50,
        Math.round(goal.targetPrice * 0.7)
      );
      const newRemaining = Math.max(0, newTarget - goal.fundedAmount);
      const cutDue = Math.ceil(newRemaining / Math.max(1, line.monthsLeft));
      const reliefCut = Math.max(0, line.installmentDue - cutDue);
      moves.push({
        id: `move-cut-${goal.id}`,
        tipKey: `goal-health-cut-${goal.id}`,
        title: `Right-size ${goal.name} to ${formatMoney(newTarget)}`,
        description: `Same date · ~${formatMoney(cutDue)}/mo instead of ${formatMoney(line.installmentDue)}.`,
        goalId: goal.id,
        applyTargetPrice: newTarget,
        monthlyRelief: reliefCut,
      });
    }
  }

  // 3) Drop expensive stretch goals when red OR yellow with a large gap
  const dropCandidates = [...input.lines]
    .filter(
      (l) =>
        !l.okPossible ||
        l.installmentDue >= 150 ||
        (input.level === "yellow" && input.monthlyGap >= 400)
    )
    .sort((a, b) => b.installmentDue - a.installmentDue || b.priority - a.priority);

  if (
    dropCandidates.length > 0 &&
    (input.level === "red" || input.monthlyGap >= 400)
  ) {
    for (const dropCandidate of dropCandidates.slice(0, 2)) {
      moves.push({
        id: `move-drop-${dropCandidate.goalId}`,
        tipKey: `goal-health-drop-${dropCandidate.goalId}`,
        title: `Pause ${dropCandidate.name} for now`,
        description: `Frees ${formatMoney(dropCandidate.installmentDue)}/mo · ${formatMoney(dropCandidate.remaining)} off the stack.`,
        goalId: dropCandidate.goalId,
        cancelRemaining: true,
        monthlyRelief: dropCandidate.installmentDue,
      });
    }
  }

  // Dedupe by tipKey, prefer highest relief
  const byKey = new Map<string, GoalTradeoffMove>();
  for (const m of moves) {
    const prev = byKey.get(m.tipKey);
    if (!prev || m.monthlyRelief > prev.monthlyRelief) byKey.set(m.tipKey, m);
  }
  return [...byKey.values()]
    .sort((a, b) => {
      // Huge monthly holes → pause first (time + scope, not austerity theater)
      if (input.monthlyGap >= 800) {
        if (a.cancelRemaining && !b.cancelRemaining) return -1;
        if (b.cancelRemaining && !a.cancelRemaining) return 1;
      }
      return b.monthlyRelief - a.monthlyRelief;
    })
    .slice(0, 5);
}

/** Turn health moves into accept-able Recommendation rows */
export function buildGoalHealthRecommendations(input: {
  report: GoalHealthReport;
  makeId: () => string;
  history?: Recommendation[];
}): Recommendation[] {
  const history = input.history ?? [];
  // Don't re-offer tips she already accepted or rejected this session
  const consumed = new Set(
    history
      .filter(
        (r) =>
          r.tipKey &&
          (r.status === "accepted" || r.status === "rejected")
      )
      .map((r) => r.tipKey as string)
  );
  const pendingKeys = new Set(
    history
      .filter(
        (r) =>
          r.tipKey &&
          r.status === "pending" &&
          r.category === GOAL_HEALTH_CATEGORY
      )
      .map((r) => r.tipKey as string)
  );

  return input.report.moves
    .filter((m) => !consumed.has(m.tipKey) && !pendingKeys.has(m.tipKey))
    .map((m) => {
      const rec: Recommendation = {
        id: input.makeId(),
        tipKey: m.tipKey,
        repeatable: false,
        kind: "portfolio",
        title: m.title,
        description: m.description,
        savingsAmount: m.monthlyRelief,
        estimatedDaysGained: 0,
        disruptionScore: m.cancelRemaining ? 4 : 2,
        category: GOAL_HEALTH_CATEGORY,
        lifestyleImpact: m.cancelRemaining ? "High" : "Medium",
        status: "pending",
        goalId: m.goalId,
        evidenceSummary: input.report.consequence,
        applyOptionalTargetDate: m.applyOptionalTargetDate,
        applyTargetPrice: m.applyTargetPrice,
        applyCancelGoal: m.cancelRemaining || undefined,
      };
      return rec;
    });
}

/**
 * When yellow/red: surface AI trade-off tips.
 * When red (locked): supersede everything except income-bridge + goal-health.
 * When structural deficit: defer goal-health — loan/aid bridge owns the story.
 */
export function enforceGoalHealthPriority(
  recommendations: Recommendation[],
  report: GoalHealthReport,
  makeId: () => string,
  opts?: { deferForDeficit?: boolean }
): Recommendation[] {
  if (opts?.deferForDeficit) {
    return recommendations.map((r) =>
      r.category === GOAL_HEALTH_CATEGORY && r.status === "pending"
        ? { ...r, status: "superseded" as const }
        : r
    );
  }

  if (report.level === "green") {
    return recommendations.map((r) =>
      r.category === GOAL_HEALTH_CATEGORY && r.status === "pending"
        ? { ...r, status: "superseded" as const }
        : r
    );
  }

  // Rebuild pending health tips from current math (stale tipKeys get superseded)
  const currentKeys = new Set(report.moves.map((m) => m.tipKey));
  let next = recommendations.map((r) => {
    if (r.category !== GOAL_HEALTH_CATEGORY || r.status !== "pending") return r;
    if (!r.tipKey || !currentKeys.has(r.tipKey)) {
      return { ...r, status: "superseded" as const };
    }
    return r;
  });

  if (report.locked) {
    next = next.map((r) => {
      if (r.status !== "pending") return r;
      if (r.kind === "income_bridge") return r;
      if (r.category === GOAL_HEALTH_CATEGORY) return r;
      return { ...r, status: "superseded" as const };
    });
  }

  const fresh = buildGoalHealthRecommendations({
    report,
    makeId,
    history: next,
  });

  // Income bridge always stays ahead of goal-health trade-offs
  const bridge = next.filter(
    (r) => r.status === "pending" && r.kind === "income_bridge"
  );
  const rest = next.filter(
    (r) => !(r.status === "pending" && r.kind === "income_bridge")
  );
  return [...bridge, ...fresh, ...rest];
}

/** Reassess portfolio health and sync AI trade-off tips into state. */
export function syncStateGoalHealth(
  prev: AppState,
  makeId: () => string
): AppState {
  const reconciled = reconcileAppWallet(prev);
  const deficit = isRunningDeficit(
    reconciled.user,
    reconciled.goals,
    reconciled.demoToday
  );
  const report = assessPortfolioGoalHealth({
    user: reconciled.user,
    goals: reconciled.goals,
    risk: reconciled.risk,
    demoToday: reconciled.demoToday,
  });
  // While income < bills, goal-health tips stay off — loan/aid first
  const effectiveReport =
    deficit && report.locked
      ? { ...report, locked: false, level: "yellow" as const }
      : report;

  const recommendations = enforceIncomeGrowthPriority(
    enforceGoalHealthPriority(
      reconciled.recommendations,
      effectiveReport,
      makeId,
      { deferForDeficit: deficit }
    ),
    reconciled.user,
    reconciled.goals,
    makeId
  );

  const bridge = recommendations.find(
    (r) => r.status === "pending" && r.kind === "income_bridge"
  );
  const growth = recommendations.find(
    (r) => r.status === "pending" && r.kind === "income_growth"
  );
  const health = recommendations.find(
    (r) => r.status === "pending" && r.category === GOAL_HEALTH_CATEGORY
  );
  let activeRecommendationId = reconciled.activeRecommendationId;
  if (bridge) {
    activeRecommendationId = bridge.id;
  } else if (growth) {
    activeRecommendationId = growth.id;
  } else if (!deficit && effectiveReport.level !== "green" && health) {
    activeRecommendationId = health.id;
  } else {
    const still = recommendations.find(
      (r) => r.id === activeRecommendationId && r.status === "pending"
    );
    if (!still) {
      activeRecommendationId =
        recommendations.find((r) => r.status === "pending")?.id ?? null;
    }
  }

  return {
    ...reconciled,
    recommendations,
    activeRecommendationId,
  };
}
