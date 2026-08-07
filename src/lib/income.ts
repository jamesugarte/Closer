/**
 * Income helpers — monthly expected cash vs bill credits vs semester refunds.
 */

import type { IncomeStream } from "./types";

/** Rough monthly equivalent for interview / UI math */
export function monthlyFromStream(stream: IncomeStream): number {
  switch (stream.cadence) {
    case "biweekly":
      // 26 pays / 12 months ≈ 2.17; use 2.17 for honesty
      return Math.round(stream.amount * (26 / 12));
    case "monthly":
      return stream.amount;
    case "semester":
      // Two disbursements over ~9 academic months
      return Math.round(stream.amount / 4.5);
    case "one_time":
      return 0;
    default:
      return stream.amount;
  }
}

export function cadenceLabel(cadence: IncomeStream["cadence"]): string {
  switch (cadence) {
    case "biweekly":
      return "every 2 weeks";
    case "monthly":
      return "monthly";
    case "semester":
      return "per semester";
    case "one_time":
      return "one-time";
    default:
      return cadence;
  }
}

export function incomeSummary(streams: IncomeStream[]): {
  /** Cash that hits checking (job, family, loan refunds averaged) */
  liquidMonthly: number;
  /** Bursar aid — reduces bills only; never disposable income */
  billCreditMonthly: number;
} {
  let liquidMonthly = 0;
  let billCreditMonthly = 0;
  for (const s of streams) {
    const m = monthlyFromStream(s);
    if (s.landsInChecking) liquidMonthly += m;
    else billCreditMonthly += m;
  }
  return {
    liquidMonthly,
    billCreditMonthly,
  };
}

/**
 * Recurring liquid that hits checking every simulated month
 * (excludes semester lump sums — those disburse Aug/Jan).
 */
export function recurringLiquidDeposit(streams: IncomeStream[]): number {
  let total = 0;
  for (const s of streams) {
    if (!s.landsInChecking) continue;
    if (s.cadence === "semester" || s.cadence === "one_time") continue;
    total += monthlyFromStream(s);
  }
  return total;
}

/** Bursar / grant credits that reduce what checking must cover */
export function billCreditDeposit(streams: IncomeStream[]): number {
  return incomeSummary(streams).billCreditMonthly;
}

/**
 * Federal loan / aid refunds typically post late Aug (fall) and early Jan (spring).
 * Returns streams that should fully deposit this calendar month.
 */
export function semesterDisbursementsDue(
  streams: IncomeStream[],
  dateISO: string
): IncomeStream[] {
  const month = Number(dateISO.slice(5, 7));
  // Aug = fall, Jan = spring
  if (month !== 8 && month !== 1) return [];
  return streams.filter(
    (s) => s.landsInChecking && s.cadence === "semester" && s.amount > 0
  );
}

export function sumStreamAmounts(streams: IncomeStream[]): number {
  return streams.reduce((sum, s) => sum + s.amount, 0);
}

/** What checking must actually cover after bursar / grant credits */
export function netProtectedObligations(
  grossObligations: number,
  streams: IncomeStream[]
): number {
  return Math.max(0, grossObligations - billCreditDeposit(streams));
}

/**
 * Monthly flow: liquid income − net protected bills.
 * Can be negative (Jordan) — free-to-spend is a separate stock measure
 * and must not hide this hole by flooring at $0.
 */
export function monthlyCashflow(
  streams: IncomeStream[],
  grossObligations: number
): {
  liquidMonthly: number;
  billCreditMonthly: number;
  grossObligations: number;
  netObligations: number;
  /** liquidMonthly − netObligations (signed) */
  cashflow: number;
} {
  const { liquidMonthly, billCreditMonthly } = incomeSummary(streams);
  const netObligations = netProtectedObligations(grossObligations, streams);
  return {
    liquidMonthly,
    billCreditMonthly,
    grossObligations: Math.max(0, grossObligations),
    netObligations,
    cashflow: liquidMonthly - netObligations,
  };
}
