/**
 * Build a coherent balanceHistory ending at the live wallet.
 * Used when remaking persona opens so the health calendar never lies.
 */

import { captureBalanceSnapshot } from "./balance-sheet";
import { addMonths } from "./utils";
import type { AppState, BalanceSnapshot, Goal, RiskState, UserProfile } from "./types";

/**
 * Synthesize `months` prior monthly snapshots that glide into the live
 * wallet — for demo storytelling (e.g. Maya’s health fading as goals piled up,
 * Jordan’s checking draining through summer).
 */
export function synthesizeBalanceHistory(input: {
  user: UserProfile;
  goals: Goal[];
  risk: RiskState;
  demoToday: string;
  monthsAdvanced: number;
  /** How many past months to invent (including “today”) */
  months?: number;
  /**
   * 0 = start healthier / richer than today (decline into open).
   * 1 = start worse (climb into open). Default decline for Maya stretch story.
   */
  trajectory?: "decline" | "climb";
}): BalanceSnapshot[] {
  const n = Math.max(1, input.months ?? 12);
  const live = captureBalanceSnapshot({
    date: input.demoToday,
    monthsAdvanced: input.monthsAdvanced,
    user: input.user,
    goals: input.goals,
    risk: input.risk,
  });

  const traj = input.trajectory ?? "decline";
  const history: BalanceSnapshot[] = [];

  for (let i = 0; i < n; i++) {
    const monthsAgo = n - 1 - i;
    const date = addMonths(input.demoToday, -monthsAgo);
    const t = n === 1 ? 1 : i / (n - 1); // 0 → past, 1 → today

    // Interpolate wallet pots toward live
    let checking: number;
    let goalReserves: number;
    let riskReserve: number;
    let scoreBoost: number;

    if (traj === "decline") {
      // Past was healthier: more checking, fewer goals reserved, higher score
      checking = Math.round(live.checking * (1.35 - 0.35 * t));
      goalReserves = Math.round(live.goalReserves * (0.25 + 0.75 * t));
      riskReserve = Math.round(
        Math.max(live.riskReserve, 40) * (1.2 - 0.2 * t)
      );
      scoreBoost = Math.round(18 * (1 - t));
    } else {
      // Past was worse (Jordan): less cash, climbing toward open
      checking = Math.round(live.checking * (0.35 + 0.65 * t));
      goalReserves = Math.round(live.goalReserves * (0.4 + 0.6 * t));
      riskReserve = Math.max(5, Math.round(live.riskReserve * (0.3 + 0.7 * t)));
      scoreBoost = Math.round(-22 * (1 - t));
    }

    const ghostUser: UserProfile = {
      ...input.user,
      checkingBalance: Math.max(0, checking),
      goalReserveBalance: Math.max(0, goalReserves),
      riskReserveBalance: Math.max(0, riskReserve),
    };
    const snap = captureBalanceSnapshot({
      date,
      monthsAdvanced: Math.max(0, input.monthsAdvanced - monthsAgo),
      user: ghostUser,
      goals: input.goals,
      risk: input.risk,
    });
    history.push({
      ...snap,
      financialFreedomScore: Math.max(
        5,
        Math.min(98, snap.financialFreedomScore + scoreBoost)
      ),
    });
  }

  // Tip must be exact live wallet
  history[history.length - 1] = live;
  return history;
}

export function withSynthesizedHistory(
  state: AppState,
  opts?: { months?: number; trajectory?: "decline" | "climb" }
): AppState {
  return {
    ...state,
    balanceHistory: synthesizeBalanceHistory({
      user: state.user,
      goals: state.goals,
      risk: state.risk,
      demoToday: state.demoToday,
      monthsAdvanced: state.monthsAdvanced ?? 0,
      months: opts?.months ?? 12,
      trajectory: opts?.trajectory,
    }),
  };
}
