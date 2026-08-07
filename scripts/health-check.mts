/**
 * Offline health check for Closer money flow + advisories.
 * Run: npx esbuild scripts/health-check.mts --bundle --platform=node --format=cjs --outfile=/tmp/closer-health.cjs && node /tmp/closer-health.cjs
 */

import { createFreshmanSeedState } from "../src/lib/mock-data";
import { createInitialState } from "../src/lib/initial-state";
import { runSimulateMonths } from "../src/lib/simulate-months";
import {
  billCreditDeposit,
  incomeSummary,
  netProtectedObligations,
  recurringLiquidDeposit,
} from "../src/lib/income";
import { safeSpendBreakdown } from "../src/lib/calculations";
import { riskReserveAvailable } from "../src/lib/risk";
import { assessGoalFeasibility } from "../src/lib/goal-feasibility";

const issues: string[] = [];
const notes: string[] = [];

function snap(label: string, state: ReturnType<typeof createInitialState>) {
  const streams = state.user.incomeStreams ?? [];
  const netObl = netProtectedObligations(
    state.user.upcomingObligations,
    streams
  );
  const breakdown = safeSpendBreakdown({
    checkingBalance: state.user.checkingBalance,
    goalReserveBalance: state.user.goalReserveBalance,
    obligationsTotal: netObl,
    riskEarmark: riskReserveAvailable(state.risk),
    goals: state.goals,
  });
  const active = state.goals.filter((g) => !g.purchased);
  const purchased = state.goals.filter((g) => g.purchased);
  const latest =
    state.balanceHistory?.[state.balanceHistory.length - 1] ?? null;

  return {
    label,
    months: state.monthsAdvanced,
    date: state.demoToday,
    year: state.user.collegeYear,
    checking: state.user.checkingBalance,
    free: breakdown.free,
    netObl,
    historyLen: state.balanceHistory?.length ?? 0,
    freedom: latest?.financialFreedomScore ?? null,
    activeGoals: active.map((g) => g.name),
    purchased: purchased.map((g) => g.name),
  };
}

function check(condition: boolean, msg: string) {
  if (!condition) issues.push(msg);
}

const seed = createInitialState();
const frosh = createFreshmanSeedState();
const streams = seed.user.incomeStreams ?? [];
const summary = incomeSummary(streams);
const recurring = recurringLiquidDeposit(streams);
const bursar = billCreditDeposit(streams);

notes.push(
  `Opening: year=${seed.user.collegeYear} date=${seed.demoToday} months=${seed.monthsAdvanced} history=${seed.balanceHistory.length}`
);
notes.push(
  `Income liquidMonthly=$${summary.liquidMonthly}, recurring=$${recurring}, bursar=$${bursar}`
);

check(seed.user.collegeYear === 2, `Expected sophomore open, got Y${seed.user.collegeYear}`);
check(seed.monthsAdvanced === 12, `Expected 12 mo advanced, got ${seed.monthsAdvanced}`);
check(
  (seed.balanceHistory?.length ?? 0) >= 13,
  `Expected ≥13 snapshots, got ${seed.balanceHistory?.length}`
);
check(recurring >= 1500, `Recurring liquid too low: $${recurring}`);

const ski = assessGoalFeasibility({
  targetPrice: 1000,
  fundedAmount: 0,
  optionalTargetDate: "2028-02-15",
  demoToday: seed.demoToday,
  dailyContributionRate: seed.user.dailyContributionRate,
  user: seed.user,
  risk: seed.risk,
  goals: seed.goals.filter((g) => !g.purchased),
  prioritize: true,
  goalName: "February ski trip",
});
notes.push(`Ski from sophomore open: ${ski.level} ${ski.likelihoodPct}%`);

const reports = [snap("open", seed), snap("frosh-seed", frosh)];
for (const months of [12, 24]) {
  const state = runSimulateMonths(createInitialState(), months);
  reports.push(snap(`open+${months}mo`, state));
  check(state.user.checkingBalance > 0, `open+${months} insolvent`);
}

console.log(JSON.stringify(reports, null, 2));
console.log("NOTES", notes);
console.log("ISSUES", issues.length ? issues : "NONE");
if (issues.length) process.exitCode = 1;
