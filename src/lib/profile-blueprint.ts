/**
 * Profile blueprint — everything Closer needs to spin up a student demo.
 *
 * Use this as the intake contract for login / custom profiles.
 * `buildAppStateFromBlueprint` turns a filled blueprint into AppState.
 */

import type {
  GoalCategory,
  IncomeStream,
  ObligationKind,
  TxCategory,
} from "./types";

/** Documented intake fields — shown on the login form & kept as the source of truth */
export const PROFILE_INTAKE_FIELDS = [
  {
    group: "Identity",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "age", label: "Age", required: true },
      { key: "collegeYear", label: "College year (1–4)", required: true },
      { key: "demoToday", label: "Demo “today” date", required: true },
      {
        key: "lifeSituation",
        label: "Life situation / story (housing, habits, pressure)",
        required: false,
      },
    ],
  },
  {
    group: "Cash position",
    fields: [
      { key: "checkingBalance", label: "Checking balance", required: true },
      { key: "goalReserveBalance", label: "Goal reserve total", required: true },
      { key: "riskReserveBalance", label: "Risk cushion balance", required: true },
      {
        key: "dailyContributionRate",
        label: "Daily auto-save toward goals ($/day)",
        required: true,
      },
      {
        key: "typicalDiscretionaryPerDay",
        label: "Typical discretionary spend ($/day)",
        required: true,
      },
    ],
  },
  {
    group: "Income",
    fields: [
      {
        key: "incomeStreams[]",
        label:
          "Streams: label, amount, cadence (biweekly/monthly/semester), lands in checking?, source, note",
        required: true,
      },
      { key: "nextPaycheckAmount", label: "Next biweekly paycheck $", required: true },
      { key: "nextPaycheckDate", label: "Next paycheck date", required: true },
    ],
  },
  {
    group: "Protected obligations",
    fields: [
      {
        key: "useCollegePhaseDefaults",
        label: "Use dorm/apartment defaults for college year?",
        required: false,
      },
      {
        key: "obligationOverrides[]",
        label: "Optional bill overrides: kind, label, monthly amount",
        required: false,
      },
    ],
  },
  {
    group: "Goals",
    fields: [
      {
        key: "goals[]",
        label:
          "name, target price, funded so far, category, optional deadline, priority",
        required: true,
      },
    ],
  },
  {
    group: "Spending & risk",
    fields: [
      {
        key: "spendPatterns[]",
        label:
          "Habit tags that generate ledger evidence (delivery, rideshare, nightlife, BNPL, etc.)",
        required: false,
      },
      {
        key: "recentShocks[]",
        label: "Unforeseen hits: label, amount, category",
        required: false,
      },
      {
        key: "riskMonthlyBudget",
        label: "Suggested monthly risk cushion $",
        required: false,
      },
    ],
  },
] as const;

export type SpendPatternId =
  | "heavy_delivery"
  | "rideshare_habit"
  | "nightlife"
  | "gaming_micro"
  | "bnpl_shopping"
  | "coffee_stack"
  | "subscription_creep";

export interface BlueprintGoal {
  id?: string;
  name: string;
  targetPrice: number;
  fundedAmount: number;
  category: GoalCategory;
  optionalTargetDate?: string;
  priority: number;
  /** Fixed deadline — do not slide in portfolio tips */
  timeSensitive?: boolean;
}

export interface BlueprintShock {
  label: string;
  amount: number;
  category: TxCategory;
  daysAgo?: number;
}

export interface BlueprintObligationOverride {
  kind: ObligationKind;
  label: string;
  amount: number;
}

/**
 * Serializable student profile used by login intake + personas.
 */
export interface ProfileBlueprint {
  id: string;
  /** Short card copy on the login screen */
  tagline: string;
  /** Longer story for diagnostic */
  lifeSituation: string;
  /** healthy | course_correct — drives diagnostic tone */
  arc: "healthy" | "course_correct";
  name: string;
  age: number;
  collegeYear: 1 | 2 | 3 | 4;
  demoToday: string;
  /** If true, open Maya’s baked sophomore seed instead of rebuilding from scratch */
  useMayaSophomoreSeed?: boolean;
  checkingBalance: number;
  goalReserveBalance: number;
  riskReserveBalance: number;
  dailyContributionRate: number;
  typicalDiscretionaryPerDay: number;
  incomeStreams: IncomeStream[];
  nextPaycheckAmount: number;
  nextPaycheckDate: string;
  useCollegePhaseDefaults: boolean;
  obligationOverrides?: BlueprintObligationOverride[];
  goals: BlueprintGoal[];
  spendPatterns: SpendPatternId[];
  recentShocks: BlueprintShock[];
  riskMonthlyBudget?: number;
  connectedSources?: string[];
}
