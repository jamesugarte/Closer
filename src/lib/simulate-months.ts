/**
 * Pure month-advance simulation for the Closer demo clock.
 */

import {
  captureBalanceSnapshot,
} from "./balance-sheet";
import { daysFromSavings, estimatedPurchaseDate, remainingAmount } from "./calculations";
import {
  buildFurnitureRecommendations,
  buildObligationsForPhase,
  mergePersistentLoanObligations,
  collegePhase,
  collegeYearFromMonthsAdvanced,
  furnitureGoalDefaults,
  obligationsTotalFromList,
  yearTransition,
} from "./college-life";
import {
  allocateGoalInstallments,
  installmentDueThisMonth,
} from "./goal-installments";
import { buildStarterRecommendations, filterUnconsumedTips } from "./goal-recommendations";
import {
  billCreditDeposit,
  monthlyCashflow,
  recurringLiquidDeposit,
  semesterDisbursementsDue,
  sumStreamAmounts,
} from "./income";
import { AIRPODS_GOAL_ID, REC_GOOD_JOB_ID, rankPendingRecommendations } from "./mock-data";
import { demotePriorities } from "./reallocation";
import { surplusAvailableForGoal } from "./surplus";
import { applyGoalPurchase } from "./wallet";
import {
  enforceDeficitPriority,
  isRunningDeficit,
} from "./deficit";
import {
  assessPortfolioGoalHealth,
  enforceGoalHealthPriority,
} from "./goal-health";
import { enforceIncomeGrowthPriority } from "./income-growth";
import type {
  ActivityItem,
  AppState,
  Goal,
  Recommendation,
  Transaction,
} from "./types";
import { addMonths, formatLongDate, formatMoney } from "./utils";

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pushActivity(
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

export function runSimulateMonths(prev: AppState, count: number): AppState {
  const months = Math.max(1, Math.min(48, Math.floor(count)));
  let demoToday = prev.demoToday;
  let user = {
    ...prev.user,
    obligations: prev.user.obligations.map((o) => ({ ...o })),
    collegeYear: prev.user.collegeYear ?? 1,
  };
  let risk = { ...prev.risk };
  let goals = prev.goals.map((g) => ({
    ...g,
    contributions: [...g.contributions],
  }));
  let activity = prev.activity;
  let recommendations = [...prev.recommendations];
  let balanceHistory = [...(prev.balanceHistory ?? [])];
  let monthsAdvanced = prev.monthsAdvanced;
  let lastUnusedRisk = 0;
  let furnitureMoveOffered = prev.furnitureMoveOffered ?? false;
  let focusedGoalId = prev.focusedGoalId;
  let transactions = [...(prev.transactions ?? [])];

  const pushTx = (partial: Omit<Transaction, "id"> & { id?: string }) => {
    transactions = [
      {
        id: partial.id ?? uid("tx"),
        ...partial,
      },
      ...transactions,
    ];
  };

  for (let i = 0; i < months; i++) {
    const monthsBefore = monthsAdvanced;
    demoToday = addMonths(demoToday, 1);
    monthsAdvanced += 1;

    const academicYear = collegeYearFromMonthsAdvanced(monthsAdvanced - 1);
    let phase = collegePhase(academicYear);
    const crossed = yearTransition(monthsBefore, monthsAdvanced);

    if (crossed) {
      phase = collegePhase(crossed);
      const obligations = mergePersistentLoanObligations(
        buildObligationsForPhase(phase, demoToday),
        user.obligations,
        demoToday
      );
      let streams = [...(user.incomeStreams ?? [])];
      // Aid bridge bill credit was sized to the prior year — bump it if the
      // new phase recreates a bills hole (don't leave her in structural red).
      const billCreditIdx = streams.findIndex(
        (s) => s.id === "inc-income-bridge-bills"
      );
      if (billCreditIdx >= 0) {
        const trialUser = {
          ...user,
          obligations,
          upcomingObligations: obligationsTotalFromList(obligations),
          incomeStreams: streams,
        };
        const hole = monthlyCashflow(
          trialUser.incomeStreams ?? [],
          trialUser.upcomingObligations
        ).cashflow;
        if (hole < 0) {
          const cur = streams[billCreditIdx];
          streams = streams.map((s, i) =>
            i === billCreditIdx
              ? {
                  ...cur,
                  amount: cur.amount + Math.round(-hole),
                  note: `${cur.note ?? ""} · topped up for ${phase.label} bills`.trim(),
                }
              : s
          );
        }
      }
      user = {
        ...user,
        collegeYear: crossed,
        age: 17 + crossed,
        obligations,
        upcomingObligations: obligationsTotalFromList(obligations),
        incomeStreams: streams,
      };
      activity = pushActivity(activity, {
        kind: "time_advance",
        title: `${phase.label} year begins`,
        detail: `${phase.housingLabel}. ${
          phase.mealPlan
            ? "Meal plan + dorm furniture included."
            : "Groceries replace meal plan · furniture is on you."
        }`,
        date: demoToday,
      });

      if (crossed === 3 && !furnitureMoveOffered) {
        furnitureMoveOffered = true;
        const defaults = furnitureGoalDefaults(demoToday);
        const furnitureId = uid("goal");
        const projected = estimatedPurchaseDate(
          0,
          defaults.targetPrice,
          user.dailyContributionRate,
          demoToday
        );
        const furnitureGoal: Goal = {
          id: furnitureId,
          name: defaults.name,
          targetPrice: defaults.targetPrice,
          originalTargetPrice: defaults.targetPrice,
          fundedAmount: 0,
          category: defaults.category,
          projectedPurchaseDate: projected,
          originalProjectedDate: projected,
          optionalTargetDate: defaults.optionalTargetDate,
          completed: false,
          purchased: false,
          saleApplied: false,
          contributions: [],
          createdAt: demoToday,
          priority: 1,
        };
        goals = demotePriorities([furnitureGoal, ...goals], furnitureId).map(
          (g) => (g.id === furnitureId ? { ...g, priority: 1 } : g)
        );
        const marketTips = filterUnconsumedTips(
          buildFurnitureRecommendations({
            goalId: furnitureId,
            goalName: furnitureGoal.name,
            dailyRate: user.dailyContributionRate,
            makeId: () => uid("rec"),
          }),
          recommendations,
          furnitureId
        );
        recommendations = [...marketTips, ...recommendations];
        focusedGoalId = furnitureId;
        activity = pushActivity(activity, {
          kind: "goal_created",
          title: "Apartment move · furniture goal",
          detail:
            "Junior year off-campus: furniture goal + Marketplace/thrift tips. Dorm years had furniture included.",
          amount: furnitureGoal.targetPrice,
          date: demoToday,
        });
      }
    } else {
      const obligations = mergePersistentLoanObligations(
        buildObligationsForPhase(phase, demoToday),
        user.obligations,
        demoToday
      );
      user = {
        ...user,
        collegeYear: academicYear,
        obligations,
        upcomingObligations: obligationsTotalFromList(obligations),
      };
    }

    // ── Monthly cash waterfall ──────────────────────────────────────────
    // Priority: 1) income in → 2) bills → 3) risks incurred (+ cushion)
    //           → 4) goal installments (loan-like) → 5) discretionary spend
    // Students always buy *something* when cash remains after obligations.

    const streams = user.incomeStreams ?? [];

    // 1. Income deposits
    const monthPay = recurringLiquidDeposit(streams);
    user = {
      ...user,
      checkingBalance: user.checkingBalance + monthPay,
      nextPaycheckAmount: Math.round(
        streams
          .filter((s) => s.landsInChecking && s.cadence === "biweekly")
          .reduce((sum, s) => sum + s.amount, 0)
      ),
      nextPaycheckDate: demoToday,
    };
    if (monthPay > 0) {
      activity = pushActivity(activity, {
        kind: "paycheck",
        title: "Income deposits",
        detail: `Job + work-study + family (${formatMoney(monthPay)}) · ${formatLongDate(demoToday)}`,
        amount: monthPay,
        date: demoToday,
      });
      pushTx({
        date: demoToday,
        merchant: "Income deposits · job / family",
        category: "income",
        amount: monthPay,
        source: "Student Checking",
        unforeseen: false,
      });
    }

    const semesterHits = semesterDisbursementsDue(streams, demoToday);
    if (semesterHits.length > 0) {
      const refund = sumStreamAmounts(semesterHits);
      user = {
        ...user,
        checkingBalance: user.checkingBalance + refund,
      };
      activity = pushActivity(activity, {
        kind: "paycheck",
        title: "Aid refund · Direct Loan",
        detail: `${semesterHits.map((s) => s.label).join(", ")} · ${formatMoney(refund)} into checking after bursar takes billed charges.`,
        amount: refund,
        date: demoToday,
      });
      pushTx({
        date: demoToday,
        merchant: "Direct Loan refund",
        category: "income",
        amount: refund,
        source: "Student Checking",
        unforeseen: false,
        note: "Semester living refund after bursar",
      });
    }

    // 2. Protected bills
    const bills = user.upcomingObligations;
    const bursarCredit = billCreditDeposit(streams);
    const netBills = Math.max(0, bills - bursarCredit);
    const billsPaid = Math.min(netBills, user.checkingBalance);
    user = {
      ...user,
      checkingBalance: Math.max(0, user.checkingBalance - billsPaid),
    };
    activity = pushActivity(activity, {
      kind: "living_spend",
      title: "Protected obligations paid",
      detail:
        bursarCredit > 0
          ? `${phase.label}: ${formatMoney(bills)} billed − ${formatMoney(bursarCredit)} aid → ${formatMoney(billsPaid)} from checking`
          : `${phase.label}: ${phase.monthlyObligations
              .map((o) => o.label.split(" (")[0])
              .join(", ")} · ${formatMoney(billsPaid)}`,
      amount: -billsPaid,
      date: demoToday,
    });
    if (billsPaid > 0) {
      pushTx({
        date: demoToday,
        merchant: "Protected bills · housing / meals / tuition",
        category: "other",
        amount: -billsPaid,
        source: "Student Checking",
        unforeseen: false,
        note:
          bursarCredit > 0
            ? `Net after ${formatMoney(bursarCredit)} bursar aid`
            : "Monthly protected obligations",
      });
    }

    // 3. Risks incurred (shock) then rebuild cushion
    const shockThisMonth = monthsAdvanced % 2 === 0 ? 35 : 0;
    if (shockThisMonth > 0) {
      const fromRisk = Math.min(shockThisMonth, user.riskReserveBalance);
      const fromChecking = Math.min(
        shockThisMonth - fromRisk,
        user.checkingBalance
      );
      const newRiskBalance = Math.max(0, user.riskReserveBalance - fromRisk);
      risk = {
        ...risk,
        spentThisMonth: fromRisk,
        rolledOver: Math.max(0, newRiskBalance - risk.monthlyBudget),
      };
      user = {
        ...user,
        riskReserveBalance: newRiskBalance,
        checkingBalance: Math.max(0, user.checkingBalance - fromChecking),
      };
      const shockPaid = fromRisk + fromChecking;
      activity = pushActivity(activity, {
        kind: "unforeseen",
        title: "Unforeseen · risk incurred",
        detail:
          fromRisk > 0
            ? `${formatMoney(shockPaid)} surprise — ${formatMoney(fromRisk)} from risk cushion (goals untouched)`
            : `${formatMoney(shockPaid)} surprise hit checking`,
        amount: -shockPaid,
        date: demoToday,
      });
      pushTx({
        date: demoToday,
        merchant: "Unforeseen · small shock",
        category: "other",
        amount: -shockPaid,
        source: "Student Checking",
        unforeseen: true,
        note:
          fromRisk > 0
            ? `${formatMoney(fromRisk)} covered by risk cushion`
            : "Hit checking",
      });
    } else {
      risk = { ...risk, spentThisMonth: 0 };
    }

    // Rebuild risk cushion toward monthly budget before goal payments
    const riskNeed = Math.max(0, risk.monthlyBudget - user.riskReserveBalance);
    if (riskNeed > 0 && user.checkingBalance > 0) {
      const riskTopUp = Math.min(riskNeed, user.checkingBalance);
      user = {
        ...user,
        checkingBalance: Math.max(0, user.checkingBalance - riskTopUp),
        riskReserveBalance: user.riskReserveBalance + riskTopUp,
      };
      if (riskTopUp > 0) {
        activity = pushActivity(activity, {
          kind: "risk_rollover",
          title: "Risk cushion topped up",
          detail: `Moved ${formatMoney(riskTopUp)} into risk before goal payments (priority #2)`,
          amount: riskTopUp,
          date: demoToday,
        });
      }
    }

    // 4. Goal installments — loan-like payments toward each end date
    const activeForPay = goals.filter(
      (g) => !g.purchased && remainingAmount(g.fundedAmount, g.targetPrice) > 0
    );
    const { splits, total: installmentTotal } = allocateGoalInstallments({
      available: user.checkingBalance,
      demoToday,
      goals,
    });

    if (installmentTotal > 0) {
      goals = goals.map((g) => {
        if (g.purchased) return g;
        const add = splits[g.id] ?? 0;
        if (add <= 0) {
          const remaining = remainingAmount(g.fundedAmount, g.targetPrice);
          if (remaining <= 0) {
            return {
              ...g,
              completed: true,
              projectedPurchaseDate: demoToday,
            };
          }
          // Missed/partial month — push projected date out if behind plan
          const due = installmentDueThisMonth(demoToday, g);
          return {
            ...g,
            projectedPurchaseDate: estimatedPurchaseDate(
              g.fundedAmount,
              g.targetPrice,
              Math.max(1, due / 30),
              demoToday,
              surplusAvailableForGoal(user, risk, goals, g.id)
            ),
          };
        }
        const newFunded = g.fundedAmount + add;
        const due = installmentDueThisMonth(demoToday, {
          ...g,
          fundedAmount: newFunded,
        });
        const projected = estimatedPurchaseDate(
          newFunded,
          g.targetPrice,
          Math.max(1, due / 30),
          demoToday,
          0
        );
        return {
          ...g,
          fundedAmount: newFunded,
          completed: newFunded >= g.targetPrice,
          projectedPurchaseDate:
            newFunded >= g.targetPrice ? demoToday : projected,
          contributions: [
            {
              id: uid("c"),
              label: `Installment · priority #${g.priority} payment plan`,
              amount: add,
              date: demoToday,
            },
            ...g.contributions,
          ],
        };
      });

      user = {
        ...user,
        checkingBalance: Math.max(0, user.checkingBalance - installmentTotal),
        goalReserveBalance: user.goalReserveBalance + installmentTotal,
      };

      const paidNames = activeForPay
        .filter((g) => (splits[g.id] ?? 0) > 0)
        .sort((a, b) => a.priority - b.priority)
        .map((g) => `#${g.priority} ${g.name} ${formatMoney(splits[g.id]!)}`)
        .slice(0, 3)
        .join(" · ");

      activity = pushActivity(activity, {
        kind: "contribution",
        title: "Goal installments paid",
        detail: `${formatMoney(installmentTotal)} toward payment plans (${paidNames || "active goals"}) — after bills & risk`,
        amount: installmentTotal,
        date: demoToday,
      });
    } else if (activeForPay.length > 0) {
      // Still refresh dates when nothing could be paid
      goals = goals.map((g) => {
        if (g.purchased || remainingAmount(g.fundedAmount, g.targetPrice) <= 0) {
          return g;
        }
        const due = installmentDueThisMonth(demoToday, g);
        return {
          ...g,
          projectedPurchaseDate: estimatedPurchaseDate(
            g.fundedAmount,
            g.targetPrice,
            Math.max(1, due / 30),
            demoToday,
            0
          ),
        };
      });
      activity = pushActivity(activity, {
        kind: "contribution",
        title: "Goal installments skipped",
        detail:
          "No cash left after bills and risk — payment plans paused this month",
        date: demoToday,
      });
    }

    // 5. Discretionary living spend — students buy things every month
    // ~22 spend-days of typical daily burn, but never wipe the checking
    // safety buffer (students still need next month's bill float).
    // When cashflow is thin, lifestyle can't run at "flush" rates — otherwise
    // break-even after the bridge forever looks like crisis on the calendar.
    const flowNow = monthlyCashflow(
      user.incomeStreams ?? [],
      user.upcomingObligations
    );
    let lifestyleTarget = Math.max(
      40,
      Math.round(user.typicalDiscretionaryPerDay * 22)
    );
    if (flowNow.cashflow < 500) {
      const cap = Math.max(
        90,
        Math.round(flowNow.liquidMonthly * 0.4 + Math.max(0, flowNow.cashflow) * 0.55)
      );
      lifestyleTarget = Math.min(lifestyleTarget, cap);
    }
    const billFloat = Math.max(120, Math.round(user.upcomingObligations * 0.15));
    const livingSpend = Math.min(
      lifestyleTarget,
      Math.max(0, user.checkingBalance - billFloat)
    );
    if (livingSpend > 0) {
      user = {
        ...user,
        checkingBalance: Math.max(0, user.checkingBalance - livingSpend),
      };
      activity = pushActivity(activity, {
        kind: "living_spend",
        title: "Discretionary spending",
        detail: `Food, rides, coffee, social — ${formatMoney(livingSpend)} after bills, risk, and goal payments (~$${user.typicalDiscretionaryPerDay}/day · kept ${formatMoney(billFloat)} bill float)`,
        amount: -livingSpend,
        date: demoToday,
      });
      pushTx({
        date: demoToday,
        merchant: "Everyday discretionary",
        category: "food",
        amount: -livingSpend,
        source: "Student Checking",
        unforeseen: false,
        note: "Monthly lifestyle after obligations & goal installments",
      });
    } else if (user.checkingBalance > 0 && user.checkingBalance <= billFloat) {
      activity = pushActivity(activity, {
        kind: "living_spend",
        title: "Lifestyle paused · protecting bill float",
        detail: `Closer held spending so ${formatMoney(user.checkingBalance)} stays for next month’s protected bills.`,
        date: demoToday,
      });
    }

    // Auto-purchase fully funded goals — real cash-out via wallet engine
    const readyIds = goals
      .filter(
        (g) => !g.purchased && (g.completed || g.fundedAmount >= g.targetPrice)
      )
      .map((g) => g.id);

    for (const readyId of readyIds) {
      const applied = applyGoalPurchase(
        {
          ...prev,
          user,
          goals,
          risk,
          recommendations,
          activity,
          transactions,
          balanceHistory,
          demoToday,
          monthsAdvanced,
          focusedGoalId,
        },
        readyId
      );
      if (!applied.result.ok) continue;
      user = applied.state.user;
      goals = applied.state.goals;
      recommendations = applied.state.recommendations;
      activity = applied.state.activity;
      transactions = applied.state.transactions;
      balanceHistory = applied.state.balanceHistory;
      focusedGoalId = applied.state.focusedGoalId;
    }

    const unused = Math.max(0, risk.monthlyBudget - risk.spentThisMonth);
    lastUnusedRisk = unused;
    risk = {
      ...risk,
      rolledOver: Math.max(0, user.riskReserveBalance - risk.monthlyBudget),
      spentThisMonth: 0,
    };
    // Keep risk pot = budget + rollover (already topped up earlier in waterfall)
    user = {
      ...user,
      riskReserveBalance: Math.max(
        user.riskReserveBalance,
        risk.monthlyBudget + risk.rolledOver
      ),
    };
    risk = {
      ...risk,
      rolledOver: Math.max(0, user.riskReserveBalance - risk.monthlyBudget),
    };

    activity = pushActivity(activity, {
      kind: "risk_rollover",
      title: "Risk cushion rolled forward",
      detail:
        unused > 0
          ? `$${unused} unused risk · cushion ${formatMoney(user.riskReserveBalance)}`
          : `Risk tapped · cushion ${formatMoney(user.riskReserveBalance)}`,
      amount: unused,
      date: demoToday,
    });

    activity = pushActivity(activity, {
      kind: "time_advance",
      title: `Time advanced · ${formatLongDate(demoToday)}`,
      detail: `${phase.label} · ${phase.housingLabel}`,
      date: demoToday,
    });

    balanceHistory = [
      ...balanceHistory,
      captureBalanceSnapshot({
        date: demoToday,
        monthsAdvanced,
        user,
        goals,
        risk,
      }),
    ];
  }

  if (lastUnusedRisk > 0 && !isRunningDeficit(user, goals, demoToday)) {
    const bonus = Math.min(25, Math.max(10, Math.round(risk.rolledOver * 0.2)));
    const goalId =
      focusedGoalId ??
      goals.find((g) => !g.purchased)?.id ??
      AIRPODS_GOAL_ID;
    const days = daysFromSavings(bonus, user.dailyContributionRate);
    const goodJob: Recommendation = {
      id: REC_GOOD_JOB_ID,
      kind: "good_job_bonus",
      title: `Good job — ${days} days closer?`,
      description: `After ${months} simulated month${months === 1 ? "" : "s"}, unused risk money rolled forward. Closer recommends moving $${bonus} into your top goal — you choose.`,
      savingsAmount: bonus,
      estimatedDaysGained: days,
      disruptionScore: 1,
      category: "risk",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceSummary: `Risk rollover now $${risk.rolledOver} after time advance`,
    };
    recommendations = [
      goodJob,
      ...recommendations.filter(
        (r) => r.id !== REC_GOOD_JOB_ID && r.kind !== "good_job_bonus"
      ),
    ];
    risk = {
      ...risk,
      pendingGoodJobBonus: bonus,
      lastQuietMonthBonusOffered: true,
    };
  }

  const focused =
    goals.find((g) => g.id === focusedGoalId && !g.purchased) ??
    goals.find((g) => !g.purchased);

  if (focused) {
    const pendingForFocus = recommendations.filter(
      (r) => r.goalId === focused.id && r.status === "pending"
    ).length;
    if (pendingForFocus < 3) {
      // Top up with NEW tips only — never wipe pending or revive one-shots
      const fresh = buildStarterRecommendations(
        focused,
        user.dailyContributionRate,
        transactions,
        () => uid("rec"),
        recommendations,
        { user, risk, goals, demoToday }
      );
      if (fresh.length > 0) {
        recommendations = [...fresh, ...recommendations];
      }
    }
  }

  recommendations = enforceDeficitPriority(
    recommendations,
    user,
    goals,
    demoToday,
    () => uid("rec")
  );

  const healthReport = assessPortfolioGoalHealth({
    user,
    goals,
    risk,
    demoToday,
  });
  recommendations = enforceGoalHealthPriority(
    recommendations,
    healthReport,
    () => uid("rec"),
    { deferForDeficit: isRunningDeficit(user, goals, demoToday) }
  );
  recommendations = enforceIncomeGrowthPriority(
    recommendations,
    user,
    goals,
    () => uid("rec")
  );

  const top = focused
    ? rankPendingRecommendations(recommendations, focused.id)[0]
    : undefined;
  const preferHealth =
    healthReport.level !== "green"
      ? recommendations.find(
          (r) => r.status === "pending" && r.category === "goal-health"
        )
      : undefined;
  const preferBridge = recommendations.find(
    (r) => r.status === "pending" && r.kind === "income_bridge"
  );
  const preferGrowth = recommendations.find(
    (r) => r.status === "pending" && r.kind === "income_growth"
  );
  const preferGoodJob = recommendations.find(
    (r) => r.id === REC_GOOD_JOB_ID && r.status === "pending"
  );

  return {
    ...prev,
    demoToday,
    monthsAdvanced,
    user,
    risk,
    goals,
    recommendations,
    activity,
    transactions,
    balanceHistory,
    furnitureMoveOffered,
    focusedGoalId: focused?.id ?? focusedGoalId,
    activeRecommendationId:
      preferBridge?.id ??
      preferGrowth?.id ??
      preferHealth?.id ??
      preferGoodJob?.id ??
      top?.id ??
      prev.activeRecommendationId,
    homeRecommendationFeedback: null,
  };
}
