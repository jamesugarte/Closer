/**
 * Build AppState from a ProfileBlueprint (custom intake or named persona).
 */

import { estimatedPurchaseDate, recommendationScore } from "./calculations";
import {
  buildObligationsForPhase,
  collegePhase,
  obligationsTotalFromList,
} from "./college-life";
import {
  buildDeficitLoanRecommendation,
  enforceDeficitPriority,
  isRunningDeficit,
} from "./deficit";
import {
  assessPortfolioGoalHealth,
  enforceGoalHealthPriority,
} from "./goal-health";
import { enforceIncomeGrowthPriority } from "./income-growth";
import { withSynthesizedHistory } from "./history-synth";
import { jordanTransactions } from "./jordan-transactions";
import type { ProfileBlueprint, SpendPatternId } from "./profile-blueprint";
import { buildPatternRecommendations, buildRiskProfile } from "./risk";
import {
  buildSurplusAllocationRecommendation,
  surplusAvailableForGoal,
} from "./surplus";
import { reconcileAppWallet } from "./wallet-integrity";
import { reconcileGoalReserve } from "./wallet";
import type {
  ActivityItem,
  AppState,
  Goal,
  Recommendation,
  Transaction,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function patternTransactions(
  patterns: SpendPatternId[],
  demoToday: string,
  name: string
): Transaction[] {
  const txs: Transaction[] = [];
  let i = 0;
  const day = (n: number) => {
    const d = new Date(demoToday + "T12:00:00");
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  const push = (partial: Omit<Transaction, "id">) => {
    txs.push({ ...partial, id: uid(`tx-${name.slice(0, 3)}-${i++}`) });
  };

  if (patterns.includes("heavy_delivery")) {
    for (const [ago, amt, m] of [
      [1, -27, "DoorDash · bowls"],
      [2, -22, "Uber Eats · burgers"],
      [4, -33, "DoorDash · sushi"],
      [5, -19, "Uber Eats · breakfast"],
    ] as const) {
      push({
        date: day(ago),
        merchant: m,
        category: "food",
        amount: amt,
        source: "Apple Cash",
        unforeseen: false,
        patternKey: "delivery",
      });
    }
  }
  if (patterns.includes("rideshare_habit")) {
    for (const [ago, amt, m] of [
      [1, -18, "Uber · downtown"],
      [3, -21, "Uber · late night"],
      [6, -15, "Lyft · campus"],
    ] as const) {
      push({
        date: day(ago),
        merchant: m,
        category: "transport",
        amount: amt,
        source: "Apple Cash",
        unforeseen: false,
        patternKey: "rideshare",
      });
    }
  }
  if (patterns.includes("nightlife")) {
    push({
      date: day(2),
      merchant: "Bar tab · Venmo split",
      category: "social",
      amount: -44,
      source: "Venmo",
      unforeseen: false,
      patternKey: "nightlife",
    });
    push({
      date: day(8),
      merchant: "Concert ticket FOMO",
      category: "social",
      amount: -85,
      source: "Student Checking",
      unforeseen: false,
      patternKey: "nightlife",
    });
  }
  if (patterns.includes("gaming_micro")) {
    push({
      date: day(3),
      merchant: "PlayStation Store",
      category: "shopping",
      amount: -19.99,
      source: "Apple Cash",
      unforeseen: false,
      patternKey: "gaming",
    });
  }
  if (patterns.includes("bnpl_shopping")) {
    push({
      date: day(7),
      merchant: "Klarna · installment",
      category: "shopping",
      amount: -48,
      source: "Student Checking",
      unforeseen: false,
      patternKey: "bnpl",
    });
  }
  if (patterns.includes("coffee_stack")) {
    for (const ago of [0, 1, 2, 3]) {
      push({
        date: day(ago),
        merchant: "Campus Grounds",
        category: "coffee",
        amount: -6.5,
        source: "Campus Card",
        unforeseen: false,
        patternKey: "coffee",
      });
    }
  }
  if (patterns.includes("subscription_creep")) {
    push({
      date: day(10),
      merchant: "Streaming + gaming subs",
      category: "subscriptions",
      amount: -32,
      source: "Apple Cash",
      unforeseen: false,
      patternKey: "subscriptions",
    });
  }
  return txs;
}

export function buildAppStateFromBlueprint(bp: ProfileBlueprint): AppState {
  const phase = collegePhase(bp.collegeYear);
  let obligations = buildObligationsForPhase(phase, bp.nextPaycheckDate);
  if (bp.obligationOverrides?.length) {
    obligations = bp.obligationOverrides.map((o, idx) => ({
      id: `obl-custom-${idx}`,
      kind: o.kind,
      label: o.label,
      amount: o.amount,
      dueDate: bp.nextPaycheckDate,
    }));
  }
  const upcomingObligations = obligationsTotalFromList(obligations);

  // Sophomore+ open mid-college so year-advance demos have runway
  const monthsAdvanced = Math.max(0, (bp.collegeYear - 1) * 12);

  const goalsDraft: Goal[] = bp.goals.map((g, idx) => {
    const id = g.id ?? uid("goal");
    return {
      id,
      name: g.name,
      targetPrice: g.targetPrice,
      originalTargetPrice: g.targetPrice,
      fundedAmount: g.fundedAmount,
      category: g.category,
      projectedPurchaseDate: bp.demoToday,
      originalProjectedDate: bp.demoToday,
      optionalTargetDate: g.optionalTargetDate,
      completed: false,
      purchased: false,
      saleApplied: false,
      createdAt: bp.demoToday,
      priority: g.priority || idx + 1,
      timeSensitive: g.timeSensitive,
      contributions:
        g.fundedAmount > 0
          ? [
              {
                id: uid("c"),
                label: "Opening reserve",
                amount: g.fundedAmount,
                date: bp.demoToday,
              },
            ]
          : [],
    };
  });

  const primaryId =
    [...goalsDraft].sort((a, b) => a.priority - b.priority)[0]?.id ?? null;

  const shockTx: Transaction[] = bp.recentShocks.map((s, idx) => {
    const d = new Date(bp.demoToday + "T12:00:00");
    d.setDate(d.getDate() - (s.daysAgo ?? 7 + idx * 3));
    return {
      id: uid(`shock-${idx}`),
      date: d.toISOString().slice(0, 10),
      merchant: s.label,
      category: s.category,
      amount: -Math.abs(s.amount),
      source: "Student Checking" as const,
      unforeseen: true,
      note: "Unforeseen",
      patternKey: `shock_${s.category}`,
    };
  });

  const baseTx =
    bp.id === "jordan" ? jordanTransactions.map((t) => ({ ...t })) : [];
  const generated = patternTransactions(
    bp.spendPatterns,
    bp.demoToday,
    bp.name
  );
  const transactions =
    baseTx.length > 0
      ? baseTx
      : [...shockTx, ...generated].sort((a, b) => (a.date < b.date ? 1 : -1));

  const derived = buildRiskProfile(transactions, bp.name);
  const riskBudget = bp.riskMonthlyBudget ?? derived.suggestedMonthlyBudget;
  const risk = {
    monthlyBudget: riskBudget,
    rolledOver: Math.max(0, bp.riskReserveBalance - riskBudget),
    spentThisMonth: 0,
    level: derived.level,
    summary: derived.summary.replace(
      `$${derived.suggestedMonthlyBudget}/mo`,
      `$${riskBudget}/mo`
    ),
    topShockCategories: derived.topShockCategories,
    pendingGoodJobBonus: null,
    lastQuietMonthBonusOffered: false,
  };

  let recommendations: Recommendation[] = [];
  if (primaryId) {
    const g = goalsDraft.find((x) => x.id === primaryId)!;
    recommendations = buildPatternRecommendations(
      transactions,
      Math.max(1, bp.dailyContributionRate || 1),
      primaryId,
      g.name
    ).sort((a, b) => {
      const scoreA = recommendationScore({
        estimatedDaysGained: a.estimatedDaysGained,
        disruptionScore: a.disruptionScore,
        obligationsProtected: true,
      });
      const scoreB = recommendationScore({
        estimatedDaysGained: b.estimatedDaysGained,
        disruptionScore: b.disruptionScore,
        obligationsProtected: true,
      });
      return scoreB - scoreA;
    });
  }

  const activity: ActivityItem[] = [
    {
      id: uid("act"),
      kind: "goal_created",
      title: `${bp.name} connected to Closer`,
      detail: bp.lifeSituation.slice(0, 140),
      date: bp.demoToday,
      timestamp: Date.now(),
    },
  ];

  const user = {
    name: bp.name,
    age: bp.age,
    checkingBalance: bp.checkingBalance,
    goalReserveBalance: reconcileGoalReserve(
      bp.goalReserveBalance,
      goalsDraft
    ),
    riskReserveBalance: bp.riskReserveBalance,
    obligations,
    upcomingObligations,
    nextPaycheckAmount: bp.nextPaycheckAmount,
    nextPaycheckDate: bp.nextPaycheckDate,
    typicalDiscretionaryPerDay: bp.typicalDiscretionaryPerDay,
    dailyContributionRate: bp.dailyContributionRate,
    collegeYear: bp.collegeYear,
    incomeStreams: bp.incomeStreams.map((s) => ({ ...s })),
    connectedSources: bp.connectedSources ?? [
      "Student Checking",
      "Campus Job Direct Deposit",
      "Venmo",
      "Apple Cash",
      "Campus Card",
    ],
  };

  const goals: Goal[] = goalsDraft.map((g) => {
    const surplus = surplusAvailableForGoal(user, risk, goalsDraft, g.id);
    const projected = estimatedPurchaseDate(
      g.fundedAmount,
      g.targetPrice,
      Math.max(0, bp.dailyContributionRate),
      bp.demoToday,
      surplus
    );
    return {
      ...g,
      projectedPurchaseDate: projected,
      originalProjectedDate: projected,
    };
  });

  if (primaryId) {
    const primary = goals.find((g) => g.id === primaryId)!;
    const surplusTip = buildSurplusAllocationRecommendation({
      goal: primary,
      user,
      risk,
      goals,
      demoToday: bp.demoToday,
      makeId: () => uid("rec-surplus"),
      history: recommendations,
    });
    if (surplusTip) recommendations = [surplusTip, ...recommendations];
  }

  // Hard gate: deficit profiles only get the income-bridge / loan tip
  recommendations = enforceDeficitPriority(
    recommendations,
    user,
    goals,
    bp.demoToday,
    () => uid("rec")
  );
  const bridge = buildDeficitLoanRecommendation({
    user,
    goals,
    demoToday: bp.demoToday,
    makeId: () => uid("rec-bridge"),
    history: recommendations,
  });
  if (
    bridge &&
    !recommendations.some((r) => r.tipKey === bridge.tipKey && r.status === "pending")
  ) {
    recommendations = [bridge, ...recommendations];
  }

  const healthReport = assessPortfolioGoalHealth({
    user,
    goals,
    risk,
    demoToday: bp.demoToday,
  });
  recommendations = enforceGoalHealthPriority(
    recommendations,
    healthReport,
    () => uid("rec-health"),
    {
      deferForDeficit: isRunningDeficit(user, goals, bp.demoToday),
    }
  );
  recommendations = enforceIncomeGrowthPriority(
    recommendations,
    user,
    goals,
    () => uid("rec-earn")
  );

  const activeRec =
    recommendations.find(
      (r) => r.status === "pending" && r.kind === "income_bridge"
    ) ??
    recommendations.find(
      (r) => r.status === "pending" && r.kind === "income_growth"
    ) ??
    recommendations.find(
      (r) => r.status === "pending" && r.category === "goal-health"
    ) ??
    recommendations.find((r) => r.status === "pending");

  const draft: AppState = {
    user,
    goals,
    recommendations,
    activity,
    transactions,
    risk,
    demoToday: bp.demoToday,
    monthsAdvanced,
    balanceHistory: [],
    furnitureMoveOffered: false,
    focusedGoalId: primaryId,
    activeRecommendationId: activeRec?.id ?? null,
    homeRecommendationFeedback: null,
    demoCompletedPurchase: false,
    personaId: bp.id,
  };

  // Maya: health faded as goals piled up. Jordan: climbing out of a hole.
  const trajectory =
    bp.arc === "course_correct" || bp.id === "jordan" ? "climb" : "decline";

  return reconcileAppWallet(
    withSynthesizedHistory(draft, { months: 12, trajectory })
  );
}
