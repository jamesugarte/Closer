"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  daysUntil,
  daysFromSavings,
  fundingPercentage,
  remainingAmount,
  shiftDateEarlier,
  estimatedPurchaseDate,
  priceOpportunitySalePrice,
} from "@/lib/calculations";
import { buildStarterRecommendations } from "@/lib/goal-recommendations";
import { isTimeSensitiveGoal } from "@/lib/deadline";
import {
  buildPortfolioOptimizationTips,
  clearPendingPortfolioTips,
} from "@/lib/portfolio-optimize";
import {
  AIRPODS_GOAL_ID,
  DEMO_TODAY,
  rankPendingRecommendations,
  REC_GOOD_JOB_ID,
} from "@/lib/mock-data";
import { createInitialState } from "@/lib/initial-state";
import {
  buildReallocationRecommendation,
  demotePriorities,
} from "@/lib/reallocation";
import { buildAppStateFromBlueprint } from "@/lib/build-state-from-profile";
import { JORDAN_BLUEPRINT } from "@/lib/personas";
import { runSimulateMonths } from "@/lib/simulate-months";
import {
  surplusAvailableForGoal,
  surplusAvailableForNewGoal,
} from "@/lib/surplus";
import {
  applyGoalPurchase,
  applyCheckingToGoal,
  reconcileGoalReserve,
  type PurchaseResult,
} from "@/lib/wallet";
import {
  applyIncomeBridgeLoan,
  isRunningDeficit,
} from "@/lib/deficit";
import {
  applyIncomeGrowth,
  enforceIncomeGrowthPriority,
} from "@/lib/income-growth";
import {
  assessPortfolioGoalHealth,
  GOAL_HEALTH_CATEGORY,
  isGoalHealthTip,
  syncStateGoalHealth,
  type GoalHealthReport,
} from "@/lib/goal-health";
import { reconcileAppWallet } from "@/lib/wallet-integrity";
import { captureBalanceSnapshot } from "@/lib/balance-sheet";
import { clearState, isSessionEntered, loadState, saveState, setSessionEntered } from "@/lib/storage";
import type {
  ActivityItem,
  AppState,
  Goal,
  GoalCategory,
  Recommendation,
} from "@/lib/types";
import { formatLongDate, formatMoney } from "@/lib/utils";

interface AppContextValue {
  state: AppState;
  hydrated: boolean;
  /** False until user finishes login → diagnostic → Enter Closer */
  sessionEntered: boolean;
  primaryGoal: Goal | undefined;
  activeGoals: Goal[];
  activeRecommendation: Recommendation | null;
  /** Portfolio feasibility score — the product core */
  goalHealth: GoalHealthReport;
  /** Pending AI trade-off tips for goal health */
  goalHealthTips: Recommendation[];
  acceptRecommendation: (recommendationId: string) => void;
  rejectRecommendation: (recommendationId: string) => void;
  createGoal: (input: {
    name: string;
    targetPrice: number;
    category: GoalCategory;
    optionalTargetDate?: string;
    prioritize?: boolean;
    timeSensitive?: boolean;
  }) => string;
  focusGoal: (goalId: string) => void;
  setDesiredDate: (goalId: string, wantByISO: string) => void;
  simulateQuietMonth: () => void;
  simulateMonths: (count: number) => void;
  simulatePriceOpportunity: (goalId: string) => void;
  /** Returns whether cash actually left the wallet */
  confirmPurchase: (goalId: string) => PurchaseResult;
  /** Reload current persona’s opening seed */
  resetDemo: () => void;
  /** Load a full AppState from intake / diagnostic and enter the phone UI */
  enterWithState: (next: AppState) => void;
  /** Back to login / persona picker */
  exitToLogin: () => void;
  fundingPct: (goal: Goal) => number;
  remaining: (goal: Goal) => number;
  daysAway: (goal: Goal) => number;
}

