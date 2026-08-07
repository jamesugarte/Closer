/**
 * Wallet / cash-out engine for the Closer demo.
 *
 * Rules:
 * - Money never appears from nowhere (cap moves at checking + available surplus).
 * - A purchase always removes the price from liquid assets (checking + goal reserve).
 * - Every cash-out posts a ledger transaction and a balance-history snapshot so
 *   Home, Activity, Health, and Analytics stay in sync.
 */

import { AIRPODS_GOAL_ID, rankPendingRecommendations } from "./mock-data";
import { captureBalanceSnapshot } from "./balance-sheet";
import { estimatedPurchaseDate } from "./calculations";
import { surplusAvailableForGoal } from "./surplus";
import type {
  ActivityItem,
  AppState,
  Goal,
  Recommendation,
  Transaction,
  UserProfile,
} from "./types";
import { formatMoney } from "./utils";

export type PurchaseFailReason =
  | "missing_goal"
  | "already_purchased"
  | "insufficient_funds";

export interface PurchaseResult {
  ok: boolean;
  reason?: PurchaseFailReason;
  /** Dollars that left liquid wallet (always = price when ok) */
  spent?: number;
  /** Dollars pulled from checking to finish the pot */
  topUpFromChecking?: number;
  /** Checking after the purchase */
  checkingAfter?: number;
  /** Goal reserve after the purchase */
  reserveAfter?: number;
  /** Free-to-spend after (caller may compute; included for UI) */
  message?: string;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function pushActivity(
  activity: ActivityItem[],
  item: Omit<ActivityItem, "id" | "timestamp"> & { timestamp?: number }
): ActivityItem[] {
  return [
    {
      id: uid("act"),
      timestamp: item.timestamp ?? Date.now(),
      ...item,
    },
    ...activity,
  ];
}

/** Sum of cash parked in active (not purchased) goals. */
export function activeFundedTotal(goals: Goal[]): number {
  return goals
    .filter((g) => !g.purchased)
    .reduce((sum, g) => sum + Math.max(0, Math.min(g.fundedAmount, g.targetPrice)), 0);
}

/**
 * Keep goal reserve ≥ active funded pots. Slack above funded is fine
 * (unallocated reserve); never let pots exceed the reserve pot.
 */
export function reconcileGoalReserve(
  goalReserveBalance: number,
  goals: Goal[]
): number {
  const funded = activeFundedTotal(goals);
  return Math.max(funded, Math.max(0, goalReserveBalance));
}

/** Cash that can leave checking for a goal top-up / tip — never invent money. */
export function spendableFromChecking(
  user: UserProfile,
  risk: AppState["risk"],
  goals: Goal[],
  goalId: string
): number {
  const surplus = surplusAvailableForGoal(user, risk, goals, goalId);
  return Math.max(0, Math.min(surplus, user.checkingBalance));
}

/**
 * Move checking → goal reserve for a tip / surplus allocate.
 * Returns null if nothing can move.
 */
export function applyCheckingToGoal(input: {
  user: UserProfile;
  goals: Goal[];
  goalId: string;
  amount: number;
  demoToday: string;
  label: string;
}): {
  user: UserProfile;
  goals: Goal[];
  moved: number;
  activity: Omit<ActivityItem, "id" | "timestamp">[];
} | null {
  const goal = input.goals.find((g) => g.id === input.goalId && !g.purchased);
  if (!goal) return null;

  const moved = Math.min(
    Math.max(0, Math.round(input.amount)),
    Math.max(0, input.user.checkingBalance)
  );
  if (moved < 1) return null;

  const newFunded = goal.fundedAmount + moved;
  const goals = input.goals.map((g) =>
    g.id !== goal.id
      ? g
      : {
          ...g,
          fundedAmount: newFunded,
          completed: newFunded >= g.targetPrice,
          projectedPurchaseDate:
            newFunded >= g.targetPrice ? input.demoToday : g.projectedPurchaseDate,
          contributions: [
            {
              id: uid("c"),
              label: input.label,
              amount: moved,
              date: input.demoToday,
            },
            ...g.contributions,
          ],
        }
  );

  const user: UserProfile = {
    ...input.user,
    checkingBalance: Math.max(0, input.user.checkingBalance - moved),
    goalReserveBalance: reconcileGoalReserve(
      input.user.goalReserveBalance + moved,
      goals
    ),
  };

  return {
    user,
    goals,
    moved,
    activity: [
      {
        kind: "contribution",
        title: "Checking → goal pot",
        detail: `Moved ${formatMoney(moved)} from Student Checking into ${goal.name}`,
        amount: moved,
        date: input.demoToday,
      },
    ],
  };
}

function refreshSiblingDates(
  user: UserProfile,
  risk: AppState["risk"],
  goals: Goal[],
  demoToday: string,
  skipGoalId?: string
): Goal[] {
  return goals.map((g) => {
    if (g.purchased || g.id === skipGoalId) return g;
    const surplus = surplusAvailableForGoal(user, risk, goals, g.id);
    return {
      ...g,
      projectedPurchaseDate: estimatedPurchaseDate(
        g.fundedAmount,
        g.targetPrice,
        user.dailyContributionRate,
        demoToday,
        surplus
      ),
    };
  });
}

function merchantForGoal(goal: Goal): string {
  const cat = goal.category.toLowerCase();
  if (cat.includes("travel") || goal.name.toLowerCase().includes("break")) {
    return "Spring Break Travel Co.";
  }
  if (cat.includes("tech") || goal.name.toLowerCase().includes("airpods")) {
    return "Campus Tech Store";
  }
  if (goal.name.toLowerCase().includes("concert")) {
    return "Ticketmaster · Campus";
  }
  return "Campus Marketplace";
}

/**
 * Apply a goal purchase: cash leaves the wallet, ledger + history update,
 * goal archives, sibling dates refresh.
 */
export function applyGoalPurchase(
  prev: AppState,
  goalId: string
): { state: AppState; result: PurchaseResult } {
  const goal = prev.goals.find((g) => g.id === goalId);
  if (!goal) {
    return { state: prev, result: { ok: false, reason: "missing_goal" } };
  }
  if (goal.purchased) {
    return { state: prev, result: { ok: false, reason: "already_purchased" } };
  }

  const price = Math.max(0, goal.targetPrice);
  const shortfall = Math.max(0, price - goal.fundedAmount);
  const available =
    shortfall > 0
      ? spendableFromChecking(prev.user, prev.risk, prev.goals, goal.id)
      : 0;
  const topUp = Math.min(shortfall, available);

  if (shortfall > 0 && topUp < shortfall) {
    return {
      state: prev,
      result: {
        ok: false,
        reason: "insufficient_funds",
        message: `Need ${formatMoney(shortfall)} more in checking / free cash to finish ${goal.name}.`,
      },
    };
  }

  let checking = prev.user.checkingBalance;
  let goalReserve = prev.user.goalReserveBalance;
  let fundedAmount = goal.fundedAmount;
  let activity = prev.activity;

  if (topUp > 0) {
    checking = Math.max(0, checking - topUp);
    goalReserve += topUp;
    fundedAmount += topUp;
    activity = pushActivity(activity, {
      kind: "contribution",
      title: "Checking → goal pot",
      detail: `Moved ${formatMoney(topUp)} from Student Checking to finish ${goal.name} before purchase`,
      amount: topUp,
      date: prev.demoToday,
    });
  }

  // Cash leaves the system: pay merchant from the goal pot
  goalReserve = Math.max(0, goalReserve - price);
  const leftover = Math.max(0, fundedAmount - price);

  const purchasedRecord: Goal = {
    ...goal,
    fundedAmount: leftover,
    purchased: true,
    completed: true,
    projectedPurchaseDate: prev.demoToday,
    contributions:
      topUp > 0
        ? [
            {
              id: uid("c"),
              label: "From checking · finish purchase",
              amount: topUp,
              date: prev.demoToday,
            },
            ...goal.contributions,
          ]
        : goal.contributions,
  };

  let goals: Goal[] = [
    ...prev.goals.filter((g) => g.id !== goalId),
    purchasedRecord,
  ];

  // Any leftover on a purchased goal returns to checking (wallet reflection)
  if (leftover > 0) {
    checking += leftover;
    goalReserve = Math.max(0, goalReserve - leftover);
    purchasedRecord.fundedAmount = 0;
    goals = goals.map((g) =>
      g.id === purchasedRecord.id ? { ...purchasedRecord } : g
    );
    activity = pushActivity(activity, {
      kind: "contribution",
      title: "Leftover reserve → checking",
      detail: `${formatMoney(leftover)} unused in ${goal.name} pot returned to Student Checking`,
      amount: leftover,
      date: prev.demoToday,
    });
  }

  goalReserve = reconcileGoalReserve(
    goalReserve,
    goals.filter((g) => !g.purchased)
  );

  const user: UserProfile = {
    ...prev.user,
    checkingBalance: checking,
    goalReserveBalance: goalReserve,
  };

  goals = refreshSiblingDates(user, prev.risk, goals, prev.demoToday, goalId);

  const recommendations: Recommendation[] = prev.recommendations.map((r) =>
    r.goalId === goalId && r.status === "pending"
      ? { ...r, status: "superseded" as const }
      : r
  );

  const nextFocus =
    goals.find((g) => !g.purchased && g.id === AIRPODS_GOAL_ID)?.id ??
    goals.find((g) => !g.purchased && g.id === prev.focusedGoalId)?.id ??
    goals.find((g) => !g.purchased)?.id ??
    null;

  const nextRec = nextFocus
    ? rankPendingRecommendations(recommendations, nextFocus)[0]
    : undefined;

  const tx: Transaction = {
    id: uid("tx"),
    date: prev.demoToday,
    merchant: merchantForGoal(goal),
    category: "shopping",
    amount: -price,
    source: "Student Checking",
    unforeseen: false,
    note: `Goal purchase · ${goal.name}`,
    patternKey: "goal_purchase",
  };

  activity = pushActivity(activity, {
    kind: "purchase",
    title: `Spent · ${goal.name}`,
    detail: `Paid ${formatMoney(price)} to ${merchantForGoal(goal)}. Money left your wallet${
      topUp > 0 ? ` · ${formatMoney(topUp)} came from checking` : " · from goal reserve"
    }. Free-to-spend and balances updated.`,
    amount: -price,
    date: prev.demoToday,
  });

  const snapshot = captureBalanceSnapshot({
    date: prev.demoToday,
    monthsAdvanced: prev.monthsAdvanced ?? 0,
    user,
    goals,
    risk: prev.risk,
  });

  const state: AppState = {
    ...prev,
    goals,
    recommendations,
    focusedGoalId: nextFocus,
    activeRecommendationId: nextRec?.id ?? null,
    homeRecommendationFeedback: null,
    demoCompletedPurchase: true,
    user,
    activity,
    transactions: [tx, ...(prev.transactions ?? [])],
    balanceHistory: [...(prev.balanceHistory ?? []), snapshot],
  };

  return {
    state,
    result: {
      ok: true,
      spent: price,
      topUpFromChecking: topUp,
      checkingAfter: checking,
      reserveAfter: goalReserve,
      message: `Spent ${formatMoney(price)}. Liquid wallet down ${formatMoney(price)}.`,
    },
  };
}
