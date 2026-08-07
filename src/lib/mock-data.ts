import type {
  ActivityItem,
  AppState,
  Goal,
  IncomeStream,
  Recommendation,
  RiskState,
  UserProfile,
} from "./types";
import { captureBalanceSnapshot } from "./balance-sheet";
import { recommendationScore } from "./calculations";
import {
  buildObligationsForPhase,
  collegePhase,
  obligationsTotalFromList,
} from "./college-life";
import { buildPatternRecommendations, buildRiskProfile } from "./risk";
import { mayaTransactions } from "./transactions";
import {
  AIRPODS_GOAL_ID,
  REC_SHUTTLE_ID,
} from "./mock-data-ids";

export { AIRPODS_GOAL_ID, REC_SHUTTLE_ID, REC_PICKUP_ID, REC_COFFEE_ID, REC_GOOD_JOB_ID } from "./mock-data-ids";

/**
 * Fixed “demo today” so interview math is stable:
 * Aug 23 → Sept 28 = 36 days away (matches the product story).
 */
export const DEMO_TODAY = "2026-08-23";

export const STORAGE_KEY = "closer-demo-state-v33";
export const SESSION_ENTERED_KEY = "closer-session-entered-v1";

const FROSH = collegePhase(1);
const mayaObligations = buildObligationsForPhase(FROSH, "2026-09-01");
const mayaObligationsTotal = obligationsTotalFromList(mayaObligations);

/**
 * Realistic freshman support mix (College Ave / UC work surveys + federal aid):
 * - Campus job ~15 hrs/wk @ ~$17–19 → ~$520 biweekly
 * - Work-study stacked on same DD
 * - Family help ~$450/mo (College Ave parental stipend band)
 * - Scholarship/grant credits the bursar (not liquid)
 * - Direct Loan refund: ~$1.8k/semester leftover after billed charges
 *   (dependent undergrad aid story — deferred while enrolled)
 */
const mayaIncome: IncomeStream[] = [
  {
    id: "inc-campus-job",
    label: "Campus job paycheck",
    amount: 520,
    cadence: "biweekly",
    source: "Campus Job Direct Deposit",
    landsInChecking: true,
    note: "~15 hrs/wk library / dining — primary earned income",
  },
  {
    id: "inc-work-study",
    label: "Federal work-study",
    amount: 140,
    cadence: "biweekly",
    source: "Campus Job Direct Deposit",
    landsInChecking: true,
    note: "Stacked on the same DD as her campus job",
  },
  {
    id: "inc-family",
    label: "Family contribution",
    amount: 450,
    cadence: "monthly",
    source: "Student Checking",
    landsInChecking: true,
    note: "Parents help with dorm/meal plan (College Ave peer band is ~$300–700)",
  },
  {
    id: "inc-loan-refund",
    label: "Direct Loan refund (living)",
    amount: 1800,
    cadence: "semester",
    source: "Student Checking · aid refund",
    landsInChecking: true,
    note: "Fall (Aug) + spring (Jan) refund after bursar takes tuition/fees — federal loans stay deferred while she’s enrolled",
  },
  {
    id: "inc-scholarship",
    label: "Scholarship / grant (bill credit)",
    amount: 500,
    cadence: "monthly",
    source: "Bursar (not liquid)",
    landsInChecking: false,
    note: "Bursar credit only — reduces tuition/housing billed to checking; never disposable income",
  },
];

/**
 * Freshman fall with realistic room & board.
 * Pool: checking + reserve − ~$1,485 obligations (loan payments deferred).
 */
const mayaUser: UserProfile = {
  name: "Maya",
  age: 18,
  checkingBalance: 2100,
  goalReserveBalance: 164,
  riskReserveBalance: 120,
  obligations: mayaObligations,
  upcomingObligations: mayaObligationsTotal,
  nextPaycheckAmount: 660,
  nextPaycheckDate: "2026-09-01",
  typicalDiscretionaryPerDay: 16,
  dailyContributionRate: 3,
  collegeYear: 1,
  incomeStreams: mayaIncome,
  connectedSources: [
    "Student Checking",
    "Campus Job Direct Deposit",
    "Venmo",
    "Apple Cash",
    "Campus Card",
  ],
};

const airpodsGoal: Goal = {
  id: AIRPODS_GOAL_ID,
  name: "AirPods Pro",
  targetPrice: 200,
  originalTargetPrice: 200,
  fundedAmount: 164,
  category: "Technology",
  projectedPurchaseDate: "2026-09-28",
  originalProjectedDate: "2026-09-28",
  completed: false,
  purchased: false,
  saleApplied: false,
  createdAt: "2026-07-01",
  priority: 1,
  contributions: [
    {
      id: "c1",
      label: "Campus job transfer",
      amount: 40,
      date: "2026-08-16",
    },
    {
      id: "c2",
      label: "Weekly auto-save",
      amount: 21,
      date: "2026-08-10",
    },
    {
      id: "c3",
      label: "Opening reserve",
      amount: 103,
      date: "2026-07-01",
    },
  ],
};

