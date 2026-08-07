/**
 * Maya’s college life arc — freshman → senior housing, food, and one-time jumps.
 *
 * Costs are calibrated to a mid-tier U.S. public / mid-size college town
 * (not NYC/SF sticker shock, not the cheapest rural market). Sources used
 * for rationale copy: Education Data Initiative room & board (~$8.2k dorm /
 * ~$6.2k meal plan AY averages), ELFI meal-plan study (~$5.1–5.7k/yr),
 * NCES/IPEDS living-cost tables, and off-campus roommate rent surveys
 * (~$450–$900/person in typical college towns with 3–4 roommates).
 *
 * Monthly figures are calendar-month protected outflows for the demo clock.
 * Lifestyle creep: rates rise each year; junior adds furniture + cooking;
 * senior steps up rent/food as preferences expand.
 */

import type { Obligation, ObligationKind, Recommendation } from "./types";
import { daysFromSavings } from "./calculations";
import { addMonths } from "./utils";

export type CollegeYear = 1 | 2 | 3 | 4;

export type HousingType = "dorm" | "apartment";

export interface CollegePhase {
  year: CollegeYear;
  label: "Freshman" | "Sophomore" | "Junior" | "Senior";
  housing: HousingType;
  housingLabel: string;
  mealPlan: boolean;
  furnitureNeeded: boolean;
  /** Typical monthly protected obligations for this phase */
  monthlyObligations: Omit<Obligation, "dueDate">[];
  /** Why these numbers — shown in the College Arc detail */
  rationale: string;
  /** Short lifestyle-creep note vs prior year */
  creepNote?: string;
}

/**
 * Freshman — double dorm + required meal plan.
 * ~$720×12 ≈ $8.6k housing (near national avg dorm ~$8.2k).
 * ~$520×12 ≈ $6.2k meals (near national avg board / ELFI public plans).
 */
const FRESHMAN: CollegePhase = {
  year: 1,
  label: "Freshman",
  housing: "dorm",
  housingLabel: "Residence hall double (furniture included)",
  mealPlan: true,
  furnitureNeeded: false,
  rationale:
    "National avg dorm room is ~$8.2k/yr; meal plans at public schools average ~$5.1–5.7k. A double + mid meal tier tracks a mid-size public campus. Federal Direct Loans are deferred while enrolled — semester refunds help with living costs, not monthly repayment.",
  monthlyObligations: [
    {
      id: "obl-housing",
      kind: "rent",
      label: "Dorm housing (double room)",
      amount: 720,
    },
    {
      id: "obl-meal",
      kind: "meal_plan",
      label: "Campus meal plan (required)",
      amount: 520,
    },
    {
      id: "obl-tuition",
      kind: "tuition",
      label: "Tuition payment plan",
      amount: 200,
    },
    {
      id: "obl-books",
      kind: "other",
      label: "Books / course fees (avg)",
      amount: 45,
    },
  ],
};

const SOPHOMORE: CollegePhase = {
  ...FRESHMAN,
  year: 2,
  label: "Sophomore",
  housingLabel: "Residence hall double (sophomore rate)",
  rationale:
    "Same dorm + meal structure, with the usual 3–5% campus housing/dining bump. Still furniture-included — lifestyle creep is mostly price, not square footage.",
  creepNote: "+~4% vs freshman — published room & board increases, not a lifestyle upgrade yet.",
  monthlyObligations: FRESHMAN.monthlyObligations.map((o) =>
    o.id === "obl-housing"
      ? { ...o, amount: 750, label: "Dorm housing (sophomore rate)" }
      : o.id === "obl-meal"
        ? { ...o, amount: 545 }
        : o.id === "obl-tuition"
          ? { ...o, amount: 210 }
          : o.id === "obl-books"
            ? { ...o, amount: 50 }
            : { ...o }
  ),
};

/**
 * Junior — off-campus 4-person apt in a mid college town.
 * Rent ~$700/person is mid of the common $450–$900 roommate band.
 * Groceries ~$330 replace a $520 meal plan (saves on paper; lifestyle
 * spend often creeps back via delivery — modeled in sim living spend).
 */
const JUNIOR: CollegePhase = {
  year: 3,
  label: "Junior",
  housing: "apartment",
  housingLabel: "Off-campus apartment · 3 roommates",
  mealPlan: false,
  furnitureNeeded: true,
  rationale:
    "Shared 4BR student apartments in mid college towns often run $450–$900/person before utils. $700 + $120 utils is a realistic mid. Cooking replaces ~$5–6k meal plans; groceries ~$300–350/mo is typical when not ultra-frugal.",
  creepNote:
    "Biggest jump: lease + furniture + cooking. Annual need rises even if monthly food drops vs meal plan.",
  monthlyObligations: [
    {
      id: "obl-housing",
      kind: "rent",
      label: "Rent share (4-person apt)",
      amount: 700,
    },
    {
      id: "obl-utilities",
      kind: "utilities",
      label: "Utilities + internet share",
      amount: 120,
    },
    {
      id: "obl-groceries",
      kind: "groceries",
      label: "Groceries (replaces meal plan)",
      amount: 330,
    },
    {
      id: "obl-tuition",
      kind: "tuition",
      label: "Tuition payment plan",
      amount: 210,
    },
    {
      id: "obl-books",
      kind: "other",
      label: "Books / course fees (avg)",
      amount: 55,
    },
  ],
};

