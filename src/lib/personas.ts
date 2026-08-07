import type { ProfileBlueprint } from "./profile-blueprint";

/**
 * Maya — sophomore stretched thin by too many goals.
 * Story: car loan is a protected bill; she stacked concert / box seats /
 * trips on top. Goal health goes yellow-red; AI trade-offs teach her that
 * time (want-by dates) is the lever, not “being bad with money.”
 */
export const MAYA_BLUEPRINT: ProfileBlueprint = {
  id: "maya",
  tagline: "Sophomore · too many goals · time is the lever",
  lifeSituation:
    "Maya’s car loan ($345/mo) sits with rent — not a savings goal. Checking still looks fine, so she kept saying yes: box seats, concert, AirPods, beach trip, spring break, Coachella. Closer’s job is to show her the stack is impossible on those dates without wrecking student life — then walk trade-offs she approves.",
  arc: "healthy",
  name: "Maya",
  age: 19,
  collegeYear: 2,
  demoToday: "2026-08-23",
  /** Build from this blueprint (no stale sophomore JSON cliff) */
  useMayaSophomoreSeed: false,
  checkingBalance: 4280,
  goalReserveBalance: 479,
  riskReserveBalance: 80,
  dailyContributionRate: 3,
  typicalDiscretionaryPerDay: 22,
  incomeStreams: [
    {
      id: "inc-campus",
      label: "Campus job paycheck",
      amount: 520,
      cadence: "biweekly",
      source: "Direct Deposit",
      landsInChecking: true,
    },
    {
      id: "inc-workstudy",
      label: "Federal work-study",
      amount: 140,
      cadence: "biweekly",
      source: "Direct Deposit",
      landsInChecking: true,
    },
    {
      id: "inc-family",
      label: "Family contribution",
      amount: 450,
      cadence: "monthly",
      source: "Venmo",
      landsInChecking: true,
    },
    {
      id: "inc-loan-refund",
      label: "Direct Loan refund (living)",
      amount: 1800,
      cadence: "semester",
      source: "Bursar refund",
      landsInChecking: true,
      note: "Aug + Jan living refund after bursar",
    },
    {
      id: "inc-scholarship",
      label: "Scholarship / grant (bill credit)",
      amount: 500,
      cadence: "monthly",
      source: "Bursar credit",
      landsInChecking: false,
      note: "Offsets tuition / fees — never hits checking",
    },
  ],
  nextPaycheckAmount: 660,
  nextPaycheckDate: "2026-08-29",
  useCollegePhaseDefaults: false,
  obligationOverrides: [
    {
      kind: "rent",
      label: "Dorm housing (sophomore rate)",
      amount: 750,
    },
    {
      kind: "meal_plan",
      label: "Campus meal plan (required)",
      amount: 545,
    },
    {
      kind: "tuition",
      label: "Tuition payment plan",
      amount: 210,
    },
    {
      kind: "other",
      label: "Books / course fees (avg)",
      amount: 50,
    },
    {
      kind: "car_loan",
      label: "Car loan payment",
      amount: 345,
    },
  ],
  goals: [
    {
      name: "Box seats · football game",
      targetPrice: 2000,
      fundedAmount: 0,
      category: "Experiences",
      priority: 1,
      optionalTargetDate: "2026-09-25",
      timeSensitive: true,
    },
    {
      name: "Fall concert",
      targetPrice: 350,
      fundedAmount: 95,
      category: "Experiences",
      priority: 2,
      optionalTargetDate: "2026-10-18",
      timeSensitive: true,
    },
    {
      name: "AirPods Pro",
      targetPrice: 200,
      fundedAmount: 164,
      category: "Technology",
      priority: 3,
      optionalTargetDate: "2026-09-01",
      timeSensitive: false,
    },
    {
      name: "Holiday beach trip",
      targetPrice: 2000,
      fundedAmount: 0,
      category: "Travel",
      priority: 4,
      optionalTargetDate: "2026-12-31",
      timeSensitive: true,
    },
    {
      name: "Spring Break",
      targetPrice: 1600,
      fundedAmount: 220,
      category: "Travel",
      priority: 5,
      optionalTargetDate: "2027-03-01",
      timeSensitive: true,
    },
    {
      name: "Coachella",
      targetPrice: 1000,
      fundedAmount: 0,
      category: "Experiences",
      priority: 6,
      optionalTargetDate: "2027-05-20",
      timeSensitive: true,
    },
  ],
  spendPatterns: ["coffee_stack", "nightlife"],
  recentShocks: [],
};

