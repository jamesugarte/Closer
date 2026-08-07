/**
 * Apply diagnostic recommendations to an AppState, then advance one month
 * so the demo can show health improvement after course-correcting.
 */

import { captureBalanceSnapshot } from "./balance-sheet";
import { estimatedPurchaseDate } from "./calculations";
import type { DiagnosticRec, FinancialDiagnostic } from "./diagnostic";
import { incomeSummary, netProtectedObligations } from "./income";
import { runSimulateMonths } from "./simulate-months";
import type { ActivityItem, AppState } from "./types";
import { addMonths, formatMoney } from "./utils";

export interface HealthSnapshot {
  grade: FinancialDiagnostic["grade"];
  freedomScore: number;
  freeToSpend: number;
  burnDaily: number;
  dailyAutoSave: number;
  checkingBalance: number;
  riskReserve: number;
  criticalFindings: number;
}

export interface EnactPlanResult {
  before: HealthSnapshot;
  after: HealthSnapshot;
  /** State after enacting tips + simulating one month */
  appState: AppState;
  enacted: DiagnosticRec[];
  monthLabel: string;
  narrative: string[];
}

function snapshotFromState(state: AppState): HealthSnapshot {
  const streams = state.user.incomeStreams ?? [];
  const netObl = netProtectedObligations(
    state.user.upcomingObligations,
    streams
  );
  const liquidMonthly = incomeSummary(streams).liquidMonthly;
  const snap = captureBalanceSnapshot({
    date: state.demoToday,
    monthsAdvanced: state.monthsAdvanced,
    user: state.user,
    goals: state.goals,
    risk: state.risk,
  });

  let criticals = 0;
  if (state.user.checkingBalance < netObl * 0.5) criticals += 1;
  else if (state.user.checkingBalance < netObl) criticals += 0; // soft shortfall after course-correct
  if (state.user.typicalDiscretionaryPerDay * 30 > liquidMonthly * 0.55)
    criticals += 1;
  if (state.user.dailyContributionRate <= 0) criticals += 1;
  if (
    state.user.riskReserveBalance < state.risk.monthlyBudget * 0.35 &&
    state.user.dailyContributionRate <= 0
  ) {
    criticals += 1;
  }

  let grade: HealthSnapshot["grade"] = "A";
  if (criticals >= 3 || (criticals >= 2 && snap.freeToSpend < 0)) grade = "F";
  else if (criticals >= 2) grade = "D";
  else if (criticals >= 1) grade = "C";
  else if (snap.freeToSpend < 80 || snap.financialFreedomScore < 35) grade = "B";

  // Course-correct reward: real autosave + cut burn lifts a floor grade
  if (
    state.user.dailyContributionRate >= 2 &&
    state.user.typicalDiscretionaryPerDay <= 22 &&
    grade === "F"
  ) {
    grade = "D";
  }
  if (
    state.user.dailyContributionRate >= 2 &&
    state.user.typicalDiscretionaryPerDay <= 18 &&
    (grade === "F" || grade === "D")
  ) {
    grade = "C";
  }

  return {
    grade,
    freedomScore: snap.financialFreedomScore,
    freeToSpend: snap.freeToSpend,
    burnDaily: state.user.typicalDiscretionaryPerDay,
    dailyAutoSave: state.user.dailyContributionRate,
    checkingBalance: state.user.checkingBalance,
    riskReserve: state.user.riskReserveBalance,
    criticalFindings: criticals,
  };
}