const SENIOR: CollegePhase = {
  ...JUNIOR,
  year: 4,
  label: "Senior",
  housingLabel: "Off-campus house · roommates",
  furnitureNeeded: false,
  rationale:
    "Senior housing often means a slightly nicer house or private room premium. Food spend creeps with more takeout/social cooking. Furniture is sunk cost from junior year.",
  creepNote:
    "Lifestyle creep: nicer place + higher food — classic last-year pattern. Federal loans stay deferred while enrolled.",
  monthlyObligations: JUNIOR.monthlyObligations.map((o) =>
    o.id === "obl-housing"
      ? { ...o, amount: 780, label: "Rent share (senior house)" }
      : o.id === "obl-utilities"
        ? { ...o, amount: 135 }
        : o.id === "obl-groceries"
          ? { ...o, amount: 360 }
          : o.id === "obl-books"
            ? { ...o, amount: 60 }
            : o.id === "obl-tuition"
              ? { ...o, amount: 220 }
              : { ...o }
  ),
};

const PHASES: Record<CollegeYear, CollegePhase> = {
  1: FRESHMAN,
  2: SOPHOMORE,
  3: JUNIOR,
  4: SENIOR,
};

export function collegePhase(year: CollegeYear): CollegePhase {
  return PHASES[year];
}

export function collegeYearLabel(year: CollegeYear): string {
  return collegePhase(year).label;
}

/** Academic year advances every 12 simulated months from demo start. */
export function collegeYearFromMonthsAdvanced(monthsAdvanced: number): CollegeYear {
  const y = Math.floor(monthsAdvanced / 12) + 1;
  return Math.min(4, Math.max(1, y)) as CollegeYear;
}

export function monthsIntoCurrentYear(monthsAdvanced: number): number {
  return monthsAdvanced % 12;
}

export function buildObligationsForPhase(
  phase: CollegePhase,
  dueDate: string
): Obligation[] {
  return phase.monthlyObligations.map((o) => ({
    ...o,
    dueDate,
  }));
}

export function obligationsTotalFromList(obligations: Obligation[]): number {
  return obligations.reduce((s, o) => s + o.amount, 0);
}

/** One-time junior move — bed/desk/basics via Marketplace still adds up */
export const FURNITURE_ONE_TIME = 900;

export const COST_DATA_SOURCES =
  "Benchmarked to Education Data / NCES room & board averages, ELFI meal-plan study, and mid college-town roommate rent surveys — not NYC/SF, not the cheapest rural markets.";

export interface YearCostProjection {
  year: CollegeYear;
  label: string;
  housing: HousingType;
  housingLabel: string;
  mealPlan: boolean;
  monthly: number;
  /** 12 × monthly protected obligations */
  annualRecurring: number;
  /** Furniture / move-in spike (junior only in this demo) */
  oneTime: number;
  /** What Maya must cover that academic year */
  projectedNeeded: number;
  /** Rough category splits for the selected-year detail */
  categories: { key: string; label: string; monthly: number }[];
  rationale: string;
  creepNote?: string;
}

function categorizeMonthly(phase: CollegePhase): YearCostProjection["categories"] {
  let housing = 0;
  let food = 0;
  let school = 0;
  let auto = 0;
  for (const o of phase.monthlyObligations) {
    if (o.kind === "rent" || o.kind === "utilities") housing += o.amount;
    else if (o.kind === "meal_plan" || o.kind === "groceries") food += o.amount;
    else if (o.kind === "car_loan") auto += o.amount;
    else school += o.amount;
  }
  return [
    { key: "housing", label: "Housing + utils", monthly: housing },
    { key: "food", label: phase.mealPlan ? "Meal plan" : "Groceries", monthly: food },
    { key: "auto", label: "Car loan", monthly: auto },
    { key: "school", label: "Tuition + fees", monthly: school },
  ].filter((c) => c.monthly > 0);
}

/** Full frosh→senior cost arc for the interactive chart */
export function collegeCostProjections(): YearCostProjection[] {
  return ([1, 2, 3, 4] as CollegeYear[]).map((year) => {
    const phase = collegePhase(year);
    const monthly = phase.monthlyObligations.reduce((s, o) => s + o.amount, 0);
    const annualRecurring = monthly * 12;
    const oneTime = year === 3 && phase.furnitureNeeded ? FURNITURE_ONE_TIME : 0;
    return {
      year,
      label: phase.label,
      housing: phase.housing,
      housingLabel: phase.housingLabel,
      mealPlan: phase.mealPlan,
      monthly,
      annualRecurring,
      oneTime,
      projectedNeeded: annualRecurring + oneTime,
      categories: categorizeMonthly(phase),
      rationale: phase.rationale,
      creepNote: phase.creepNote,
    };
  });
}

