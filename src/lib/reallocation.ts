/**
 * Goal reallocation — rearrange existing reserves when preferences change.
 *
 * New higher-priority goals can siphon from lower-ranked goals that still
 * have funded money. Closer only recommends; Maya accepts to move dollars.
 *
 * Time-sensitive donors (spring break, tickets) are never
 * raided — only flexible goals give up reserve. Car loans are obligations.
 */

import { isFlexibleGoal, isTimeSensitiveGoal } from "./deadline";
import { daysFromSavings, remainingAmount } from "./calculations";
import type { Goal, Recommendation } from "./types";

/** Keep a floor on the donor so we don’t empty a nearly-done goal overnight. */
const DONOR_FLOOR = 25;

export function buildReallocationRecommendation(input: {
  preferredGoal: Goal;
  donorGoals: Goal[];
  dailyContributionRate: number;
  makeId: () => string;
  /** Only take from flexible goals (default true) */
  flexibleDonorsOnly?: boolean;
  /**
   * When protecting a fixed deadline, allow siphoning from flexible donors
   * even if they rank higher than the preferred goal.
   */
  ignoreDonorRank?: boolean;
}): Recommendation | null {
  const {
    preferredGoal,
    donorGoals,
    dailyContributionRate,
    makeId,
    flexibleDonorsOnly = true,
    ignoreDonorRank = false,
  } = input;
  const need = remainingAmount(
    preferredGoal.fundedAmount,
    preferredGoal.targetPrice
  );
  if (need <= 0) return null;

  const donors = donorGoals
    .filter(
      (g) =>
        !g.purchased &&
        g.id !== preferredGoal.id &&
        g.fundedAmount > DONOR_FLOOR &&
        (ignoreDonorRank || g.priority > preferredGoal.priority) &&
        (!flexibleDonorsOnly || isFlexibleGoal(g))
    )
    .sort((a, b) => b.priority - a.priority || b.fundedAmount - a.fundedAmount);

  const donor = donors[0];
  if (!donor) return null;

  const available = Math.max(0, donor.fundedAmount - DONOR_FLOOR);
  const suggested = Math.min(
    need,
    available,
    Math.max(20, Math.round(donor.fundedAmount * 0.35))
  );
  if (suggested < 15) return null;

  const days = daysFromSavings(suggested, dailyContributionRate);
  const fixedNote = isTimeSensitiveGoal(preferredGoal)
    ? ` ${preferredGoal.name} has a fixed deadline — this move protects it without sliding the date.`
    : "";

  return {
    id: makeId(),
    tipKey: `realloc-${preferredGoal.id}-from-${donor.id}`,
    repeatable: false,
    kind: "reallocation",
    title: `Rearrange $${suggested} toward ${preferredGoal.name}`,
    description: ignoreDonorRank && isTimeSensitiveGoal(preferredGoal)
      ? `${preferredGoal.name} is time-sensitive. Move $${suggested} from flexible ${donor.name} into it — same money, hard date protected. ${donor.name} stays funded above $${DONOR_FLOOR}.`
      : `${preferredGoal.name} is ranked above ${donor.name}. Move $${suggested} already reserved for ${donor.name} into ${preferredGoal.name} — same money, better fit. ${donor.name} stays funded above $${DONOR_FLOOR}.${fixedNote}`,
    savingsAmount: suggested,
    estimatedDaysGained: days,
    disruptionScore: 2,
    category: "reallocation",
    lifestyleImpact: "Low",
    status: "pending",
    goalId: preferredGoal.id,
    fromGoalId: donor.id,
    evidenceSummary: `Preference ranking: #${preferredGoal.priority} ${preferredGoal.name} vs #${donor.priority} ${donor.name} ($${donor.fundedAmount} reserved)${
      isTimeSensitiveGoal(preferredGoal) ? " · fixed deadline" : ""
    }`,
  };
}

/** Bump other active goals down when a new #1 preference is created. */
export function demotePriorities(goals: Goal[], exceptId: string): Goal[] {
  return goals.map((g) => {
    if (g.id === exceptId || g.purchased) return g;
    return { ...g, priority: g.priority + 1 };
  });
}