const AppContext = createContext<AppContextValue | null>(null);

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pushActivity(
  activity: ActivityItem[],
  item: Omit<ActivityItem, "id" | "timestamp"> & { timestamp?: number }
): ActivityItem[] {
  const entry: ActivityItem = {
    id: uid("act"),
    timestamp: item.timestamp ?? Date.now(),
    ...item,
  };
  return [entry, ...activity];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(createInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [sessionEntered, setSessionEnteredState] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSessionEnteredState(isSessionEntered());
      if (isSessionEntered()) {
        const loaded = loadState();
        if (!loaded.focusedGoalId) {
          loaded.focusedGoalId =
            loaded.goals.find((g) => !g.purchased)?.id ?? null;
        }
        setState(
          syncStateGoalHealth(
            reconcileAppWallet(loaded),
            () => uid("rec")
          )
        );
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated || !sessionEntered) return;
    saveState(state);
  }, [state, hydrated, sessionEntered]);

  const activeGoals = useMemo(
    () =>
      state.goals
        .filter((g) => !g.purchased)
        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)),
    [state.goals]
  );

  const primaryGoal = useMemo(() => {
    const focused = state.focusedGoalId
      ? state.goals.find((g) => g.id === state.focusedGoalId && !g.purchased)
      : undefined;
    return (
      focused ??
      state.goals.find((g) => g.id === AIRPODS_GOAL_ID && !g.purchased) ??
      state.goals.find((g) => !g.purchased)
    );
  }, [state.goals, state.focusedGoalId]);

  const goalHealth = useMemo(() => {
    const report = assessPortfolioGoalHealth({
      user: state.user,
      goals: state.goals,
      risk: state.risk,
      demoToday: state.demoToday,
    });
    // Structural deficit → loan owns the lock, not goal-health
    if (
      isRunningDeficit(state.user, state.goals, state.demoToday) &&
      report.locked
    ) {
      return {
        ...report,
        locked: false,
        headline: "Goal health · stabilize income first",
        detail:
          "Bills exceed income. Accept the aid bridge first — then goal trade-offs unlock.",
      };
    }
    return report;
  }, [state.user, state.goals, state.risk, state.demoToday]);

  const goalHealthTips = useMemo(
    () =>
      state.recommendations.filter(
        (r) =>
          r.status === "pending" && r.category === GOAL_HEALTH_CATEGORY
      ),
    [state.recommendations]
  );

  const activeRecommendation = useMemo(() => {
    const bridge = state.recommendations.find(
      (r) => r.status === "pending" && r.kind === "income_bridge"
    );
    if (bridge) return bridge;
    const growth = state.recommendations.find(
      (r) => r.status === "pending" && r.kind === "income_growth"
    );
    if (growth) return growth;
    if (goalHealth.level !== "green") {
      const health = state.recommendations.find(
        (r) =>
          r.status === "pending" && r.category === GOAL_HEALTH_CATEGORY
      );
      if (health) return health;
    }
    if (!state.activeRecommendationId) return null;
    return (
      state.recommendations.find((r) => r.id === state.activeRecommendationId) ??
      null
    );
  }, [
    state.activeRecommendationId,
    state.recommendations,
    goalHealth.level,
  ]);

  const acceptRecommendation = useCallback((recommendationId: string) => {
    setState((prev) => {
      const rec = prev.recommendations.find((r) => r.id === recommendationId);
      if (!rec || rec.status !== "pending") return prev;

      const healthNow = assessPortfolioGoalHealth({
        user: prev.user,
        goals: prev.goals,
        risk: prev.risk,
        demoToday: prev.demoToday,
      });

      // When goal health is red, only income-bridge + income-growth + goal-health tips may apply
      if (
        healthNow.locked &&
        rec.kind !== "income_bridge" &&
        rec.kind !== "income_growth" &&
        !isGoalHealthTip(rec)
      ) {
        return {
          ...prev,
          homeRecommendationFeedback: "rejected",
          activity: pushActivity(prev.activity, {
            kind: "recommendation_rejected",
            title: "Blocked — fix cashflow / goals first",
            detail:
              "Approve the aid bridge, an income tip, or a goal trade-off before other moves.",
            date: prev.demoToday,
          }),
        };
      }

      // Block discretionary accepts while still in structural deficit
      if (
        isRunningDeficit(prev.user, prev.goals, prev.demoToday) &&
        rec.kind !== "income_bridge" &&
        rec.kind !== "income_growth"
      ) {
        return {
          ...prev,
          homeRecommendationFeedback: "rejected",
          activity: pushActivity(prev.activity, {
            kind: "recommendation_rejected",
            title: "Blocked — close the deficit first",
            detail:
              "Accept the aid bridge (or earn more) before lifestyle tips.",
            date: prev.demoToday,
          }),
        };
      }

      if (rec.kind === "income_growth" && rec.applyIncomeStream) {
        const user = applyIncomeGrowth({
          user: prev.user,
          stream: rec.applyIncomeStream,
          bumpExistingId: rec.applyIncomeBumpId,
          bumpBy: rec.applyIncomeBumpBy,
        });
        const recommendations = prev.recommendations.map((r) =>
          r.id === recommendationId ? { ...r, status: "accepted" as const } : r
        );
        const snapshot = captureBalanceSnapshot({
          date: prev.demoToday,
          monthsAdvanced: prev.monthsAdvanced ?? 0,
          user,
          goals: prev.goals,
          risk: prev.risk,
        });
        return syncStateGoalHealth(
          {
            ...prev,
            user,
            recommendations: enforceIncomeGrowthPriority(
              recommendations,
              user,
              prev.goals,
              () => uid("rec")
            ),
            homeRecommendationFeedback: "accepted",
            activeRecommendationId: recommendationId,
            balanceHistory: [...(prev.balanceHistory ?? []), snapshot],
            activity: pushActivity(prev.activity, {
              kind: "paycheck",
              title: "Income up",
              detail: rec.description,
              amount: rec.savingsAmount,
              date: prev.demoToday,
            }),
          },
          () => uid("rec")
        );
      }

      if (rec.kind === "income_bridge") {
        const loan = rec.applyLoanAmount ?? rec.savingsAmount;
        const forBills =
          rec.applyLoanForBills ??
          Math.max(0, loan - (rec.applyLoanForGoals ?? 0));
        const forGoals = rec.applyLoanForGoals ?? 0;
        const monthlyCredit =
          rec.applyLoanMonthlyBillCredit ??
          rec.applyLoanMonthlyEquivalent ??
          Math.round(forBills / 5);
        const user = applyIncomeBridgeLoan({
          user: prev.user,
          loanAmount: loan,
          loanForBills: forBills,
          loanForGoals: forGoals,
          monthlyBillCredit: monthlyCredit,
          demoToday: prev.demoToday,
        });
        const recommendations = prev.recommendations.map((r) => {
          if (r.id === recommendationId) return { ...r, status: "accepted" as const };
          if (
            r.status === "pending" &&
            (r.kind === "spend_pattern" ||
              r.kind === "surplus_allocation" ||
              r.kind === "reallocation" ||
              r.kind === "portfolio" ||
              r.kind === "pace" ||
              r.kind === "risk_avoidance")
          ) {
            return { ...r, status: "superseded" as const };
          }
          return r;
        });
        const snapshot = captureBalanceSnapshot({
          date: prev.demoToday,
          monthsAdvanced: prev.monthsAdvanced ?? 0,
          user,
          goals: prev.goals,
          risk: prev.risk,
        });
        return syncStateGoalHealth(
          {
            ...prev,
            user,
            recommendations,
            homeRecommendationFeedback: "accepted",
            activeRecommendationId: recommendationId,
            balanceHistory: [...(prev.balanceHistory ?? []), snapshot],
            activity: pushActivity(prev.activity, {
              kind: "paycheck",
              title: "Aid bridge · bills covered",
              detail: `${formatMoney(forBills)} earmarked for dorm/meals/tuition · ${formatMoney(forGoals)} to checking for goals. Loan cash is not free-to-spend.`,
              amount: forGoals,
              date: prev.demoToday,
            }),
          },
          () => uid("rec")
        );
      }

      if (rec.kind === "reallocation" && rec.fromGoalId) {
        const amount = rec.savingsAmount;
        const donor = prev.goals.find((g) => g.id === rec.fromGoalId);
        const target = prev.goals.find((g) => g.id === rec.goalId);
        if (!donor || !target || donor.fundedAmount < amount) return prev;

        const goals = prev.goals.map((goal) => {
          if (goal.id === rec.fromGoalId) {
            const newFunded = Math.max(0, goal.fundedAmount - amount);
            return {
              ...goal,
              fundedAmount: newFunded,
              completed: newFunded >= goal.targetPrice,
              projectedPurchaseDate: estimatedPurchaseDate(
                newFunded,
                goal.targetPrice,
                prev.user.dailyContributionRate,
                prev.demoToday
              ),
              contributions: [
                {
                  id: uid("c"),
                  label: `Reallocated to ${target.name}`,
                  amount: -amount,
                  date: prev.demoToday,
                },
                ...goal.contributions,
              ],
            };
          }
          if (goal.id === rec.goalId) {
            const newFunded = goal.fundedAmount + amount;
            const newDate =
              newFunded >= goal.targetPrice
                ? prev.demoToday
                : shiftDateEarlier(
                    goal.projectedPurchaseDate,
                    rec.estimatedDaysGained
                  );
            return {
              ...goal,
              fundedAmount: newFunded,
              projectedPurchaseDate: newDate,
              completed: newFunded >= goal.targetPrice,
              contributions: [
                {
                  id: uid("c"),
                  label: `Reallocated from ${donor.name}`,
                  amount,
                  date: prev.demoToday,
                },
                ...goal.contributions,
              ],
            };
          }
          return goal;
        });

        return {
          ...prev,
          goals,
          recommendations: prev.recommendations.map((r) =>
            r.id === recommendationId ? { ...r, status: "accepted" as const } : r
          ),
          focusedGoalId: rec.goalId,
          homeRecommendationFeedback: "accepted",
          activeRecommendationId: recommendationId,
          activity: pushActivity(
            pushActivity(prev.activity, {
              kind: "reallocation",
              title: "Reserves rearranged",
              detail: `Moved ${formatMoney(amount)} from ${donor.name} → ${target.name} per preference ranking`,
              amount,
              date: prev.demoToday,
            }),
            {
              kind: "date_change",
              title: "Preferred goal moved closer",
              detail: `${target.name}: +${rec.estimatedDaysGained} days from reallocation (no new cash needed)`,
              date: prev.demoToday,
            }
          ),
        };
      }

      if (rec.kind === "good_job_bonus") {
        const bonus = rec.savingsAmount;
        const goals = prev.goals.map((goal) => {
          if (goal.id !== rec.goalId || goal.purchased) return goal;
          const newFunded = goal.fundedAmount + bonus;
          const newDate =
            newFunded >= goal.targetPrice
              ? prev.demoToday
              : shiftDateEarlier(
                  goal.projectedPurchaseDate,
                  rec.estimatedDaysGained
                );
          return {
            ...goal,
            fundedAmount: newFunded,
            projectedPurchaseDate: newDate,
            completed: newFunded >= goal.targetPrice,
            contributions: [
              {
                id: uid("c"),
                label: "Good-job bonus from quiet risk month",
                amount: bonus,
                date: prev.demoToday,
              },
              ...goal.contributions,
            ],
          };
        });
        const newRolled = Math.max(0, prev.risk.rolledOver - bonus);
        return {
          ...prev,
          goals,
          recommendations: prev.recommendations.map((r) =>
            r.id === recommendationId ? { ...r, status: "accepted" as const } : r
          ),
          risk: {
            ...prev.risk,
            rolledOver: newRolled,
            pendingGoodJobBonus: null,
            lastQuietMonthBonusOffered: true,
          },
          user: {
            ...prev.user,
            riskReserveBalance: Math.max(0, prev.user.riskReserveBalance - bonus),
            goalReserveBalance: prev.user.goalReserveBalance + bonus,
          },
          focusedGoalId: rec.goalId,
          homeRecommendationFeedback: "accepted",
          activeRecommendationId: recommendationId,
          activity: pushActivity(
            pushActivity(prev.activity, {
              kind: "good_job_bonus",
              title: "Good-job bonus accepted",
              detail: `Moved ${formatMoney(bonus)} from unused risk cushion into your goal — you chose this`,
              amount: bonus,
              date: prev.demoToday,
            }),
            {
              kind: "date_change",
              title: "Projected date moved closer",
              detail: `Quiet-month bonus pulled the calendar forward ${rec.estimatedDaysGained} days`,
              date: prev.demoToday,
            }
          ),
        };
      }

      // Portfolio optimize: dates, priority, auto-save — no checking transfer
      if (rec.kind === "portfolio") {
        let goals = prev.goals.map((g) => ({ ...g }));
        let user = { ...prev.user };
        let activity = prev.activity;
        const detailBits: string[] = [];
        const healthRepair = isGoalHealthTip(rec);

        if (rec.applyCancelGoal) {
          goals = goals.map((g) =>
            g.id === rec.goalId
              ? {
                  ...g,
                  purchased: true,
                  completed: false,
                }
              : g
          );
          // Renumber remaining active priorities
          const active = goals
            .filter((g) => !g.purchased)
            .sort((a, b) => a.priority - b.priority);
          const rank = new Map(active.map((g, i) => [g.id, i + 1] as const));
          goals = goals.map((g) =>
            rank.has(g.id) ? { ...g, priority: rank.get(g.id)! } : g
          );
          detailBits.push("paused · removed from payment plans");
          activity = pushActivity(activity, {
            kind: "recommendation_accepted",
            title: "Goal paused",
            detail: rec.description,
            date: prev.demoToday,
          });
        }

        if (rec.applyOptionalTargetDate) {
          const target = goals.find((g) => g.id === rec.goalId);
          // Goal-health repairs may slide even fixed dates — she approved the trade-off
          if (
            target &&
            isTimeSensitiveGoal(target) &&
            !healthRepair
          ) {
            // Fixed deadlines never slide — ignore stale tip payloads
          } else if (!rec.applyCancelGoal) {
            goals = goals.map((g) =>
              g.id === rec.goalId
                ? { ...g, optionalTargetDate: rec.applyOptionalTargetDate }
                : g
            );
            detailBits.push(
              `want-by → ${formatLongDate(rec.applyOptionalTargetDate)}`
            );
            activity = pushActivity(activity, {
              kind: "date_change",
              title: healthRepair
                ? "Trade-off · want-by pushed"
                : "Want-by date adjusted",
              detail: rec.description,
              date: prev.demoToday,
            });
          }
        }

        if (
          typeof rec.applyTargetPrice === "number" &&
          rec.applyTargetPrice > 0 &&
          !rec.applyCancelGoal
        ) {
          goals = goals.map((g) => {
            if (g.id !== rec.goalId) return g;
            const price = Math.max(
              g.fundedAmount,
              Math.round(rec.applyTargetPrice!)
            );
            return {
              ...g,
              targetPrice: price,
              completed: g.fundedAmount >= price,
            };
          });
          detailBits.push(`target → ${formatMoney(rec.applyTargetPrice)}`);
          activity = pushActivity(activity, {
            kind: "recommendation_accepted",
            title: healthRepair
              ? "Trade-off · target right-sized"
              : "Goal target right-sized",
            detail: rec.description,
            amount: rec.savingsAmount,
            date: prev.demoToday,
          });
        }

        if (
          typeof rec.applyDailyContributionRate === "number" &&
          rec.applyDailyContributionRate > user.dailyContributionRate
        ) {
          user = {
            ...user,
            dailyContributionRate: rec.applyDailyContributionRate,
          };
          detailBits.push(`auto-save $${rec.applyDailyContributionRate}/day`);
          activity = pushActivity(activity, {
            kind: "recommendation_accepted",
            title: "Auto-save raised",
            detail: rec.description,
            amount: rec.savingsAmount,
            date: prev.demoToday,
          });
        }

        if (typeof rec.applyPriority === "number") {
          const targetPri = rec.applyPriority;
          goals = goals.map((g) => {
            if (g.id === rec.goalId) return { ...g, priority: targetPri };
            if (g.purchased) return g;
            if (g.priority >= targetPri && g.id !== rec.goalId) {
              return { ...g, priority: g.priority };
            }
            return g;
          });
          // Normalize 1..n by current order with victim last
          const active = goals
            .filter((g) => !g.purchased)
            .sort((a, b) => {
              if (a.id === rec.goalId) return 1;
              if (b.id === rec.goalId) return -1;
              return a.priority - b.priority;
            });
          const rank = new Map(
            active.map((g, i) => [g.id, i + 1] as const)
          );
          goals = goals.map((g) =>
            rank.has(g.id) ? { ...g, priority: rank.get(g.id)! } : g
          );
          detailBits.push(`priority reshuffled · ${rec.goalId}`);
          activity = pushActivity(activity, {
            kind: "recommendation_accepted",
            title: "Goal ranking updated",
            detail: rec.description,
            date: prev.demoToday,
          });
        }

        if (detailBits.length === 0) {
          activity = pushActivity(activity, {
            kind: "recommendation_accepted",
            title: "Portfolio tip accepted",
            detail: rec.description,
            date: prev.demoToday,
          });
        }

        const marked: AppState = {
          ...prev,
          user,
          goals,
          recommendations: prev.recommendations.map((r) =>
            r.id === recommendationId ? { ...r, status: "accepted" as const } : r
          ),
          homeRecommendationFeedback: "accepted",
          activeRecommendationId: recommendationId,
          activity,
        };
        return syncStateGoalHealth(marked, () => uid("rec"));
      }

      // Habit tips + surplus allocation: move checking → goal reserve (real cash only)
      const isSurplus = rec.kind === "surplus_allocation";
      const capped = isSurplus
        ? Math.min(
            rec.savingsAmount,
            prev.user.checkingBalance,
            surplusAvailableForGoal(
              prev.user,
              prev.risk,
              prev.goals,
              rec.goalId
            )
          )
        : Math.min(rec.savingsAmount, prev.user.checkingBalance);
      if (capped < 1) {
        return {
          ...prev,
          recommendations: prev.recommendations.map((r) =>
            r.id === recommendationId ? { ...r, status: "rejected" as const } : r
          ),
          homeRecommendationFeedback: "rejected",
          activity: pushActivity(prev.activity, {
            kind: "recommendation_rejected",
            title: "Couldn’t move cash",
            detail: `Not enough in Student Checking / free cash to fund “${rec.title}”.`,
            date: prev.demoToday,
          }),
        };
      }

      const moved = applyCheckingToGoal({
        user: prev.user,
        goals: prev.goals,
        goalId: rec.goalId,
        amount: capped,
        demoToday: prev.demoToday,
        label: isSurplus
          ? `From free-to-spend → goal`
          : `Saved via: ${rec.description}`,
      });
      if (!moved) return prev;

      const goal = moved.goals.find((g) => g.id === rec.goalId);
      let goals = moved.goals;
      if (goal && capped === rec.savingsAmount) {
        // Apply estimated days gained when full tip amount moved
        goals = goals.map((g) => {
          if (g.id !== rec.goalId || g.purchased) return g;
          if (g.fundedAmount >= g.targetPrice) {
            return { ...g, projectedPurchaseDate: prev.demoToday, completed: true };
          }
          return {
            ...g,
            projectedPurchaseDate: shiftDateEarlier(
              g.projectedPurchaseDate,
              rec.estimatedDaysGained
            ),
          };
        });
      }

      // Refresh sibling dates after checking/surplus change
      const refreshedGoals = goals.map((g) => {
        if (g.purchased || g.id === rec.goalId) return g;
        const surplus = surplusAvailableForGoal(
          moved.user,
          prev.risk,
          goals,
          g.id
        );
        return {
          ...g,
          projectedPurchaseDate: estimatedPurchaseDate(
            g.fundedAmount,
            g.targetPrice,
            prev.user.dailyContributionRate,
            prev.demoToday,
            surplus
          ),
        };
      });

      let activity = pushActivity(prev.activity, {
        kind: "recommendation_accepted",
        title: isSurplus
          ? "Free-to-spend moved into goal"
          : "Recommendation accepted",
        detail: rec.description,
        amount: capped,
        date: prev.demoToday,
      });
      for (const item of moved.activity) {
        activity = pushActivity(activity, item);
      }
      if (goal) {
        const g2 = refreshedGoals.find((x) => x.id === goal.id) ?? goal;
        activity = pushActivity(activity, {
          kind: "date_change",
          title: isSurplus
            ? "Goal funded from disposable cash"
            : "Projected date moved closer",
          detail: `${g2.name}: now ${formatLongDate(g2.projectedPurchaseDate)}${
            capped === rec.savingsAmount
              ? ` (−${rec.estimatedDaysGained} days)`
              : ` · moved ${formatMoney(capped)}`
          }`,
          date: prev.demoToday,
        });
      }

      const snapshot = captureBalanceSnapshot({
        date: prev.demoToday,
        monthsAdvanced: prev.monthsAdvanced ?? 0,
        user: moved.user,
        goals: refreshedGoals,
        risk: prev.risk,
      });

      return syncStateGoalHealth(
        {
          ...prev,
          goals: refreshedGoals,
          recommendations: prev.recommendations.map((r) =>
            r.id === recommendationId ? { ...r, status: "accepted" as const } : r
          ),
          activity,
          focusedGoalId: rec.goalId,
          user: {
            ...moved.user,
            goalReserveBalance: reconcileGoalReserve(
              moved.user.goalReserveBalance,
              refreshedGoals
            ),
          },
          balanceHistory: [...(prev.balanceHistory ?? []), snapshot],
          homeRecommendationFeedback: "accepted",
          activeRecommendationId: recommendationId,
        },
        () => uid("rec")
      );
    });
  }, []);

  const rejectRecommendation = useCallback((recommendationId: string) => {
    setState((prev) => {
      const rec = prev.recommendations.find((r) => r.id === recommendationId);
      if (!rec || rec.status !== "pending") return prev;

      const recommendations = prev.recommendations.map((r) =>
        r.id === recommendationId ? { ...r, status: "rejected" as const } : r
      );

      const nextPending = rankPendingRecommendations(
        recommendations,
        rec.goalId
      )[0];

      const activity = pushActivity(prev.activity, {
        kind: "recommendation_rejected",
        title: "Recommendation skipped",
        detail: `"${rec.description}" — Closer will learn your preferences`,
        date: prev.demoToday,
      });

      return syncStateGoalHealth(
        {
          ...prev,
          recommendations,
          activity,
          focusedGoalId: rec.goalId,
          homeRecommendationFeedback: "rejected",
          activeRecommendationId: nextPending?.id ?? null,
        },
        () => uid("rec")
      );
    });
  }, []);

  const createGoal = useCallback(
    (input: {
      name: string;
      targetPrice: number;
      category: GoalCategory;
      optionalTargetDate?: string;
      prioritize?: boolean;
      timeSensitive?: boolean;
    }) => {
      let createdId = "";
      const prioritize = input.prioritize !== false;

      // flushSync so /goals/[id] can read the new goal immediately after navigate
      flushSync(() => {
        setState((prev) => {
          const healthNow = assessPortfolioGoalHealth({
            user: prev.user,
            goals: prev.goals,
            risk: prev.risk,
            demoToday: prev.demoToday,
          });
          if (healthNow.locked) {
            return {
              ...prev,
              activity: pushActivity(prev.activity, {
                kind: "recommendation_rejected",
                title: "New goal blocked",
                detail:
                  "Goal health is red — approve trade-offs on existing goals before adding another.",
                date: prev.demoToday,
              }),
            };
          }

          const id = uid("goal");
          createdId = id;
          const surplusPreview = surplusAvailableForNewGoal(
            prev.user,
            prev.risk,
            prev.goals.filter((g) => !g.purchased),
            input.targetPrice,
            0
          );
          const projected = estimatedPurchaseDate(
            0,
            input.targetPrice,
            prev.user.dailyContributionRate,
            prev.demoToday,
            surplusPreview
          );

          const existingActive = prev.goals.filter((g) => !g.purchased);
          const priority = prioritize
            ? 1
            : existingActive.length > 0
              ? Math.max(...existingActive.map((g) => g.priority)) + 1
              : 1;

          const goal: Goal = {
            id,
            name: input.name.trim(),
            targetPrice: input.targetPrice,
            originalTargetPrice: input.targetPrice,
            fundedAmount: 0,
            category: input.category,
            projectedPurchaseDate: projected,
            originalProjectedDate: projected,
            optionalTargetDate: input.optionalTargetDate || undefined,
            completed: false,
            purchased: false,
            saleApplied: false,
            contributions: [],
            createdAt: prev.demoToday,
            priority,
            timeSensitive:
              input.timeSensitive ??
              (input.optionalTargetDate
                ? isTimeSensitiveGoal({
                    name: input.name.trim(),
                    category: input.category,
                    optionalTargetDate: input.optionalTargetDate,
                  })
                : false),
          };

          let goals = [goal, ...prev.goals];
          if (prioritize) {
            goals = demotePriorities(goals, id);
            // Ensure the new goal stays #1 after demote
            goals = goals.map((g) => (g.id === id ? { ...g, priority: 1 } : g));
          }

          const starters = buildStarterRecommendations(
            goal,
            prev.user.dailyContributionRate,
            prev.transactions,
            () => uid("rec"),
            prev.recommendations,
            {
              user: prev.user,
              risk: prev.risk,
              goals,
              demoToday: prev.demoToday,
            }
          );

          const reallocation = prioritize
            ? buildReallocationRecommendation({
                preferredGoal: goal,
                donorGoals: goals,
                dailyContributionRate: prev.user.dailyContributionRate,
                makeId: () => uid("rec"),
              })
            : null;

          // Surplus tip already first in starters; keep reallocation near top if present
          const tips = reallocation
            ? starters[0]?.kind === "surplus_allocation"
              ? [starters[0], reallocation, ...starters.slice(1)]
              : [reallocation, ...starters]
            : starters;

          // Portfolio pack — especially when a large (~$2k) goal reshuffles the stack
          const cleared = clearPendingPortfolioTips(prev.recommendations, {
            clearReallocations: prioritize && input.targetPrice >= 1500,
          });
          const portfolio = buildPortfolioOptimizationTips({
            goals,
            user: prev.user,
            risk: prev.risk,
            demoToday: prev.demoToday,
            makeId: () => uid("rec"),
            newlyAddedGoalId: prioritize ? id : undefined,
            history: [...tips, ...cleared],
          });

          const detailParts = [
            `${goal.name} · #${priority} preference`,
            surplusPreview >= input.targetPrice
              ? "fundable from free-to-spend"
              : `projected ${formatLongDate(projected)}`,
            `${starters.length} tips`,
          ];
          if (reallocation) {
            detailParts.push("reallocation tip from lower-ranked goal");
          }
          if (portfolio.length > 0) {
            detailParts.push(`${portfolio.length} portfolio optimize tips`);
          }

          return syncStateGoalHealth(
            {
              ...prev,
              goals,
              recommendations: [...portfolio, ...tips, ...cleared],
              focusedGoalId: id,
              activeRecommendationId:
                portfolio[0]?.id ?? tips[0]?.id ?? null,
              homeRecommendationFeedback: null,
              activity: pushActivity(prev.activity, {
                kind: "goal_created",
                title: prioritize
                  ? "New #1 goal · preferences reshuffled"
                  : "New goal created",
                detail: detailParts.join(" · "),
                amount: goal.targetPrice,
                date: prev.demoToday,
              }),
            },
            () => uid("rec")
          );
        });
      });

      return createdId;
    },
    []
  );

  const focusGoal = useCallback((goalId: string) => {
    setState((prev) => {
      if (prev.focusedGoalId === goalId) return prev;
      const goal = prev.goals.find((g) => g.id === goalId && !g.purchased);
      if (!goal) return prev;
      const top = rankPendingRecommendations(prev.recommendations, goalId)[0];
      return {
        ...prev,
        focusedGoalId: goalId,
        activeRecommendationId: top?.id ?? null,
        homeRecommendationFeedback: null,
      };
    });
  }, []);

  const setDesiredDate = useCallback((goalId: string, wantByISO: string) => {
    setState((prev) =>
      syncStateGoalHealth(
        {
          ...prev,
          goals: prev.goals.map((g) =>
            g.id === goalId ? { ...g, optionalTargetDate: wantByISO } : g
          ),
          activity: pushActivity(prev.activity, {
            kind: "date_change",
            title: "Want-by date updated",
            detail: `You set a new target date — Closer rechecked goal health.`,
            date: prev.demoToday,
          }),
        },
        () => uid("rec")
      )
    );
  }, []);

  /**
   * Demo control: month ended with unused risk budget.
   * Rolls unused $ into next month AND offers a good-job bonus tip.
   * Closer only recommends — nothing moves until Maya accepts.
   */
  const simulateQuietMonth = useCallback(() => {
    setState((prev) => {
      const unused = Math.max(0, prev.risk.monthlyBudget - prev.risk.spentThisMonth);
      if (unused <= 0 && prev.risk.rolledOver <= 0) return prev;

      const newRolled = prev.risk.rolledOver + unused;
      const bonus = Math.min(25, Math.max(10, Math.round(newRolled * 0.35)));
      const goalId =
        prev.focusedGoalId ??
        prev.goals.find((g) => !g.purchased)?.id ??
        AIRPODS_GOAL_ID;
      const days = daysFromSavings(bonus, prev.user.dailyContributionRate);

      const goodJob: Recommendation = {
        id: REC_GOOD_JOB_ID,
        kind: "good_job_bonus",
        title: `Good job — ${days} days closer?`,
        description: `You barely tapped your risk cushion. Closer recommends moving $${bonus} of unused risk rollover into your goal — keeping the rest as next month’s buffer. You choose; nothing moves unless you accept.`,
        savingsAmount: bonus,
        estimatedDaysGained: days,
        disruptionScore: 1,
        category: "risk",
        lifestyleImpact: "Low",
        status: "pending",
        goalId,
        evidenceSummary: `Quiet month: $${unused} unused of $${prev.risk.monthlyBudget} risk budget`,
      };

      const withoutOldBonus = prev.recommendations.filter(
        (r) => r.id !== REC_GOOD_JOB_ID && r.kind !== "good_job_bonus"
      );

      return {
        ...prev,
        risk: {
          ...prev.risk,
          rolledOver: newRolled,
          spentThisMonth: 0,
          pendingGoodJobBonus: bonus,
          lastQuietMonthBonusOffered: true,
        },
        user: {
          ...prev.user,
          riskReserveBalance: prev.risk.monthlyBudget + newRolled,
        },
        recommendations: [goodJob, ...withoutOldBonus],
        activeRecommendationId: goodJob.id,
        homeRecommendationFeedback: null,
        focusedGoalId: goalId,
        activity: pushActivity(prev.activity, {
          kind: "risk_rollover",
          title: "Quiet month · risk rolled forward",
          detail: `$${unused} unused risk front-loaded. Closer drafted a good-job bonus tip — recommend only.`,
          amount: unused,
          date: prev.demoToday,
        }),
      };
    });
  }, []);

  const simulatePriceOpportunity = useCallback((goalId: string) => {
    setState((prev) => {
      const current = prev.goals.find((g) => g.id === goalId);
      if (!current || current.saleApplied || current.purchased) return prev;

      const salePrice = priceOpportunitySalePrice(
        current.fundedAmount,
        current.targetPrice
      );
      // No-op if she can’t cover the sale with money already reserved
      if (salePrice === null || current.fundedAmount < salePrice) return prev;

      const discount = current.targetPrice - salePrice;

      const goals = prev.goals.map((goal) => {
        if (goal.id !== goalId) return goal;
        return {
          ...goal,
          targetPrice: salePrice,
          saleApplied: true,
          completed: true,
          projectedPurchaseDate: prev.demoToday,
        };
      });

      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return prev;

      return {
        ...prev,
        goals,
        focusedGoalId: goalId,
        activity: pushActivity(prev.activity, {
          kind: "sale_alert",
          title: "Price opportunity · ready to buy",
          detail: `${goal.name} dropped to $${salePrice} (−$${discount}). Your $${current.fundedAmount} reserve now covers it — waiting paid off.`,
          amount: -discount,
          date: prev.demoToday,
        }),
      };
    });
  }, []);

  const confirmPurchase = useCallback((goalId: string): PurchaseResult => {
    let result: PurchaseResult = { ok: false, reason: "missing_goal" };
    flushSync(() => {
      setState((prev) => {
        const applied = applyGoalPurchase(prev, goalId);
        result = applied.result;
        return applied.state;
      });
    });
    return result;
  }, []);

  const resetDemo = useCallback(() => {
    clearState();
    setState((prev) => {
      const persona = prev.personaId ?? "maya";
      const next =
        persona === "jordan"
          ? buildAppStateFromBlueprint(JORDAN_BLUEPRINT)
          : createInitialState();
      const synced = syncStateGoalHealth(next, () => uid("rec"));
      saveState(synced);
      return synced;
    });
  }, []);

  const enterWithState = useCallback((next: AppState) => {
    clearState();
    const synced = syncStateGoalHealth(next, () => uid("rec"));
    setState(synced);
    setSessionEntered(true);
    setSessionEnteredState(true);
    saveState(synced);
  }, []);

  const exitToLogin = useCallback(() => {
    setSessionEntered(false);
    setSessionEnteredState(false);
    clearState();
  }, []);

  /**
   * Fast-forward the demo clock.
   * Each month: living spend + bills, paycheck, priority-weighted auto-save,
   * risk cushion rollover, balance-sheet snapshot.
   * Tips stay recommend-only (including good-job after quiet months).
   */
  const simulateMonths = useCallback((count: number) => {
    setState((prev) =>
      syncStateGoalHealth(runSimulateMonths(prev, count), () => uid("rec"))
    );
  }, []);

  const value: AppContextValue = {
    state,
    hydrated,
    sessionEntered,
    primaryGoal,
    activeGoals,
    activeRecommendation,
    goalHealth,
    goalHealthTips,
    acceptRecommendation,
    rejectRecommendation,
    createGoal,
    focusGoal,
    setDesiredDate,
    simulateQuietMonth,
    simulateMonths,
    simulatePriceOpportunity,
    confirmPurchase,
    resetDemo,
    enterWithState,
    exitToLogin,
    fundingPct: (goal) => fundingPercentage(goal.fundedAmount, goal.targetPrice),
    remaining: (goal) => remainingAmount(goal.fundedAmount, goal.targetPrice),
    daysAway: (goal) =>
      goal.completed || goal.fundedAmount >= goal.targetPrice
        ? 0
        : daysUntil(state.demoToday ?? DEMO_TODAY, goal.projectedPurchaseDate),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
