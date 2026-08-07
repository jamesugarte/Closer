/**
 * Portfolio optimization tips — respect fixed deadlines.
 *
 * Time-sensitive goals (spring break, concert tickets) keep their want-by
 * dates. The car loan is a protected obligation, not a goal — it already
 * sits ahead of every tip. Flexible goals (AirPods) can slide, shrink, or
 * yield reserves.
 */

import { assessGoalFeasibility } from "./goal-feasibility";
import { daysFromSavings, remainingAmount } from "./calculations";
import { isFlexibleGoal, isTimeSensitiveGoal } from "./deadline";
import {
  assessDeficitPlan,
  buildDeficitLoanRecommendation,
} from "./deficit";
import { buildReallocationRecommendation } from "./reallocation";
import { addMonths, formatMoney, formatLongDate } from "./utils";
import type { Goal, Recommendation, RiskState, UserProfile } from "./types";

export function buildPortfolioOptimizationTips(input: {
  goals: Goal[];
  user: UserProfile;
  risk: RiskState;
  demoToday: string;
  makeId: () => string;
  /** When a brand-new goal just entered #1 (e.g. ~$2k demo add) */
  newlyAddedGoalId?: string;
  history?: Recommendation[];
}): Recommendation[] {
  const {
    goals,
    user,
    risk,
    demoToday,
    makeId,
    newlyAddedGoalId,
    history = [],
  } = input;

  // Deficit profiles: no portfolio rearrange theatre — income first
  const deficit = assessDeficitPlan({ user, goals, demoToday });
  if (deficit.runsDeficit) {
    const bridge = buildDeficitLoanRecommendation({
      user,
      goals,
      demoToday,
      makeId,
      history,
    });
    return bridge ? [bridge] : [];
  }

  const active = goals
    .filter((g) => !g.purchased)
    .sort((a, b) => a.priority - b.priority);
  if (active.length < 2) return [];

  const tips: Recommendation[] = [];
  const seen = new Set(
    history
      .filter((r) => r.kind === "portfolio" || r.kind === "reallocation")
      .filter(
        (r) =>
          r.status === "pending" ||
          r.status === "accepted" ||
          r.status === "rejected" ||
          r.status === "superseded"
      )
      .map((r) => r.tipKey)
      .filter(Boolean) as string[]
  );

  const push = (rec: Recommendation | null) => {
    if (!rec || !rec.tipKey || seen.has(rec.tipKey)) return;
    seen.add(rec.tipKey);
    tips.push(rec);
  };

  const advisories = active.map((g) => ({
    goal: g,
    adv: assessGoalFeasibility({
      targetPrice: g.targetPrice,
      fundedAmount: g.fundedAmount,
      optionalTargetDate: g.optionalTargetDate || g.projectedPurchaseDate,
      demoToday,
      dailyContributionRate: user.dailyContributionRate,
      user,
      risk,
      goals: active.filter((x) => x.id !== g.id),
      prioritize: g.priority === 1,
      goalName: g.name,
    }),
    fixed: isTimeSensitiveGoal(g),
    flexible: isFlexibleGoal(g),
  }));

  const fixedGoals = advisories.filter((a) => a.fixed);
  const flexibleGoals = advisories.filter((a) => a.flexible);
  const fixedInTrouble = fixedGoals.filter(
    (a) => a.adv.level === "stretch" || a.adv.level === "unreachable"
  );

  const top = active[0];
  const newGoal = newlyAddedGoalId
    ? active.find((g) => g.id === newlyAddedGoalId)
    : undefined;
  const focus = newGoal ?? top;
  const focusFixed = isTimeSensitiveGoal(focus);
  const largeNew = Boolean(newGoal && newGoal.targetPrice >= 1500);
  const newIsFlexible = Boolean(newGoal && isFlexibleGoal(newGoal));

  // ── 1) Protect fixed deadlines first ─────────────────────────────
  // Feed the worst-off time-sensitive goal from a flexible donor.
  const fixedToProtect =
    fixedInTrouble.sort(
      (a, b) => a.adv.likelihoodPct - b.adv.likelihoodPct
    )[0]?.goal ??
    (focusFixed ? focus : undefined);

  if (fixedToProtect) {
    push(
      buildReallocationRecommendation({
        preferredGoal: fixedToProtect,
        donorGoals: active,
        dailyContributionRate: user.dailyContributionRate,
        makeId,
        flexibleDonorsOnly: true,
        ignoreDonorRank: true,
      })
    );
  }

  // If #1 is flexible but fixed goals are failing, reinforce fixed first
  if (newIsFlexible && fixedInTrouble.length > 0) {
    const protect = fixedInTrouble[0].goal;
    if (protect.id !== fixedToProtect?.id) {
      push(
        buildReallocationRecommendation({
          preferredGoal: protect,
          donorGoals: active,
          dailyContributionRate: user.dailyContributionRate,
          makeId,
          flexibleDonorsOnly: true,
          ignoreDonorRank: true,
        })
      );
    }
  } else if (!fixedToProtect || (focus.id !== fixedToProtect.id && !focusFixed)) {
    push(
      buildReallocationRecommendation({
        preferredGoal: focus,
        donorGoals: active,
        dailyContributionRate: user.dailyContributionRate,
        makeId,
        flexibleDonorsOnly: true,
      })
    );
  }

  // ── 2) New large goal accommodation (without touching fixed dates) ─
  if (largeNew && newGoal) {
    // Demote only a *flexible* stretch goal — never spring break / car / tickets
    const victim = [...flexibleGoals]
      .reverse()
      .find((a) => {
        if (a.goal.id === newGoal.id) return false;
        return (
          a.adv.level === "unreachable" ||
          a.adv.level === "stretch" ||
          a.adv.level === "achievable"
        );
      })?.goal;

    if (victim) {
      push({
        id: makeId(),
        tipKey: `portfolio-demote-${victim.id}-for-${newGoal.id}`,
        repeatable: false,
        kind: "portfolio",
        title: `Park ${victim.name} last while ${newGoal.name} leads`,
        description: `Adding ${formatMoney(newGoal.targetPrice)} crowds the stack. ${victim.name} is flexible (no hard date) — drop it to last preference so auto-save can serve ${newGoal.name}. Fixed trip/ticket dates stay put; the car loan remains a protected bill.`,
        savingsAmount: Math.round(
          remainingAmount(victim.fundedAmount, victim.targetPrice) * 0.1
        ),
        estimatedDaysGained: daysFromSavings(
          90,
          Math.max(1, user.dailyContributionRate)
        ),
        disruptionScore: 2,
        category: "portfolio",
        lifestyleImpact: "Low",
        status: "pending",
        goalId: victim.id,
        applyPriority: active.length,
        evidenceSummary: `${newGoal.name} #1 · demote flexible ${victim.name} only`,
      });
    }

    // Shrink a flexible goal’s target to free earmark room
    const shrinkable = flexibleGoals
      .filter(
        (a) =>
          a.goal.id !== newGoal.id &&
          a.goal.targetPrice >= 150 &&
          remainingAmount(a.goal.fundedAmount, a.goal.targetPrice) > 40
      )
      .sort((a, b) => b.goal.targetPrice - a.goal.targetPrice)[0];
    if (shrinkable) {
      const g = shrinkable.goal;
      const newPrice = Math.max(
        g.fundedAmount + 10,
        Math.round(g.targetPrice * 0.7)
      );
      if (newPrice < g.targetPrice - 20) {
        push({
          id: makeId(),
          tipKey: `portfolio-shrink-${g.id}-for-${newGoal.id}`,
          repeatable: false,
          kind: "portfolio",
          title: `Right-size ${g.name} to ${formatMoney(newPrice)}`,
          description: `${g.name} is flexible. Lowering the target from ${formatMoney(g.targetPrice)} → ${formatMoney(newPrice)} frees earmark room for ${newGoal.name} without sliding spring break or concert dates — and without touching the car loan on protected bills.`,
          savingsAmount: g.targetPrice - newPrice,
          estimatedDaysGained: daysFromSavings(
            g.targetPrice - newPrice,
            Math.max(1, user.dailyContributionRate)
          ),
          disruptionScore: 2,
          category: "portfolio",
          lifestyleImpact: "Low",
          status: "pending",
          goalId: g.id,
          applyTargetPrice: newPrice,
          evidenceSummary: `Flexible target trim · protects fixed deadlines`,
        });
      }
    }

    if (newIsFlexible && fixedGoals.length > 0) {
      const names = fixedGoals.map((a) => a.goal.name).slice(0, 2).join(" + ");
      push({
        id: makeId(),
        tipKey: `portfolio-guard-fixed-${newGoal.id}`,
        repeatable: false,
        kind: "portfolio",
        title: `Keep ${names} on their hard dates`,
        description: `${newGoal.name} is a big new want, but ${names} ${fixedGoals.length > 1 ? "are" : "is"} time-sensitive — Closer will not push those dates or raid their reserves. Raise auto-save or trim flexible goals instead.`,
        savingsAmount: 0,
        estimatedDaysGained: 0,
        disruptionScore: 1,
        category: "portfolio",
        lifestyleImpact: "Low",
        status: "pending",
        goalId: newGoal.id,
        evidenceSummary: `Fixed: ${fixedGoals.map((a) => a.goal.name).join(", ")}`,
      });
    }
  }

  // ── 3) Extend want-by — flexible goals only ──────────────────────
  for (const { goal, adv, flexible } of [...advisories].reverse()) {
    if (!flexible) continue;
    if (goal.id === focus.id) continue;
    if (adv.level !== "stretch" && adv.level !== "unreachable") continue;
    if (!goal.optionalTargetDate) continue;

    const extended = addMonths(goal.optionalTargetDate, 3);
    const days = daysFromSavings(
      Math.max(50, Math.round(adv.shortfall * 0.4)),
      Math.max(1, user.dailyContributionRate)
    );
    push({
      id: makeId(),
      tipKey: `portfolio-extend-${goal.id}`,
      repeatable: false,
      kind: "portfolio",
      title: `Push ${goal.name} want-by to ${formatLongDate(extended)}`,
      description: `${goal.name} is flexible — sliding ${formatLongDate(goal.optionalTargetDate)} → ${formatLongDate(extended)} frees pace for fixed trip/ticket deadlines and ${focus.name}. The car loan stays on protected bills.`,
      savingsAmount: Math.max(0, Math.round(adv.shortfall * 0.25)),
      estimatedDaysGained: Math.max(30, days),
      disruptionScore: 2,
      category: "portfolio",
      lifestyleImpact: "Low",
      status: "pending",
      goalId: goal.id,
      applyOptionalTargetDate: extended,
      evidenceSummary: `Flexible only · feasibility ${adv.level}`,
    });
  }

  // ── 4) Boost auto-save when fixed deadlines are in trouble ───────
  const troubleCount =
    fixedInTrouble.length > 0
      ? fixedInTrouble.length
      : advisories.filter(
          (a) => a.adv.level === "stretch" || a.adv.level === "unreachable"
        ).length;
  if (troubleCount >= 1 && user.dailyContributionRate < 8) {
    const nextRate = Math.min(
      8,
      user.dailyContributionRate + (fixedInTrouble.length >= 2 ? 4 : 3)
    );
    const monthlyDelta = (nextRate - user.dailyContributionRate) * 30;
    const why =
      fixedInTrouble.length > 0
        ? `${fixedInTrouble.map((a) => a.goal.name).join(" + ")} ${fixedInTrouble.length > 1 ? "have" : "has"} fixed dates we can’t slide`
        : `${troubleCount} goals are stretch at today’s pace`;
    push({
      id: makeId(),
      tipKey: `portfolio-boost-pace-${nextRate}`,
      repeatable: false,
      kind: "portfolio",
      title: `Raise auto-save to $${nextRate}/day`,
      description: `${why}. Bumping to $${nextRate}/day (+≈${formatMoney(monthlyDelta)}/mo) is the honest lever — not rewriting spring break or concert dates (and the car loan is already protected).`,
      savingsAmount: Math.round(monthlyDelta),
      estimatedDaysGained: daysFromSavings(
        monthlyDelta * 2,
        Math.max(1, user.dailyContributionRate)
      ),
      disruptionScore: 3,
      category: "portfolio",
      lifestyleImpact: "Medium",
      status: "pending",
      goalId: fixedToProtect?.id ?? focus.id,
      applyDailyContributionRate: nextRate,
      evidenceSummary: `Current $${user.dailyContributionRate}/day · ${fixedGoals.length} fixed deadline(s)`,
    });
  }

  return tips.slice(0, 5);
}

/** Drop prior pending portfolio tips (and optional reallocs) before reseeding. */
export function clearPendingPortfolioTips(
  recommendations: Recommendation[],
  opts?: { clearReallocations?: boolean }
): Recommendation[] {
  return recommendations.map((r) => {
    if (r.status !== "pending") return r;
    // Keep goal-health trade-offs — they're regenerated by sync anyway, but
    // don't wipe mid-decision if we're only refreshing other portfolio tips.
    if (r.kind === "portfolio" && r.category !== "goal-health") {
      return { ...r, status: "superseded" as const };
    }
    if (opts?.clearReallocations && r.kind === "reallocation") {
      return { ...r, status: "superseded" as const };
    }
    return r;
  });
}