function pushActivity(
  activity: ActivityItem[],
  item: Omit<ActivityItem, "id" | "timestamp">
): ActivityItem[] {
  return [
    {
      id: `enact-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      ...item,
    },
    ...activity,
  ];
}

/**
 * Mutate opening state according to which diagnostic tips the student accepts.
 */
export function applyDiagnosticRecommendations(
  state: AppState,
  recommendations: DiagnosticRec[],
  selectedIds: string[]
): { state: AppState; enacted: DiagnosticRec[]; notes: string[] } {
  const selected = new Set(selectedIds);
  const enacted = recommendations.filter((r) => selected.has(r.id));
  let next: AppState = {
    ...state,
    user: {
      ...state.user,
      obligations: state.user.obligations.map((o) => ({ ...o })),
      incomeStreams: (state.user.incomeStreams ?? []).map((s) => ({ ...s })),
    },
    goals: state.goals.map((g) => ({
      ...g,
      contributions: [...g.contributions],
    })),
    risk: { ...state.risk },
    activity: [...state.activity],
    recommendations: state.recommendations.map((r) => ({ ...r })),
  };
  const notes: string[] = [];

  for (const rec of enacted) {
    if (rec.id === "rec-autosave") {
      const rate = Math.max(2, next.user.dailyContributionRate);
      notes.push(`Turned on $${rate}/day auto-save toward goals`);
      next = {
        ...next,
        user: { ...next.user, dailyContributionRate: rate },
        activity: pushActivity(next.activity, {
          kind: "recommendation_accepted",
          title: "Auto-save on",
          detail: `$${rate}/day toward goals (~$${rate * 30}/mo)`,
          amount: rate * 30,
          date: next.demoToday,
        }),
      };
    }

    if (rec.id === "rec-delivery") {
      const prevBurn = next.user.typicalDiscretionaryPerDay;
      const burn = Math.max(14, Math.round(prevBurn * 0.55));
      notes.push(
        `Cut delivery habit — discretionary ${formatMoney(prevBurn)} → ${formatMoney(burn)}/day`
      );
      next = {
        ...next,
        user: { ...next.user, typicalDiscretionaryPerDay: burn },
        activity: pushActivity(next.activity, {
          kind: "recommendation_accepted",
          title: "Delivery + rideshare cap",
          detail: "3 combined trips / week · more dining hall & groceries",
          date: next.demoToday,
        }),
      };
    }

    if (rec.id === "rec-rides") {
      const prevBurn = next.user.typicalDiscretionaryPerDay;
      const burn = Math.max(12, Math.round(prevBurn - 6));
      notes.push(`Shuttle-first nights — burn ${formatMoney(prevBurn)} → ${formatMoney(burn)}/day`);
      next = {
        ...next,
        user: { ...next.user, typicalDiscretionaryPerDay: burn },
        activity: pushActivity(next.activity, {
          kind: "recommendation_accepted",
          title: "Campus shuttle default",
          detail: "$20/week rideshare ceiling after 10pm",
          date: next.demoToday,
        }),
      };
    }

    if (rec.id === "rec-bills") {
      const hold = Math.min(
        120,
        Math.max(40, Math.round(next.user.checkingBalance * 0.15))
      );
      const checking = Math.max(0, next.user.checkingBalance - hold);
      notes.push(
        `Ring-fenced ${formatMoney(hold)} toward next bills (won't hit DoorDash)`
      );
      next = {
        ...next,
        user: {
          ...next.user,
          checkingBalance: checking,
          riskReserveBalance: next.user.riskReserveBalance + hold,
        },
        activity: pushActivity(next.activity, {
          kind: "recommendation_accepted",
          title: "Payday bills hold",
          detail: `${formatMoney(hold)} reserved before lifestyle spend`,
          amount: hold,
          date: next.demoToday,
        }),
      };
    }

    if (rec.id === "rec-risk") {
      const need = Math.max(
        0,
        next.risk.monthlyBudget - next.user.riskReserveBalance
      );
      const topUp = Math.min(80, Math.max(40, need || 40));
      const fromChecking = Math.min(topUp, next.user.checkingBalance);
      if (fromChecking > 0) {
        notes.push(`Moved ${formatMoney(fromChecking)} into risk cushion`);
        next = {
          ...next,
          user: {
            ...next.user,
            checkingBalance: next.user.checkingBalance - fromChecking,
            riskReserveBalance: next.user.riskReserveBalance + fromChecking,
          },
          activity: pushActivity(next.activity, {
            kind: "recommendation_accepted",
            title: "Risk cushion rebuild",
            detail: `${formatMoney(fromChecking)} parked before lifestyle spend`,
            amount: fromChecking,
            date: next.demoToday,
          }),
        };
      }
    }

    if (rec.id === "rec-loan") {
      const prevBurn = next.user.typicalDiscretionaryPerDay;
      const burn = Math.max(10, Math.round(prevBurn * 0.9));
      notes.push("Loan refund treated as rent money, not fun money");
      next = {
        ...next,
        user: { ...next.user, typicalDiscretionaryPerDay: burn },
        activity: pushActivity(next.activity, {
          kind: "recommendation_accepted",
          title: "Loan refund rules",
          detail: "Split future refunds: bills / risk / goals — not weekends",
          date: next.demoToday,
        }),
      };
    }

    if (rec.id.startsWith("rec-goal-")) {
      next = {
        ...next,
        goals: next.goals.map((g) => {
          if (rec.id !== `rec-goal-${g.id}`) return g;
          const newTarget = Math.round(g.targetPrice * 0.7);
          const newDeadline = addMonths(next.demoToday, 8);
          const projected = estimatedPurchaseDate(
            g.fundedAmount,
            newTarget,
            Math.max(1, next.user.dailyContributionRate),
            next.demoToday
          );
          notes.push(
            `Reset ${g.name}: ${formatMoney(g.targetPrice)} → ${formatMoney(newTarget)}, deadline ${newDeadline}`
          );
          const baseName = g.name.replace(/\s*\(starter\)\s*$/i, "");
          return {
            ...g,
            name: `${baseName} (starter)`,
            targetPrice: newTarget,
            originalTargetPrice: g.originalTargetPrice || g.targetPrice,
            optionalTargetDate: newDeadline,
            projectedPurchaseDate: projected,
          };
        }),
        activity: pushActivity(next.activity, {
          kind: "recommendation_accepted",
          title: "Goal timeline reset",
          detail: "Cheaper target + later date so auto-save can catch up",
          date: next.demoToday,
        }),
      };
    }
  }

  next = {
    ...next,
    goals: next.goals.map((g) => {
      if (g.purchased || g.completed) return g;
      return {
        ...g,
        projectedPurchaseDate: estimatedPurchaseDate(
          g.fundedAmount,
          g.targetPrice,
          Math.max(1, next.user.dailyContributionRate),
          next.demoToday
        ),
      };
    }),
  };

  return { state: next, enacted, notes };
}

