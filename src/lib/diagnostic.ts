/**
 * Instant financial diagnostic from a ProfileBlueprint / AppState —
 * shown after intake, before entering the main Closer UI.
 */

import { captureBalanceSnapshot } from "./balance-sheet";
import { buildAppStateFromBlueprint } from "./build-state-from-profile";
import { assessGoalFeasibility } from "./goal-feasibility";
import { assessDeficitPlan } from "./deficit";
import { incomeSummary, monthlyCashflow, netProtectedObligations, recurringLiquidDeposit } from "./income";
import type { ProfileBlueprint } from "./profile-blueprint";
import type { AppState } from "./types";
import { formatMoney } from "./utils";

export interface DiagnosticFinding {
  id: string;
  severity: "critical" | "warn" | "ok" | "info";
  title: string;
  detail: string;
}

export interface DiagnosticRec {
  id: string;
  title: string;
  detail: string;
  /** Rough monthly $ impact if followed */
  monthlyImpact?: number;
}

export interface FinancialDiagnostic {
  personaId: string;
  name: string;
  arc: ProfileBlueprint["arc"];
  headline: string;
  summary: string;
  grade: "A" | "B" | "C" | "D" | "F";
  freedomScore: number;
  freeToSpend: number;
  netObligations: number;
  liquidMonthly: number;
  /** Signed: liquidMonthly − netObligations */
  monthlyCashflow: number;
  burnDaily: number;
  findings: DiagnosticFinding[];
  recommendations: DiagnosticRec[];
  /** State ready to load into the app */
  appState: AppState;
}

