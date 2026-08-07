import { daysFromSavings } from "./calculations";
import {
  assessDeficitPlan,
  buildDeficitLoanRecommendation,
} from "./deficit";
import { buildPatternRecommendations } from "./risk";
import { buildReallocationRecommendation } from "./reallocation";
import { buildSurplusAllocationRecommendation } from "./surplus";
import type {
  Goal,
  GoalCategory,
  Recommendation,
  RiskState,
  Transaction,
  UserProfile,
} from "./types";

/** Extra category-flavored tips — mostly one-shot decisions */
const CATEGORY_EXTRAS: Record<
  GoalCategory,
  {
    tipKey: string;
    description: string;
    savings: number;
    disruption: number;
    evidence: string;
    repeatable?: boolean;
  }[]
> = {
  Technology: [
    {
      tipKey: "tech-skip-protection-plan",
      description:
        "Skip the protection-plan upsell at checkout — self-insure with your risk cushion instead.",
      savings: 29,
      disruption: 1,
      evidence: "Retail add-ons often hit after tech goals are almost funded",
    },
  ],
  Travel: [
    {
      tipKey: "travel-ski-bus",
      description:
        "Book the student ski-bus / group travel fare instead of a solo rideshare to the mountain.",
      savings: 35,
      disruption: 2,
      evidence:
        "Travel goals pair well with cutting Uber + delivery the week before a trip",
    },
    {
      tipKey: "travel-outdoor-club-rental",
      description:
        "Use your campus outdoor club rental instead of buying new gear this season.",
      savings: 40,
      disruption: 2,
      evidence: "One-time gear buys compete with trip deposits",
    },
  ],
  Fashion: [
    {
      tipKey: "fashion-clothing-swap",
      description: "Try the student clothing swap before one full-price order.",
      savings: 22,
      disruption: 1,
      evidence: "Discretionary shopping shows up as Apple Cash + Venmo drips",
    },
  ],
  Experiences: [
    {
      tipKey: "exp-student-tickets",
      description: "Use student ticket pricing and skip the VIP upgrade.",
      savings: 18,
      disruption: 1,
      evidence: "Experience spend often lands on Venmo splits",
    },
  ],
  School: [
    {
      tipKey: "school-used-materials",
      description: "Buy used / shared course materials from the campus exchange.",
      savings: 25,
      disruption: 2,
      evidence: "Education shocks already show up as unforeseen bookstore hits",
    },
  ],
  Other: [
    {
      tipKey: "other-skip-delivery",
      description:
        "Park one weekend delivery night and cook a double batch instead.",
      savings: 16,
      disruption: 1,
      evidence: "Delivery fees are a repeat pattern in the ledger",
      repeatable: true,
    },
  ],
};

/**
 * Drop tips that would illogically repeat:
 * - never duplicate a pending tipKey for this goal
 * - never re-offer a non-repeatable tip after accept/reject/superseded
 */
export function filterUnconsumedTips(
  candidates: Recommendation[],
  history: Recommendation[],
  goalId: string
): Recommendation[] {
  const forGoal = history.filter((r) => r.goalId === goalId);

  const pendingKeys = new Set(
    forGoal
      .filter((r) => r.status === "pending" && r.tipKey)
      .map((r) => r.tipKey as string)
  );

  const consumedOneShots = new Set(
    forGoal
      .filter(
        (r) =>
          r.tipKey &&
          r.repeatable === false &&
          (r.status === "accepted" ||
            r.status === "rejected" ||
            r.status === "superseded")
      )
      .map((r) => r.tipKey as string)
  );

  // Also treat missing tipKey but matching description as consumed one-shots
  const consumedDescriptions = new Set(
    forGoal
      .filter(
        (r) =>
          r.repeatable === false &&
          (r.status === "accepted" ||
            r.status === "rejected" ||
            r.status === "superseded")
      )
      .map((r) => r.description.trim().toLowerCase())
  );

  return candidates.filter((c) => {
    const key = c.tipKey;
    if (key && pendingKeys.has(key)) return false;
    if (key && c.repeatable === false && consumedOneShots.has(key)) return false;
    if (
      c.repeatable === false &&
      consumedDescriptions.has(c.description.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Full tip pack for a goal.
 * If the student runs a monthly deficit (income < protected bills), ONLY the
 * income-bridge / loan tip is offered — no discretionary spend tips.
 */
export function buildStarterRecommendations(
  goal: Goal,
  dailyContributionRate: number,
  transactions: Transaction[],
  makeId: () => string,
  history: Recommendation[] = [],
  context?: {
    user: UserProfile;
    risk: RiskState;
    goals: Goal[];
    demoToday: string;
  }
): Recommendation[] {
  if (context != null) {
    const plan = assessDeficitPlan({
      user: context.user,
      goals: context.goals,
      demoToday: context.demoToday,
    });
    if (plan.runsDeficit) {
      const bridge = buildDeficitLoanRecommendation({
        user: context.user,
        goals: context.goals,
        demoToday: context.demoToday,
        makeId,
        history,
      });
      return bridge ? [bridge] : [];
    }
  }

  const surplusTip =
    context != null
      ? buildSurplusAllocationRecommendation({
          goal,
          user: context.user,
          risk: context.risk,
          goals: context.goals,
          demoToday: context.demoToday,
          makeId,
          history,
        })
      : null;

  const reallocTip =
    context != null
      ? buildReallocationRecommendation({
          preferredGoal: goal,
          donorGoals: context.goals,
          dailyContributionRate,
          makeId,
        })
      : null;

  const patterned = buildPatternRecommendations(
    transactions,
    dailyContributionRate,
    goal.id,
    goal.name
  ).map((r) => ({
    ...r,
    id: makeId(),
  }));

  const extras = (CATEGORY_EXTRAS[goal.category] ?? CATEGORY_EXTRAS.Other).map(
    (tip) => {
      const days = daysFromSavings(tip.savings, dailyContributionRate);
      const rec: Recommendation = {
        id: makeId(),
        kind: "spend_pattern",
        title: `Move ${goal.name} ${days} days closer`,
        description: tip.description,
        savingsAmount: tip.savings,
        estimatedDaysGained: days,
        disruptionScore: tip.disruption,
        category: goal.category.toLowerCase(),
        lifestyleImpact: tip.disruption <= 2 ? "Low" : "Medium",
        status: "pending",
        goalId: goal.id,
        evidenceSummary: tip.evidence,
        tipKey: tip.tipKey,
        repeatable: tip.repeatable ?? false,
      };
      return rec;
    }
  );

  const combined = [
    ...(reallocTip ? [reallocTip] : []),
    ...(surplusTip ? [surplusTip] : []),
    ...patterned,
    ...extras,
  ];
  return filterUnconsumedTips(combined, history, goal.id);
}
