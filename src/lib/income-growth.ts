/**
 * Income-growth tips — the path out of break-even / red after a bills bridge.
 *
 * The aid bridge only stops the hole (cashflow ≈ $0). It does not grow
 * checking. Students climb by earning more: shifts, second job, summer work.
 */

import { monthlyCashflow, monthlyFromStream } from "./income";
import type {
  Goal,
  IncomeStream,
  Recommendation,
  UserProfile,
} from "./types";
import { formatMoney } from "./utils";

export const INCOME_GROWTH_CATEGORY = "income-growth";

export interface IncomeGrowthMove {
  tipKey: string;
  title: string;
  description: string;
  /** Monthly $ added to liquid income */
  monthlyLift: number;
  /** Stream to add or bump */
  stream: Omit<IncomeStream, "id"> & { id: string };
  /** If true, raise existing stream amount instead of adding duplicate */
  bumpExistingId?: string;
  bumpBy?: number;
  disruptionScore: number;
  lifestyleImpact: "Low" | "Medium" | "High";
}

/**
 * Target surplus after bills. One side gig (~$400) is not enough — lifestyle
 * still drains checking and freedom stays "tight". Stack shifts until ~$500+.
 */
export const TARGET_CASHFLOW_BUFFER = 500;

export function needsIncomeGrowth(
  user: UserProfile,
  goals: Goal[] = []
): boolean {
  const flow = monthlyCashflow(
    user.incomeStreams ?? [],
    user.upcomingObligations
  );
  if (flow.cashflow < TARGET_CASHFLOW_BUFFER) return true;
  // Thin cushion even with okay flow — still need earnings to climb
  if (user.checkingBalance < 1200 && flow.cashflow < 650) return true;
  void goals;
  return false;
}

export function buildIncomeGrowthMoves(user: UserProfile): IncomeGrowthMove[] {
  const streams = user.incomeStreams ?? [];
  const campus = streams.find(
    (s) =>
      s.id === "inc-campus" ||
      /rec center|campus job|work-study/i.test(s.label)
  );
  const moves: IncomeGrowthMove[] = [];

  // 1) More shifts on existing campus job
  if (campus && campus.cadence === "biweekly") {
    const bump = 120; // ~2 more shifts
    const monthlyLift = Math.round(monthlyFromStream({ ...campus, amount: bump }));
    moves.push({
      tipKey: "income-more-shifts",
      title: `Take +2 Rec Center shifts`,
      description: `+${formatMoney(bump)}/paycheck → ~${formatMoney(monthlyLift)}/mo liquid. Same job, more hours.`,
      monthlyLift,
      stream: {
        id: campus.id,
        label: campus.label,
        amount: campus.amount + bump,
        cadence: campus.cadence,
        source: campus.source,
        landsInChecking: true,
        note: "Closer: picked up extra shifts",
      },
      bumpExistingId: campus.id,
      bumpBy: bump,
      disruptionScore: 2,
      lifestyleImpact: "Medium",
    });
  } else {
    moves.push({
      tipKey: "income-campus-job",
      title: "Pick up a campus job",
      description: `Rec Center / library · $180 biweekly → ~${formatMoney(390)}/mo into checking.`,
      monthlyLift: 390,
      stream: {
        id: "inc-campus-extra",
        label: "Campus job (new)",
        amount: 180,
        cadence: "biweekly",
        source: "Campus Job Direct Deposit",
        landsInChecking: true,
        note: "Closer: new on-campus shifts",
      },
      disruptionScore: 3,
      lifestyleImpact: "Medium",
    });
  }

  // 2) Second job — dining / retail
  if (!streams.some((s) => s.id === "inc-second-job")) {
    moves.push({
      tipKey: "income-second-job",
      title: "Add a weekend dining shift",
      description: `$200 biweekly from campus dining / nearby café → ~${formatMoney(433)}/mo.`,
      monthlyLift: 433,
      stream: {
        id: "inc-second-job",
        label: "Campus dining · weekends",
        amount: 200,
        cadence: "biweekly",
        source: "Direct Deposit",
        landsInChecking: true,
        note: "Second job · evenings/weekends",
      },
      disruptionScore: 3,
      lifestyleImpact: "High",
    });
  }

  // 3) Tutoring / gig — lighter lift
  if (!streams.some((s) => s.id === "inc-tutoring")) {
    moves.push({
      tipKey: "income-tutoring",
      title: "Tutor 4 hrs/week",
      description: `~$160/mo side income — flexible, keeps weeknights free enough to study.`,
      monthlyLift: 160,
      stream: {
        id: "inc-tutoring",
        label: "Peer tutoring",
        amount: 160,
        cadence: "monthly",
        source: "Venmo / campus payroll",
        landsInChecking: true,
        note: "Side hustle · tutoring",
      },
      disruptionScore: 2,
      lifestyleImpact: "Low",
    });
  }

  return moves.sort((a, b) => b.monthlyLift - a.monthlyLift);
}