export function runDiagnostic(bp: ProfileBlueprint): FinancialDiagnostic {
  const appState = buildAppStateFromBlueprint(bp);
  const streams = appState.user.incomeStreams ?? [];
  const income = incomeSummary(streams);
  const netObl = netProtectedObligations(
    appState.user.upcomingObligations,
    streams
  );
  const snap = captureBalanceSnapshot({
    date: appState.demoToday,
    monthsAdvanced: appState.monthsAdvanced,
    user: appState.user,
    goals: appState.goals,
    risk: appState.risk,
  });

  const burn = appState.user.typicalDiscretionaryPerDay;
  const recurring = recurringLiquidDeposit(streams);
  const monthlyBurn = burn * 30;
  const monthlyAuto = appState.user.dailyContributionRate * 30;
  const flow = monthlyCashflow(streams, appState.user.upcomingObligations);
  const findings: DiagnosticFinding[] = [];
  const recommendations: DiagnosticRec[] = [];

  // Monthly income vs protected bills (signed — Jordan is deeply negative)
  if (flow.cashflow < 0) {
    const plan = assessDeficitPlan({
      user: appState.user,
      goals: appState.goals,
      demoToday: appState.demoToday,
    });
    findings.push({
      id: "cashflow-negative",
      severity: "critical",
      title: "Monthly income does not cover protected bills",
      detail: `${formatMoney(flow.liquidMonthly)} liquid in − ${formatMoney(flow.netObligations)} net obligations = ${formatMoney(flow.cashflow)}/mo. Closer will not recommend discretionary cuts as the fix — you need new income first.`,
    });
    recommendations.push({
      id: "rec-cashflow",
      title: `Take a ${formatMoney(plan.recommendedLoan)} student loan / aid bridge`,
      detail: `${formatMoney(plan.loanToStopDeficit)} covers the ${formatMoney(plan.monthlyDeficit)}/mo bills hole for ~${plan.monthsHorizon} months` +
        (plan.loanForGoals > 0
          ? `; ${formatMoney(plan.loanForGoals)} finishes active goals. Or add ~${formatMoney(plan.extraIncomeMonthlyWithGoals)}/mo earned income. No lifestyle tips until cashflow ≥ $0.`
          : `. Or add ~${formatMoney(plan.extraIncomeMonthlyToBreakeven)}/mo earned income. No lifestyle tips until cashflow ≥ $0.`),
      monthlyImpact: plan.extraIncomeMonthlyWithGoals,
    });
  } else {
    findings.push({
      id: "cashflow-ok",
      severity: "ok",
      title: "Income covers protected obligations",
      detail: `${formatMoney(flow.liquidMonthly)} in − ${formatMoney(flow.netObligations)} bills = ${formatMoney(flow.cashflow)}/mo surplus before lifestyle.`,
    });
  }

  // Cash runway
  if (appState.user.checkingBalance < netObl) {
    findings.push({
      id: "checking-short",
      severity: "critical",
      title: "Checking can’t cover this month’s net bills",
      detail: `${formatMoney(appState.user.checkingBalance)} on hand vs ${formatMoney(netObl)} due after aid.`,
    });
    recommendations.push({
      id: "rec-bills",
      title: "Ring-fence next paycheck for protected bills first",
      detail:
        "Before any DoorDash or rideshare, auto-move net obligations into a bills hold on payday.",
    });
  } else {
    findings.push({
      id: "checking-ok",
      severity: "ok",
      title: "Checking covers net obligations",
      detail: `${formatMoney(appState.user.checkingBalance)} vs ${formatMoney(netObl)} bills after aid.`,
    });
  }

  // Burn vs income
  if (monthlyBurn > recurring * 0.55) {
    findings.push({
      id: "burn-high",
      severity: "critical",
      title: "Discretionary burn is eating liquid income",
      detail: `~${formatMoney(burn)}/day (~${formatMoney(monthlyBurn)}/mo) vs ~${formatMoney(recurring)}/mo recurring liquid.`,
    });
    recommendations.push({
      id: "rec-delivery",
      title: "Cap delivery + rideshare at 3 combined trips / week",
      detail:
        "Swap two DoorDash nights for dining hall / groceries. Typical save $80–120/mo.",
      monthlyImpact: 100,
    });
    recommendations.push({
      id: "rec-rides",
      title: "Default to campus shuttle / walk after 10pm",
      detail: "Late-night Ubers stack fast — keep a $20 rideshare ceiling per week.",
      monthlyImpact: 60,
    });
  } else if (monthlyBurn > recurring * 0.35) {
    findings.push({
      id: "burn-warm",
      severity: "warn",
      title: "Lifestyle spend is elevated",
      detail: `~${formatMoney(monthlyBurn)}/mo discretionary vs ${formatMoney(recurring)} liquid in.`,
    });
  } else {
    findings.push({
      id: "burn-ok",
      severity: "ok",
      title: "Discretionary pace looks sustainable",
      detail: `~${formatMoney(burn)}/day against ${formatMoney(recurring)}/mo liquid income.`,
    });
  }

  // Auto-save
  if (appState.user.dailyContributionRate <= 0) {
    findings.push({
      id: "save-zero",
      severity: "critical",
      title: "No auto-save running",
      detail: "Goals only move if money is reserved on purpose.",
    });
    recommendations.push({
      id: "rec-autosave",
      title: "Turn on $2/day auto-save (~$60/mo)",
      detail:
        "Small enough to survive a tough week; enough to make a goal date real.",
      monthlyImpact: 60,
    });
  } else if (appState.user.dailyContributionRate < 2) {
    findings.push({
      id: "save-low",
      severity: "warn",
      title: "Auto-save is light",
      detail: `$${appState.user.dailyContributionRate}/day (~${formatMoney(monthlyAuto)}/mo).`,
    });
  } else {
    findings.push({
      id: "save-ok",
      severity: "ok",
      title: "Auto-save is active",
      detail: `$${appState.user.dailyContributionRate}/day toward goals.`,
    });
  }

  // Risk
  if (appState.user.riskReserveBalance < appState.risk.monthlyBudget * 0.5) {
    findings.push({
      id: "risk-thin",
      severity: "warn",
      title: "Risk cushion is thin",
      detail: `${formatMoney(appState.user.riskReserveBalance)} vs ${formatMoney(appState.risk.monthlyBudget)}/mo suggested (${appState.risk.level}).`,
    });
    recommendations.push({
      id: "rec-risk",
      title: "Rebuild risk cushion before new lifestyle spend",
      detail: `Park the next ${formatMoney(Math.min(80, appState.risk.monthlyBudget))} of quiet-month leftovers into risk — not Venmo.`,
    });
  } else {
    findings.push({
      id: "risk-ok",
      severity: "ok",
      title: "Risk cushion is in range",
      detail: `${formatMoney(appState.user.riskReserveBalance)} earmarked · ${appState.risk.level}.`,
    });
  }

  // Goals feasibility
  const activeGoals = appState.goals.filter((x) => !x.purchased);
  for (const g of activeGoals) {
    const adv = assessGoalFeasibility({
      targetPrice: g.targetPrice,
      fundedAmount: g.fundedAmount,
      optionalTargetDate: g.optionalTargetDate,
      demoToday: appState.demoToday,
      dailyContributionRate: Math.max(1, appState.user.dailyContributionRate),
      user: appState.user,
      risk: appState.risk,
      goals: appState.goals.filter((x) => x.id !== g.id),
      prioritize: g.priority === 1,
      goalName: g.name,
    });
    if (adv.level === "unreachable" || adv.level === "stretch") {
      findings.push({
        id: `goal-${g.id}`,
        severity: adv.level === "unreachable" ? "critical" : "warn",
        title: `${g.name}: ${adv.headline}`,
        detail: adv.detail,
      });
      recommendations.push({
        id: `rec-goal-${g.id}`,
        title: `Reset ${g.name} timeline or target`,
        detail:
          adv.level === "unreachable"
            ? "Pick a later date or a cheaper setup — today’s pace cannot fund this without gutting bills."
            : "Keep the goal, but extend the date and pair it with real auto-save.",
      });
    } else {
      findings.push({
        id: `goal-ok-${g.id}`,
        severity: "ok",
        title: `${g.name}: ${adv.headline}`,
        detail: adv.detail,
      });
    }
  }

  // Multi-goal portfolio — rearrange before cutting lifestyle
  if (activeGoals.length >= 2) {
    const ranked = [...activeGoals].sort((a, b) => a.priority - b.priority);
    const top = ranked[0];
    const donors = ranked.filter(
      (g) => g.priority > top.priority && g.fundedAmount > 25
    );
    const carLoan = appState.user.obligations.find((o) => o.kind === "car_loan");
    findings.push({
      id: "portfolio",
      severity: donors.length > 0 || snap.freeToSpend < 500 ? "warn" : "info",
      title: `${activeGoals.length} goals competing for the same dollars`,
      detail: carLoan
        ? `${formatMoney(carLoan.amount)}/mo car note is already protected. ${top.name} (#1) wants by ${top.optionalTargetDate ?? "soon"}; lower-ranked reserves can move without new income.`
        : `Priority #1 is ${top.name}. Free-to-spend is ${formatMoney(snap.freeToSpend)} after earmarks — portfolio order matters more than tip-cutting.`,
    });
    if (donors.length > 0) {
      const donor = donors.sort((a, b) => b.fundedAmount - a.fundedAmount)[0];
      recommendations.unshift({
        id: "rec-portfolio-realloc",
        title: `Rearrange reserves toward ${top.name}`,
        detail: `${donor.name} still holds ${formatMoney(donor.fundedAmount)} at priority #${donor.priority}. Siphon a slice into ${top.name} so the want-by date moves — same cash, better fit.`,
      });
    }
    if (carLoan) {
      recommendations.unshift({
        id: "rec-car-loan-protect",
        title: "Keep the car note ahead of every goal transfer",
        detail: `${formatMoney(carLoan.amount)}/mo stays in protected obligations. Catch-up goal dollars never outrank the loan payment itself.`,
        monthlyImpact: carLoan.amount,
      });
    }
  }

  if (bp.arc === "course_correct") {
    recommendations.push({
      id: "rec-loan",
      title: "Treat remaining loan refund as rent money, not fun money",
      detail:
        "Semester refunds disappear in a weekend of delivery + tickets. Split refund on arrival: bills / risk / goals.",
    });
  }

  // Grade
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  let grade: FinancialDiagnostic["grade"] = "A";
  if (criticals >= 3 || (criticals >= 2 && snap.freeToSpend < 50)) grade = "F";
  else if (criticals >= 2) grade = "D";
  else if (criticals >= 1 || warns >= 3) grade = "C";
  else if (warns >= 1) grade = "B";

  const headline =
    bp.arc === "healthy" && activeGoals.length >= 2
      ? `${bp.name} looks fine on paper — the portfolio is the squeeze`
      : grade === "A" || grade === "B"
        ? `${bp.name} is in decent shape — Closer can tighten the path`
        : `${bp.name} needs a course correction before new goals`;

  const summary =
    bp.arc === "course_correct"
      ? `${bp.name}'s books are net-negative: ${formatMoney(flow.liquidMonthly)}/mo liquid income vs ${formatMoney(netObl)} protected bills (${formatMoney(flow.cashflow)}/mo), plus ~${formatMoney(burn)}/day lifestyle. Free-to-spend stock is ${formatMoney(snap.freeToSpend)} — not a cashflow surplus.`
      : activeGoals.length >= 2
        ? `${bp.name} has ${activeGoals.length} active goals and ${formatMoney(snap.freeToSpend)} free after earmarks${
            appState.user.obligations.some((o) => o.kind === "car_loan")
              ? " (car loan already protected)"
              : ""
          }. Monthly cashflow ${formatMoney(flow.cashflow)}. Closer’s job is rearrange the portfolio — not invent frugality theatre.`
        : `${bp.name}'s books look workable: cashflow ${formatMoney(flow.cashflow)}/mo, ${formatMoney(snap.freeToSpend)} free stock, freedom ${snap.financialFreedomScore}/100. Closer’s job is to protect that and pull goals earlier.`;

  // Dedupe recs, cap 6
  const seen = new Set<string>();
  const recs = recommendations.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).slice(0, 6);

  return {
    personaId: bp.id,
    name: bp.name,
    arc: bp.arc,
    headline,
    summary,
    grade,
    freedomScore: snap.financialFreedomScore,
    freeToSpend: snap.freeToSpend,
    netObligations: netObl,
    liquidMonthly: income.liquidMonthly,
    monthlyCashflow: flow.cashflow,
    burnDaily: burn,
    findings,
    recommendations: recs,
    appState,
  };
}
