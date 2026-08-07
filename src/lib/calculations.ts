/**
 * Closer calculation helpers — interview-friendly, deterministic math.
 *
 * Core idea: convert dollars into time using a simple daily contribution rate.
 * These are transparent formulas for the prototype, not a production ML model.
 */

import { parseLocalDate, toISODate } from "./utils";

/**
 * 1. Funding percentage
 * How full the goal “battery” is: funded ÷ target.
 * Example: $164 / $200 = 0.82 → 82%
 */
export function fundingPercentage(fundedAmount: number, targetPrice: number): number {
  if (targetPrice <= 0) return 0;
  const pct = (fundedAmount / targetPrice) * 100;
  // Cap display at 100% once fully funded (overfunding stays as reserve)
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/**
 * 2. Remaining amount needed to hit the target price.
 * Never goes below zero for display math.
 */
export function remainingAmount(fundedAmount: number, targetPrice: number): number {
  return Math.max(0, targetPrice - fundedAmount);
}

/**
 * 3. Estimated purchase date
 * remaining ÷ dailyContributionRate = days still needed — unless disposable
 * surplus (free-to-spend) can cover some/all of the remaining balance.
 *
 * Example: $36 left ÷ $3/day = 12 days — or today if surplus ≥ $36.
 */
export function estimatedPurchaseDate(
  fundedAmount: number,
  targetPrice: number,
  dailyContributionRate: number,
  fromDateISO: string,
  /** Checking surplus that can fund this goal without raiding bills/risk */
  surplusAvailable = 0
): string {
  const remaining = remainingAmount(fundedAmount, targetPrice);

  // Already funded — purchase is available today
  if (remaining <= 0) return fromDateISO;

  const fromSurplus = Math.min(remaining, Math.max(0, surplusAvailable));
  const needFromPace = remaining - fromSurplus;
  if (needFromPace <= 0) return fromDateISO;

  // Guard against divide-by-zero; fall back to a slow pace
  const rate = dailyContributionRate > 0 ? dailyContributionRate : 1;
  const daysNeeded = Math.ceil(needFromPace / rate);

  const from = parseLocalDate(fromDateISO);
  from.setDate(from.getDate() + daysNeeded);
  return toISODate(from);
}

/**
 * 4. Days gained between two projected dates.
 * Positive = the goal moved closer (sooner purchase).
 * Example: Sept 28 → Sept 22 = 6 days gained.
 */
export function daysGained(oldProjectedISO: string, newProjectedISO: string): number {
  const oldDate = parseLocalDate(oldProjectedISO);
  const newDate = parseLocalDate(newProjectedISO);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((oldDate.getTime() - newDate.getTime()) / msPerDay);
}

/**
 * Calendar days from demo “today” until the projected purchase date.
 */
export function daysUntil(fromISO: string, targetISO: string): number {
  const from = parseLocalDate(fromISO);
  const target = parseLocalDate(targetISO);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((target.getTime() - from.getTime()) / msPerDay));
}

/**
 * Move a projected date earlier by N days (used when a recommendation is accepted).
 */
export function shiftDateEarlier(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate);
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

/**
 * 5. Recommendation score
 *
 * Rewards: more days gained, lower lifestyle disruption, and no risk to
 * required expenses (obligationsProtected = true adds a bonus).
 *
 * Formula (prototype — intentionally simple):
 *   score = (daysGained * 10) - (disruptionScore * 4) + (obligationsProtected ? 15 : -50)
 *
 * Higher score = better recommendation to surface first.
 */
export function recommendationScore(input: {
  estimatedDaysGained: number;
  disruptionScore: number; // 1–5
  obligationsProtected: boolean;
}): number {
  const timeReward = input.estimatedDaysGained * 10;
  const disruptionPenalty = input.disruptionScore * 4;
  const safetyBonus = input.obligationsProtected ? 15 : -50;
  return timeReward - disruptionPenalty + safetyBonus;
}

/**
 * Convert a dollar savings amount into estimated days gained
 * using the user’s mock daily contribution rate.
 * Example: $18 ÷ $3/day = 6 days.
 */
export function daysFromSavings(savingsAmount: number, dailyContributionRate: number): number {
  const rate = dailyContributionRate > 0 ? dailyContributionRate : 1;
  return Math.max(0, Math.round(savingsAmount / rate));
}

