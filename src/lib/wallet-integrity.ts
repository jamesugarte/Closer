/**
 * Wallet integrity — every displayed dollar must trace to checking,
 * goal reserve, or risk reserve. Helpers keep pots honest and translate
 * cash into time (what students actually understand).
 */

import { captureBalanceSnapshot } from "./balance-sheet";
import { safeSpendBreakdown } from "./calculations";
import { monthlyCashflow } from "./income";
import { riskReserveAvailable } from "./risk";
import { activeFundedTotal, reconcileGoalReserve } from "./wallet";
import type { AppState, BalanceSnapshot, Goal, RiskState, UserProfile } from "./types";
import { formatMoney } from "./utils";

export interface WalletProvenance {
  checking: number;
  goalReserve: number;
  riskReserve: number;
  liquidAssets: number;
  /** Sum of active goal pots (must be ≤ goalReserve) */
  fundedInGoals: number;
  /** goalReserve − fundedInGoals */
  unallocatedReserve: number;
  freeToSpend: number;
  unallocated: number;
  netObligations: number;
  monthlyCashflow: number;
  liquidMonthly: number;
  /** free ÷ typical daily burn — “how many days of life left in the wallet” */
  breathingRoomDays: number;
  /** Same as weeks (rounded) */
  breathingRoomWeeks: number;
  /** True when pots reconcile and history tip matches live wallets */
  consistent: boolean;
  issues: string[];
}

export function breathingRoomFromFree(
  freeToSpend: number,
  typicalDiscretionaryPerDay: number
): { days: number; weeks: number } {
  const burn = Math.max(8, typicalDiscretionaryPerDay);
  const days = Math.max(0, Math.round(freeToSpend / burn));
  return { days, weeks: Math.round((days / 7) * 10) / 10 };
}

/** Explain a wallet number in time language students already get. */
export function timePhraseForDollars(
  amount: number,
  typicalDiscretionaryPerDay: number
): string {
  const { days, weeks } = breathingRoomFromFree(amount, typicalDiscretionaryPerDay);
  if (days <= 0) return "no breathing room left";
  if (days < 7) return `about ${days} day${days === 1 ? "" : "s"} of normal spending`;
  if (weeks < 8) return `about ${weeks} week${weeks === 1 ? "" : "s"} of normal spending`;
  const months = Math.round((days / 30) * 10) / 10;
  return `about ${months} month${months === 1 ? "" : "s"} of normal spending`;
}

export function inspectWallet(input: {
  user: UserProfile;
  goals: Goal[];
  risk: RiskState;
  lastSnapshot?: BalanceSnapshot | null;
}): WalletProvenance {
  const fundedInGoals = activeFundedTotal(input.goals);
  const goalReserve = input.user.goalReserveBalance;
  const riskEarmark = Math.min(
    riskReserveAvailable(input.risk),
    Math.max(0, input.user.riskReserveBalance)
  );
  const flow = monthlyCashflow(
    input.user.incomeStreams ?? [],
    input.user.upcomingObligations
  );
  const breakdown = safeSpendBreakdown({
    checkingBalance: input.user.checkingBalance,
    goalReserveBalance: goalReserve,
    obligationsTotal: flow.netObligations,
    riskEarmark,
    goals: input.goals,
  });
  const liquidAssets =
    input.user.checkingBalance + goalReserve + input.user.riskReserveBalance;
  const room = breathingRoomFromFree(
    breakdown.free,
    input.user.typicalDiscretionaryPerDay
  );

  const issues: string[] = [];
  if (goalReserve + 0.5 < fundedInGoals) {
    issues.push(
      `Goal pots (${formatMoney(fundedInGoals)}) exceed goal reserve (${formatMoney(goalReserve)})`
    );
  }
  if (input.user.checkingBalance < -0.5) {
    issues.push("Checking balance is negative");
  }
  if (input.lastSnapshot) {
    const tip = input.lastSnapshot;
    if (
      Math.abs(tip.checking - input.user.checkingBalance) > 1 ||
      Math.abs(tip.goalReserves - goalReserve) > 1 ||
      Math.abs(tip.riskReserve - input.user.riskReserveBalance) > 1
    ) {
      issues.push(
        `Latest history snapshot (checking ${formatMoney(tip.checking)}) ≠ live wallet (checking ${formatMoney(input.user.checkingBalance)})`
      );
    }
  }

  return {
    checking: input.user.checkingBalance,
    goalReserve,
    riskReserve: input.user.riskReserveBalance,
    liquidAssets,
    fundedInGoals,
    unallocatedReserve: Math.max(0, goalReserve - fundedInGoals),
    freeToSpend: breakdown.free,
    unallocated: breakdown.unallocated,
    netObligations: flow.netObligations,
    monthlyCashflow: flow.cashflow,
    liquidMonthly: flow.liquidMonthly,
    breathingRoomDays: room.days,
    breathingRoomWeeks: room.weeks,
    consistent: issues.length === 0,
    issues,
  };
}

/**
 * Reconcile pots + rebase the tip of balanceHistory to the live wallet
 * so every surface (home, cashflow, calendar) tells the same story.
 */
export function reconcileAppWallet(state: AppState): AppState {
  const goalReserveBalance = reconcileGoalReserve(
    state.user.goalReserveBalance,
    state.goals
  );
  const user = { ...state.user, goalReserveBalance };
  const live = captureBalanceSnapshot({
    date: state.demoToday,
    monthsAdvanced: state.monthsAdvanced ?? 0,
    user,
    goals: state.goals,
    risk: state.risk,
  });

  const history = [...(state.balanceHistory ?? [])];
  if (history.length === 0) {
    history.push(live);
  } else {
    const last = history[history.length - 1];
    const sameDay = last.date === live.date;
    if (sameDay) {
      history[history.length - 1] = live;
    } else if (
      Math.abs(last.checking - live.checking) > 1 ||
      Math.abs(last.goalReserves - live.goalReserves) > 1
    ) {
      // Stale tip from an old seed — replace with truth, keep prior months
      history[history.length - 1] = {
        ...live,
        // Keep chronological date of tip as demoToday
        date: live.date,
        monthsAdvanced: live.monthsAdvanced,
      };
    }
  }

  return { ...state, user, balanceHistory: history };
}

/** Color band for calendar / health-over-time (students read color, not $). */
export type HealthBand = "crisis" | "tight" | "ok" | "strong";

export function healthBandFromSnapshot(s: BalanceSnapshot): HealthBand {
  const score = s.financialFreedomScore;
  const cf = s.monthlyCashflow;
  if (cf != null && cf < -50) return "crisis";
  if (score < 35 || (cf != null && cf < 0)) return "crisis";
  if (score < 55) return "tight";
  if (score < 75) return "ok";
  return "strong";
}

export const HEALTH_BAND_STYLE: Record<
  HealthBand,
  { fill: string; label: string; ring: string }
> = {
  crisis: {
    fill: "bg-rose-500",
    label: "In the red",
    ring: "ring-rose-400",
  },
  tight: {
    fill: "bg-amber-400",
    label: "Stretched",
    ring: "ring-amber-300",
  },
  ok: {
    fill: "bg-teal-400",
    label: "Holding",
    ring: "ring-teal-300",
  },
  strong: {
    fill: "bg-emerald-500",
    label: "Breathing room",
    ring: "ring-emerald-400",
  },
};