/**
 * Jordan — freshman with necessary bills and a structural income hole.
 * Story: dorm + meal + tuition are non-negotiable. Lifestyle tips cannot
 * fix a deficit. First move is always a loan / aid bridge; then a year of
 * honest cashflow lets her grow breathing room and fund one real goal.
 */
export const JORDAN_BLUEPRINT: ProfileBlueprint = {
  id: "jordan",
  tagline: "Freshman · bills first · path to solvency",
  lifeSituation:
    "Jordan’s dorm, meal plan, and tuition are required — cutting coffee won’t close the hole. A Direct Loan refund was spent like fun money; parents cut Venmo; Rec Center shifts are spotty. Checking is nearly empty. Closer blocks lifestyle tips until she accepts a sized student loan / aid bridge. The bridge only stops the bleed (cashflow ≈ $0) — she still needs earn tips (extra Rec Center shifts, weekend dining, tutoring) so checking and freedom can climb out of the red over the year.",
  arc: "course_correct",
  name: "Jordan",
  age: 18,
  collegeYear: 1,
  demoToday: "2026-08-23",
  useMayaSophomoreSeed: false,
  checkingBalance: 285,
  goalReserveBalance: 40,
  riskReserveBalance: 12,
  dailyContributionRate: 0,
  typicalDiscretionaryPerDay: 38,
  incomeStreams: [
    {
      id: "inc-campus",
      label: "Rec Center shifts",
      amount: 160,
      cadence: "biweekly",
      source: "Campus Job Direct Deposit",
      landsInChecking: true,
      note: "Missed 2 of last 4 shifts",
    },
    {
      id: "inc-parents",
      label: "Parent Venmo (cut)",
      amount: 75,
      cadence: "monthly",
      source: "Venmo",
      landsInChecking: true,
      note: "Was $400 — cut after summer feed",
    },
    {
      id: "inc-loan-refund",
      label: "Direct Loan refund (remaining)",
      amount: 350,
      cadence: "semester",
      source: "Bursar refund",
      landsInChecking: true,
      note: "Most of the refund already spent",
    },
  ],
  nextPaycheckAmount: 160,
  nextPaycheckDate: "2026-08-29",
  useCollegePhaseDefaults: true,
  goals: [
    {
      name: "Used laptop for classes",
      targetPrice: 650,
      fundedAmount: 40,
      category: "School",
      priority: 1,
      optionalTargetDate: "2026-10-15",
      timeSensitive: false,
    },
  ],
  spendPatterns: ["heavy_delivery", "rideshare_habit", "bnpl_shopping"],
  recentShocks: [
    { label: "Klarna sneakers", amount: 85, category: "shopping", daysAgo: 12 },
    { label: "Urgent care co-pay", amount: 40, category: "health", daysAgo: 28 },
  ],
};

export const PERSONAS: ProfileBlueprint[] = [MAYA_BLUEPRINT, JORDAN_BLUEPRINT];

export function blankBlueprint(name = "Custom"): ProfileBlueprint {
  return {
    id: "custom",
    tagline: "Blank intake",
    lifeSituation: "",
    arc: "healthy",
    name,
    age: 19,
    collegeYear: 1,
    demoToday: "2026-08-23",
    useMayaSophomoreSeed: false,
    checkingBalance: 500,
    goalReserveBalance: 0,
    riskReserveBalance: 40,
    dailyContributionRate: 2,
    typicalDiscretionaryPerDay: 20,
    incomeStreams: [
      {
        id: "inc-job",
        label: "Campus job",
        amount: 400,
        cadence: "biweekly",
        source: "Direct Deposit",
        landsInChecking: true,
      },
    ],
    nextPaycheckAmount: 400,
    nextPaycheckDate: "2026-08-29",
    useCollegePhaseDefaults: true,
    goals: [
      {
        name: "First goal",
        targetPrice: 200,
        fundedAmount: 0,
        category: "Other",
        priority: 1,
      },
    ],
    spendPatterns: [],
    recentShocks: [],
  };
}