/**
 * 6. Safe to spend — liquid after bills & risk
 *
 *   pool            = checking + goalReserve − obligations
 *   earmarkedRisk   = monthly risk budget + rollover − spent
 *   freeToSpend     = pool − risk
 *   earmarkedGoals  = $ parked in active goal reserves (subset of free
 *                     until purchased — shown for transparency)
 *
 * Purchases always reduce the pool (cash leaves to the merchant), so
 * free-to-spend falls by the purchase price. Goal pots are still "yours"
 * until you buy — they are not a second subtraction that zeroes out the buy.
 */
export function discretionaryPool(
  checkingBalance: number,
  goalReserveBalance: number,
  obligationsTotal: number
): number {
  return Math.max(0, checkingBalance + goalReserveBalance - obligationsTotal);
}

/** Cash parked toward active (not yet purchased) goals. */
export function earmarkedForGoals(
  goals: {
    targetPrice: number;
    fundedAmount?: number;
    purchased: boolean;
  }[]
): number {
  return goals
    .filter((g) => !g.purchased)
    .reduce((sum, g) => {
      const funded = Math.max(0, g.fundedAmount ?? 0);
      const target = Math.max(0, g.targetPrice);
      return sum + Math.min(funded, target);
    }, 0);
}

export function freeToSpend(
  checkingBalance: number,
  goalReserveBalance: number,
  obligationsTotal: number,
  _goals: {
    targetPrice: number;
    fundedAmount?: number;
    purchased: boolean;
  }[],
  riskEarmark = 0
): number {
  const pool = discretionaryPool(
    checkingBalance,
    goalReserveBalance,
    obligationsTotal
  );
  return Math.max(0, pool - Math.max(0, riskEarmark));
}

/** @deprecated Prefer freeToSpend + discretionaryPool — kept for simple call sites */
export function safeToSpend(
  checkingBalance: number,
  obligationsTotal: number
): number {
  return Math.max(0, checkingBalance - obligationsTotal);
}

export interface SafeSpendBreakdown {
  /** Money left after rent / tuition / loan */
  pool: number;
  /** $ parked in active goal reserves (still counts in free until purchased) */
  earmarkedGoals: number;
  /** Risk cushion earmarked for unforeseen shocks */
  earmarkedRisk: number;
  /** Goals + risk (for display); free only subtracts risk from pool */
  earmarked: number;
  /**
   * Liquid after bills & risk. Includes money parked in goals until you buy.
   * A purchase always lowers this by the price paid.
   */
  free: number;
  /** Flexible slice of free not yet parked in a goal */
  unallocated: number;
  /** Already sitting in goal reserves */
  reservedTowardGoals: number;
  /** Still needed to fully fund active goals */
  stillToFund: number;
  /** Full list-price targets of active goals (intent, not a cash lock) */
  goalTargets: number;
}

export function safeSpendBreakdown(input: {
  checkingBalance: number;
  goalReserveBalance: number;
  obligationsTotal: number;
  riskEarmark?: number;
  goals: {
    name: string;
    targetPrice: number;
    fundedAmount: number;
    purchased: boolean;
  }[];
}): SafeSpendBreakdown {
  const active = input.goals.filter((g) => !g.purchased);
  const pool = discretionaryPool(
    input.checkingBalance,
    input.goalReserveBalance,
    input.obligationsTotal
  );
  const earmarkedGoals = earmarkedForGoals(active);
  const earmarkedRisk = Math.max(0, input.riskEarmark ?? 0);
  const earmarked = earmarkedGoals + earmarkedRisk;
  const free = Math.max(0, pool - earmarkedRisk);
  const unallocated = Math.max(0, free - earmarkedGoals);
  const stillToFund = active.reduce(
    (sum, g) => sum + remainingAmount(g.fundedAmount, g.targetPrice),
    0
  );
  const goalTargets = active.reduce(
    (sum, g) => sum + Math.max(0, g.targetPrice),
    0
  );

  return {
    pool,
    earmarkedGoals,
    earmarkedRisk,
    earmarked,
    free,
    unallocated,
    reservedTowardGoals: earmarkedGoals,
    stillToFund,
    goalTargets,
  };
}