function createSeedRisk(): RiskState {
  const derived = buildRiskProfile(mayaTransactions, "Maya");
  const monthlyBudget = 80;
  return {
    monthlyBudget,
    rolledOver: 40, // last month was quiet — front-loaded
    spentThisMonth: 0,
    level: derived.level,
    summary: derived.summary.replace(
      `$${derived.suggestedMonthlyBudget}/mo`,
      `$${monthlyBudget}/mo`
    ),
    topShockCategories: derived.topShockCategories,
    pendingGoodJobBonus: null,
    lastQuietMonthBonusOffered: false,
  };
}

const seedRecommendations: Recommendation[] = buildPatternRecommendations(
  mayaTransactions,
  mayaUser.dailyContributionRate,
  AIRPODS_GOAL_ID,
  "AirPods Pro"
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

const seedActivity: ActivityItem[] = [
  {
    id: "a-tire",
    kind: "unforeseen",
    title: "Unforeseen · flat tire",
    detail: "Campus Auto Care — tagged as shock spend, not discretionary",
    amount: -85,
    date: "2026-08-09",
    timestamp: Date.parse("2026-08-09T21:10:00"),
  },
  {
    id: "a-textbook",
    kind: "unforeseen",
    title: "Unforeseen · textbook",
    detail: "University Bookstore — mid-syllabus required text",
    amount: -62,
    date: "2026-08-18",
    timestamp: Date.parse("2026-08-18T14:20:00"),
  },
  {
    id: "a1",
    kind: "paycheck",
    title: "Campus job deposit",
    detail: "Direct deposit landed in Student Checking",
    amount: 420,
    date: "2026-08-16",
    timestamp: Date.parse("2026-08-16T09:00:00"),
  },
  {
    id: "a2",
    kind: "contribution",
    title: "Goal contribution",
    detail: "Moved $40 into AirPods Pro reserve",
    amount: 40,
    date: "2026-08-16",
    timestamp: Date.parse("2026-08-16T09:05:00"),
  },
  {
    id: "a3",
    kind: "venmo",
    title: "Venmo · group dinner",
    detail: "Split dinner with roommates",
    amount: -18,
    date: "2026-08-14",
    timestamp: Date.parse("2026-08-14T20:12:00"),
  },
  {
    id: "a4",
    kind: "venmo",
    title: "Venmo · concert tickets",
    detail: "Paid Jordan for tickets",
    amount: -32,
    date: "2026-08-11",
    timestamp: Date.parse("2026-08-11T15:40:00"),
  },
  {
    id: "a5",
    kind: "contribution",
    title: "Weekly auto-save",
    detail: "Scheduled transfer to AirPods Pro",
    amount: 21,
    date: "2026-08-10",
    timestamp: Date.parse("2026-08-10T08:00:00"),
  },
  {
    id: "a-risk",
    kind: "risk_rollover",
    title: "Risk cushion rolled forward",
    detail: "July was quiet — $40 unused risk money front-loaded into August",
    amount: 40,
    date: "2026-08-01",
    timestamp: Date.parse("2026-08-01T08:00:00"),
  },
];

export function createFreshmanSeedState(): AppState {
  const risk = createSeedRisk();
  const user = {
    ...mayaUser,
    obligations: mayaObligations.map((o) => ({ ...o })),
    riskReserveBalance: risk.monthlyBudget + risk.rolledOver - risk.spentThisMonth,
  };
  const goals = [{ ...airpodsGoal, contributions: [...airpodsGoal.contributions] }];
  const baseline = captureBalanceSnapshot({
    date: DEMO_TODAY,
    monthsAdvanced: 0,
    user,
    goals,
    risk,
  });

  return {
    user,
    goals,
    recommendations: seedRecommendations.map((r) => ({ ...r })),
    activity: seedActivity.map((a) => ({ ...a })),
    transactions: mayaTransactions.map((t) => ({ ...t })),
    risk,
    demoToday: DEMO_TODAY,
    monthsAdvanced: 0,
    balanceHistory: [baseline],
    furnitureMoveOffered: false,
    focusedGoalId: AIRPODS_GOAL_ID,
    activeRecommendationId: REC_SHUTTLE_ID,
    homeRecommendationFeedback: null,
    demoCompletedPurchase: false,
  };
}

/** Rank pending recommendations for a goal using the transparent score. */
export function rankPendingRecommendations(
  recommendations: Recommendation[],
  goalId: string
): Recommendation[] {
  return recommendations
    .filter((r) => r.goalId === goalId && r.status === "pending")
    .sort((a, b) => {
      // Structural income/loan bridge always first when present
      if (a.kind === "income_bridge" && b.kind !== "income_bridge") return -1;
      if (b.kind === "income_bridge" && a.kind !== "income_bridge") return 1;
      if (a.kind === "income_growth" && b.kind !== "income_growth") return -1;
      if (b.kind === "income_growth" && a.kind !== "income_growth") return 1;
      // Goal-health trade-offs next — the product's core judgment
      if (a.category === "goal-health" && b.category !== "goal-health") return -1;
      if (b.category === "goal-health" && a.category !== "goal-health") return 1;
      if (a.kind === "portfolio" && b.kind !== "portfolio") return -1;
      if (b.kind === "portfolio" && a.kind !== "portfolio") return 1;
      // Preference-fit rearrangements surface first when present
      if (a.kind === "reallocation" && b.kind !== "reallocation") return -1;
      if (b.kind === "reallocation" && a.kind !== "reallocation") return 1;
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