/**
 * Enact selected diagnostic tips, then simulate one month of living under the new plan.
 */
export function enactPlanAndSimulateMonth(
  diagnostic: FinancialDiagnostic,
  selectedIds: string[]
): EnactPlanResult {
  const before = snapshotFromState(diagnostic.appState);
  const { state: enactedState, enacted, notes } = applyDiagnosticRecommendations(
    diagnostic.appState,
    diagnostic.recommendations,
    selectedIds
  );

  const afterMonth = runSimulateMonths(enactedState, 1);
  const after = snapshotFromState(afterMonth);
  const freedomDelta = after.freedomScore - before.freedomScore;
  const burnDelta = before.burnDaily - after.burnDaily;

  const narrative = [
    ...notes,
    `Simulated one month to ${afterMonth.demoToday}`,
    freedomDelta !== 0
      ? `Freedom score ${before.freedomScore} → ${after.freedomScore} (${freedomDelta > 0 ? "+" : ""}${freedomDelta})`
      : `Freedom score held at ${after.freedomScore}`,
    burnDelta > 0
      ? `Daily burn down ${formatMoney(burnDelta)} (now ${formatMoney(after.burnDaily)}/day)`
      : `Daily burn ${formatMoney(after.burnDaily)}/day`,
    `Auto-save $${after.dailyAutoSave}/day · grade ${before.grade} → ${after.grade}`,
  ];

  return {
    before,
    after,
    appState: afterMonth,
    enacted,
    monthLabel: afterMonth.demoToday,
    narrative,
  };
}