/** Sum itemized obligations (rent + tuition + loan + …). */
export function obligationsTotal(
  obligations: { amount: number }[]
): number {
  return obligations.reduce((sum, o) => sum + o.amount, 0);
}

/**
 * 7. Pace gap — “I need it by this date” vs current forecast
 *
 * Interview-friendly story:
 * - At today’s savings pace, you’ll hit the goal on `projectedDate`
 * - If you want it by `wantByDate` (earlier), you need extra dollars sooner
 *
 *   daysAvailable     = days from demo today until want-by
 *   fundedByThen      = dailyRate × daysAvailable  (capped at remaining)
 *   extraSavingsNeeded = remaining − fundedByThen
 *   daysSooner        = projectedDate − wantByDate  (positive = pull forward)
 */
export function paceGapToDate(input: {
  fundedAmount: number;
  targetPrice: number;
  dailyContributionRate: number;
  fromDateISO: string;
  projectedDateISO: string;
  wantByDateISO: string;
}): {
  remaining: number;
  daysAvailable: number;
  daysSooner: number;
  extraSavingsNeeded: number;
  requiredDailyRate: number;
  onPace: boolean;
  alreadyFunded: boolean;
} {
  const remaining = remainingAmount(input.fundedAmount, input.targetPrice);
  if (remaining <= 0) {
    return {
      remaining: 0,
      daysAvailable: 0,
      daysSooner: daysGained(input.projectedDateISO, input.wantByDateISO),
      extraSavingsNeeded: 0,
      requiredDailyRate: 0,
      onPace: true,
      alreadyFunded: true,
    };
  }

  const rate = input.dailyContributionRate > 0 ? input.dailyContributionRate : 1;
  const daysAvailable = daysUntil(input.fromDateISO, input.wantByDateISO);
  const fundedByThen = Math.min(remaining, rate * daysAvailable);
  const extraSavingsNeeded = Math.max(0, Math.round(remaining - fundedByThen));
  const daysSooner = daysGained(input.projectedDateISO, input.wantByDateISO);
  const requiredDailyRate =
    daysAvailable > 0 ? Math.ceil((remaining / daysAvailable) * 10) / 10 : remaining;

  return {
    remaining,
    daysAvailable,
    daysSooner: Math.max(0, daysSooner),
    extraSavingsNeeded,
    requiredDailyRate,
    onPace: extraSavingsNeeded <= 0,
    alreadyFunded: false,
  };
}

/**
 * Rank recommendations for closing a savings gap.
 * Prefers tips that cover more of the needed dollars at lower disruption.
 */
export function gapFitScore(
  savingsAmount: number,
  disruptionScore: number,
  extraSavingsNeeded: number
): number {
  if (extraSavingsNeeded <= 0) return 0;
  const coverage = Math.min(1, savingsAmount / extraSavingsNeeded);
  return coverage * 40 + savingsAmount * 2 - disruptionScore * 5;
}

/**
 * Price opportunity — only meaningful when reserved cash is close enough
 * that a realistic discount can unlock purchase.
 *
 * Max discount: 20% of list price, capped at $50 (demo-sized sale).
 * Eligible when remaining ≤ that max discount (funded would cover sale price).
 */
export function priceOpportunityMaxDiscount(targetPrice: number): number {
  return Math.min(50, Math.max(15, Math.round(targetPrice * 0.2)));
}

export function priceOpportunityEligible(
  fundedAmount: number,
  targetPrice: number
): boolean {
  const remaining = remainingAmount(fundedAmount, targetPrice);
  if (remaining <= 0) return false; // already buyable at full price
  return remaining <= priceOpportunityMaxDiscount(targetPrice);
}

/** Sale price that unlocks purchase when eligible; otherwise null. */
export function priceOpportunitySalePrice(
  fundedAmount: number,
  targetPrice: number
): number | null {
  if (!priceOpportunityEligible(fundedAmount, targetPrice)) return null;
  const maxOff = priceOpportunityMaxDiscount(targetPrice);
  // Drop enough to unlock with current reserve (at least $15 off for the story)
  const neededOff = remainingAmount(fundedAmount, targetPrice);
  const discount = Math.max(15, Math.min(maxOff, neededOff));
  return Math.max(0, targetPrice - discount);
}