export function fourYearTotalNeeded(): number {
  return collegeCostProjections().reduce((s, y) => s + y.projectedNeeded, 0);
}


/**
 * Detect freshman→sophomore→junior→senior crossings after a month advance.
 * Returns the new year when crossed, else null.
 */
export function yearTransition(
  monthsBefore: number,
  monthsAfter: number
): CollegeYear | null {
  const before = collegeYearFromMonthsAdvanced(monthsBefore);
  const after = collegeYearFromMonthsAdvanced(monthsAfter);
  if (after > before) return after;
  return null;
}

/** Facebook Marketplace / thrift furniture tips when moving to apartment. */
export function buildFurnitureRecommendations(input: {
  goalId: string;
  goalName: string;
  dailyRate: number;
  makeId: () => string;
}): Recommendation[] {
  const tips = [
    {
      tipKey: "furn-marketplace-desk",
      description:
        "Grab a desk + chair bundle on Facebook Marketplace instead of buying new dorm-store furniture.",
      savings: 120,
      disruption: 2,
      evidence: "Move-in: Marketplace desks often $40–80 vs $180+ new",
    },
    {
      tipKey: "furn-marketplace-couch",
      description:
        "Split a used couch with roommates via Marketplace / OfferUp — skip the big-box financing.",
      savings: 90,
      disruption: 2,
      evidence:
        "Roommate furniture pools cut per-person cost sharply on a ~$900 starter kit",
    },
    {
      tipKey: "furn-thrift-basics",
      description:
        "Thrift a lamp + bedding basics; skip the coordinated dorm-brand starter kit.",
      savings: 55,
      disruption: 1,
      evidence: "One-time move costs stack if every item is bought retail",
    },
  ];

  return tips.map((tip) => {
    const days = daysFromSavings(tip.savings, input.dailyRate);
    return {
      id: input.makeId(),
      tipKey: tip.tipKey,
      repeatable: false,
      kind: "spend_pattern" as const,
      title: `Move ${input.goalName} ${days} days closer`,
      description: tip.description,
      savingsAmount: tip.savings,
      estimatedDaysGained: days,
      disruptionScore: tip.disruption,
      category: "housing",
      lifestyleImpact: tip.disruption <= 1 ? ("Low" as const) : ("Medium" as const),
      status: "pending" as const,
      goalId: input.goalId,
      evidenceSummary: tip.evidence,
    };
  });
}

export function furnitureGoalDefaults(demoToday: string): {
  name: string;
  targetPrice: number;
  category: "School";
  optionalTargetDate: string;
} {
  return {
    name: "Apartment starter furniture",
    targetPrice: FURNITURE_ONE_TIME,
    category: "School",
    optionalTargetDate: addMonths(demoToday, 1),
  };
}

export function isObligationKind(kind: string): kind is ObligationKind {
  return [
    "rent",
    "tuition",
    "student_loan",
    "car_loan",
    "meal_plan",
    "groceries",
    "utilities",
    "other",
  ].includes(kind);
}

/** Maya’s used-car note — monthly payment that survives phase rebuilds. */
export const MAYA_CAR_LOAN: Omit<Obligation, "dueDate"> = {
  id: "obl-car-loan",
  kind: "car_loan",
  label: "Car loan payment",
  amount: 345,
};

/**
 * Phase defaults wipe custom rows each month. Re-attach installment loans
 * (car note, etc.) so financed purchases stay in protected obligations.
 */
export function mergePersistentLoanObligations(
  phaseObligations: Obligation[],
  priorObligations: Obligation[] | undefined,
  dueDate: string
): Obligation[] {
  const loans = (priorObligations ?? []).filter((o) => o.kind === "car_loan");
  if (loans.length === 0) return phaseObligations;
  const without = phaseObligations.filter((o) => o.kind !== "car_loan");
  const merged = loans.map((o) => ({
    ...o,
    dueDate,
  }));
  // Dedupe by id — prefer prior amount/label
  const byId = new Map<string, Obligation>();
  for (const o of [...without, ...merged]) byId.set(o.id, o);
  return [...byId.values()];
}

export function withCarLoanObligation(
  obligations: Obligation[],
  dueDate: string,
  loan: Omit<Obligation, "dueDate"> = MAYA_CAR_LOAN
): Obligation[] {
  const rest = obligations.filter((o) => o.id !== loan.id && o.kind !== "car_loan");
  return [...rest, { ...loan, dueDate }];
}
