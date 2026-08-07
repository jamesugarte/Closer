export type GoalCategory =
  | "Technology"
  | "Travel"
  | "Fashion"
  | "Experiences"
  | "School"
  | "Other";

export type RecommendationStatus = "pending" | "accepted" | "rejected" | "superseded";

export type RecommendationKind =
  | "spend_pattern"
  | "risk_avoidance"
  | "good_job_bonus"
  | "pace"
  | "reallocation"
  | "surplus_allocation"
  | "portfolio"
  /** Structural income/loan bridge when cashflow is negative */
  | "income_bridge"
  /** Earn more: shifts, second job, tutoring */
  | "income_growth";

export type ActivityKind =
  | "paycheck"
  | "venmo"
  | "contribution"
  | "recommendation_accepted"
  | "recommendation_rejected"
  | "date_change"
  | "sale_alert"
  | "purchase"
  | "goal_created"
  | "unforeseen"
  | "risk_rollover"
  | "good_job_bonus"
  | "time_advance"
  | "reallocation"
  | "living_spend";

export type TxSource =
  | "Student Checking"
  | "Venmo"
  | "Apple Cash"
  | "Campus Card";

export type TxCategory =
  | "transport"
  | "food"
  | "coffee"
  | "social"
  | "education"
  | "shopping"
  | "health"
  | "auto"
  | "subscriptions"
  | "income"
  | "transfer"
  | "other";

/** Mock ledger row — Closer's "observed" spending for Maya */
export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: TxCategory;
  amount: number; // negative = spend, positive = inflow
  source: TxSource;
  /** Unforeseen / shock spending vs normal discretionary */
  unforeseen: boolean;
  note?: string;
  /** Links tips back to real-looking pattern evidence */
  patternKey?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  savingsAmount: number;
  estimatedDaysGained: number;
  /** 1 = barely noticeable, 5 = high friction */
  disruptionScore: number;
  category: string;
  lifestyleImpact: "Low" | "Medium" | "High";
  status: RecommendationStatus;
  goalId: string;
  kind: RecommendationKind;
  /** Donor goal when rearranging reserves (reallocation tips) */
  fromGoalId?: string;
  /** Evidence from Maya's ledger */
  evidenceTransactionIds?: string[];
  evidenceSummary?: string;
  /**
   * Stable tip identity (e.g. "outdoor-club-rental") so we never re-offer
   * one-shot tips after accept/reject, even if the row id changes.
   */
  tipKey?: string;
  /**
   * Habit tips (coffee, shuttle) may return next month.
   * One-shots (gear rental, cancel Canva) never regenerate after resolved.
   */
  repeatable?: boolean;
  /** Portfolio tip: on accept, set this want-by date on goalId */
  applyOptionalTargetDate?: string;
  /** Portfolio tip: on accept, raise daily auto-save to this rate */
  applyDailyContributionRate?: number;
  /** Portfolio tip: on accept, set this priority on goalId (others renumber) */
  applyPriority?: number;
  /** Portfolio tip: on accept, lower the goal’s target price */
  applyTargetPrice?: number;
  /** Goal-health tip: pause/cancel remaining (remove from active portfolio) */
  applyCancelGoal?: boolean;
  /** Income-bridge: total loan / aid package */
  applyLoanAmount?: number;
  /** Income-bridge: portion earmarked for protected bills (not free-to-spend) */
  applyLoanForBills?: number;
  /** Income-bridge: portion that may land in checking for active goals */
  applyLoanForGoals?: number;
  /** Income-bridge: monthly bill credit (landsInChecking: false) */
  applyLoanMonthlyBillCredit?: number;
  /** @deprecated Prefer applyLoanMonthlyBillCredit — kept for older tips */
  applyLoanMonthlyEquivalent?: number;
  /** Income-growth: add or replace this stream */
  applyIncomeStream?: IncomeStream;
  /** Income-growth: bump existing stream id */
  applyIncomeBumpId?: string;
  applyIncomeBumpBy?: number;
}

export interface GoalContribution {
  id: string;
  label: string;
  amount: number;
  date: string;
}