export function buildIncomeGrowthRecommendations(input: {
  user: UserProfile;
  goals: Goal[];
  makeId: () => string;
  history?: Recommendation[];
}): Recommendation[] {
  if (!needsIncomeGrowth(input.user, input.goals)) return [];

  const history = input.history ?? [];
  const consumed = new Set(
    history
      .filter(
        (r) =>
          r.tipKey &&
          (r.status === "accepted" ||
            r.status === "rejected" ||
            r.status === "pending")
      )
      .map((r) => r.tipKey as string)
  );

  const primary =
    [...input.goals]
      .filter((g) => !g.purchased)
      .sort((a, b) => a.priority - b.priority)[0]?.id ?? "__income__";

  const flow = monthlyCashflow(
    input.user.incomeStreams ?? [],
    input.user.upcomingObligations
  );

  return buildIncomeGrowthMoves(input.user)
    .filter((m) => !consumed.has(m.tipKey))
    .slice(0, 3)
    .map((m) => {
      const rec: Recommendation = {
        id: input.makeId(),
        tipKey: m.tipKey,
        repeatable: false,
        kind: "income_growth",
        title: m.title,
        description: m.description,
        savingsAmount: m.monthlyLift,
        estimatedDaysGained: Math.max(7, Math.round(m.monthlyLift / 5)),
        disruptionScore: m.disruptionScore,
        category: INCOME_GROWTH_CATEGORY,
        lifestyleImpact: m.lifestyleImpact,
        status: "pending",
        goalId: primary,
        evidenceSummary: `Cashflow ${formatMoney(flow.cashflow)}/mo · need ~${formatMoney(TARGET_CASHFLOW_BUFFER)}+/mo surplus (shifts + side job) to leave tight`,
        applyIncomeStream: m.stream,
        applyIncomeBumpId: m.bumpExistingId,
        applyIncomeBumpBy: m.bumpBy,
      };
      return rec;
    });
}

/** Merge fresh income-growth tips; keep bridge ahead when present. */
export function enforceIncomeGrowthPriority(
  recommendations: Recommendation[],
  user: UserProfile,
  goals: Goal[],
  makeId: () => string
): Recommendation[] {
  if (!needsIncomeGrowth(user, goals)) {
    return recommendations.map((r) =>
      r.kind === "income_growth" && r.status === "pending"
        ? { ...r, status: "superseded" as const }
        : r
    );
  }

  // Drop stale pending growth tips, rebuild
  let next = recommendations.map((r) =>
    r.kind === "income_growth" && r.status === "pending"
      ? { ...r, status: "superseded" as const }
      : r
  );

  const fresh = buildIncomeGrowthRecommendations({
    user,
    goals,
    makeId,
    history: next,
  });
  if (fresh.length === 0) return next;

  const bridge = next.filter(
    (r) => r.status === "pending" && r.kind === "income_bridge"
  );
  const rest = next.filter(
    (r) => !(r.status === "pending" && r.kind === "income_bridge")
  );
  return [...bridge, ...fresh, ...rest];
}

export function applyIncomeGrowth(input: {
  user: UserProfile;
  stream: IncomeStream;
  bumpExistingId?: string;
  bumpBy?: number;
}): UserProfile {
  const streams = [...(input.user.incomeStreams ?? [])];

  if (input.bumpExistingId && input.bumpBy) {
    const idx = streams.findIndex((s) => s.id === input.bumpExistingId);
    if (idx >= 0) {
      const cur = streams[idx];
      streams[idx] = {
        ...cur,
        amount: cur.amount + input.bumpBy,
        note: input.stream.note ?? cur.note,
      };
      return {
        ...input.user,
        incomeStreams: streams,
        dailyContributionRate: Math.max(
          input.user.dailyContributionRate,
          3
        ),
      };
    }
  }

  const without = streams.filter((s) => s.id !== input.stream.id);
  return {
    ...input.user,
    incomeStreams: [...without, input.stream],
    dailyContributionRate: Math.max(input.user.dailyContributionRate, 3),
  };
}
