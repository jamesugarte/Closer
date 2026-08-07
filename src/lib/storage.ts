import { captureBalanceSnapshot } from "./balance-sheet";
import {
  buildObligationsForPhase,
  collegePhase,
  collegeYearFromMonthsAdvanced,
  mergePersistentLoanObligations,
  obligationsTotalFromList,
} from "./college-life";
import {
  createInitialState,
  isValidDemoProgress,
} from "./initial-state";
import { createFreshmanSeedState, SESSION_ENTERED_KEY, STORAGE_KEY } from "./mock-data";
import type { AppState, Goal } from "./types";

function migrateState(parsed: AppState): AppState | null {
  if (
    !parsed?.user?.name ||
    !Array.isArray(parsed.goals) ||
    !Array.isArray(parsed.user.obligations) ||
    !Array.isArray(parsed.transactions) ||
    !parsed.risk ||
    typeof parsed.user.riskReserveBalance !== "number" ||
    typeof parsed.demoToday !== "string"
  ) {
    return null;
  }

  // Leftover freshman saves under a bumped key — start clean at sophomore
  if (!isValidDemoProgress(parsed)) {
    return createInitialState();
  }

  const monthsAdvanced = parsed.monthsAdvanced ?? 0;
  const collegeYear =
    parsed.user.collegeYear ?? collegeYearFromMonthsAdvanced(monthsAdvanced);

  const goals: Goal[] = parsed.goals
    .filter(
      (g) =>
        g.id !== "goal-car-payment" &&
        (g.name || "").toLowerCase() !== "car payment"
    )
    .map((g, i) => ({
      ...g,
      priority: typeof g.priority === "number" ? g.priority : i + 1,
    }));

  const phase = collegePhase(collegeYear);
  const needsCollegeObligations = !parsed.user.obligations.some(
    (o) => o.kind === "meal_plan" || o.kind === "groceries"
  );
  const phaseOrParsed = needsCollegeObligations
    ? buildObligationsForPhase(phase, parsed.demoToday)
    : parsed.user.obligations;
  // Keep financed car notes when phase defaults are rebuilt
  const obligations = mergePersistentLoanObligations(
    phaseOrParsed,
    parsed.user.obligations,
    parsed.demoToday
  );

  const incomeStreams =
    Array.isArray(parsed.user.incomeStreams) &&
    parsed.user.incomeStreams.length > 0
      ? parsed.user.incomeStreams
      : createFreshmanSeedState().user.incomeStreams;

  // Federal student_loan rows stay stripped; car_loan is a real monthly note
  const cleanedObligations = obligations.filter(
    (o) => o.kind !== "student_loan"
  );
  const finalObligations =
    cleanedObligations.length > 0 ? cleanedObligations : obligations;
  const upcomingObligations = obligationsTotalFromList(finalObligations);

  const migratedUser = {
    ...parsed.user,
    collegeYear,
    obligations: finalObligations,
    upcomingObligations,
    incomeStreams,
    nextPaycheckAmount:
      incomeStreams
        .filter((s) => s.landsInChecking && s.cadence === "biweekly")
        .reduce((sum, s) => sum + s.amount, 0) ||
      parsed.user.nextPaycheckAmount,
  };

  let balanceHistory = Array.isArray(parsed.balanceHistory)
    ? parsed.balanceHistory
    : [];

  if (balanceHistory.length === 0) {
    balanceHistory = [
      captureBalanceSnapshot({
        date: parsed.demoToday,
        monthsAdvanced,
        user: migratedUser,
        goals,
        risk: parsed.risk,
      }),
    ];
  }

  return {
    ...parsed,
    user: migratedUser,
    goals,
    monthsAdvanced,
    balanceHistory,
    furnitureMoveOffered: parsed.furnitureMoveOffered ?? false,
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return createInitialState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as AppState;
    return migrateState(parsed) ?? createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  // Never persist a broken freshman opening over the sophomore seed
  if (!isValidDemoProgress(state)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors in the demo
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  const doomed: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("closer-demo-state")) doomed.push(key);
  }
  for (const key of doomed) window.localStorage.removeItem(key);
}

export function isSessionEntered(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SESSION_ENTERED_KEY) === "1";
}

export function setSessionEntered(entered: boolean): void {
  if (typeof window === "undefined") return;
  if (entered) window.sessionStorage.setItem(SESSION_ENTERED_KEY, "1");
  else window.sessionStorage.removeItem(SESSION_ENTERED_KEY);
}