export interface Goal {
  id: string;
  name: string;
  targetPrice: number;
  /** Original list price before any sale simulation */
  originalTargetPrice: number;
  fundedAmount: number;
  category: GoalCategory;
  /** ISO date YYYY-MM-DD — current projection */
  projectedPurchaseDate: string;
  /** First projection when the goal was created (for “days earlier” messaging) */
  originalProjectedDate: string;
  optionalTargetDate?: string;
  completed: boolean;
  purchased: boolean;
  saleApplied: boolean;
  contributions: GoalContribution[];
  createdAt: string;
  /**
   * Maya's preference ranking — 1 = highest.
   * New goals can take #1; auto-save and reallocation tips follow this order.
   */
  priority: number;
  /**
   * When true, the want-by date is fixed (spring break, tickets).
   * Portfolio tips must not slide the date or starve it for a flexible goal.
   * Car loans belong in protected obligations — not here.
   * When omitted, inferred from name/category.
   */
  timeSensitive?: boolean;
}

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  amount?: number;
  date: string;
  timestamp: number;
}

/** Required bills Closer protects before any discretionary or goal moves */
export type ObligationKind =
  | "rent"
  | "tuition"
  | "student_loan"
  | "car_loan"
  | "meal_plan"
  | "groceries"
  | "utilities"
  | "other";

export interface Obligation {
  id: string;
  kind: ObligationKind;
  label: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
}

/**
 * Risk buffer — earmarked like goals, never auto-spent.
 * Built from Maya's history of unforeseen shocks (tire, textbooks, etc.).
 */
export interface RiskState {
  /** Typical monthly cushion suggested from history */
  monthlyBudget: number;
  /** Unused risk $ rolled from prior quiet month(s) */
  rolledOver: number;
  /** Unforeseen spend already used this demo month */
  spentThisMonth: number;
  /** Level label for interview storytelling */
  level: "Low" | "Moderate" | "Elevated";
  summary: string;
  topShockCategories: string[];
  /** Pending “good job” offer — AI recommends only; Maya must accept */
  pendingGoodJobBonus: number | null;
  lastQuietMonthBonusOffered: boolean;
}

export interface UserProfile {
  name: string;
  age: number;
  checkingBalance: number;
  goalReserveBalance: number;
  /** Risk cushion balance (part of earmarks, not free-to-spend) */
  riskReserveBalance: number;
  obligations: Obligation[];
  upcomingObligations: number;
  nextPaycheckAmount: number;
  nextPaycheckDate: string;
  typicalDiscretionaryPerDay: number;
  dailyContributionRate: number;
  connectedSources: string[];
  /** 1 freshman … 4 senior — drives housing/food obligations */
  collegeYear: 1 | 2 | 3 | 4;
  /** Named income streams that fund checking / bills */
  incomeStreams: IncomeStream[];
}

/** Where Maya’s money comes from — powers the Income accordion */
export interface IncomeStream {
  id: string;
  label: string;
  /** Typical amount per cadence */
  amount: number;
  cadence: "biweekly" | "monthly" | "semester" | "one_time";
  source: string;
  /** If true, already reflected in checking / next paycheck */
  landsInChecking: boolean;
  note?: string;
}

/** Point-in-time balance sheet for the freedom tracker */
export interface BalanceSnapshot {
  date: string;
  monthsAdvanced: number;
  checking: number;
  goalReserves: number;
  riskReserve: number;
  liquidAssets: number;
  obligations: number;
  pool: number;
  freeToSpend: number;
  reservedTowardGoals: number;
  stillToFund: number;
  financialFreedomScore: number;
  /** Expected liquid income / mo (job, family, averaged semester refunds) */
  liquidMonthly?: number;
  /**
   * liquidMonthly − net obligations (signed).
   * Distinct from freeToSpend (stock of balances after bills).
   */
  monthlyCashflow?: number;
}

export interface AppState {
  user: UserProfile;
  goals: Goal[];
  recommendations: Recommendation[];
  activity: ActivityItem[];
  transactions: Transaction[];
  risk: RiskState;
  /** Mutable demo clock — advanced by “simulate months” */
  demoToday: string;
  monthsAdvanced: number;
  /** Running balance-sheet history (seed + each simulated month) */
  balanceHistory: BalanceSnapshot[];
  /** Set after junior-year furniture goal/tips are seeded once */
  furnitureMoveOffered: boolean;
  focusedGoalId: string | null;
  activeRecommendationId: string | null;
  homeRecommendationFeedback: "accepted" | "rejected" | null;
  demoCompletedPurchase: boolean;
  /** Which intake persona / custom profile bootstrapped this session */
  personaId?: string;
}
