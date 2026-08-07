import { AIRPODS_GOAL_ID } from "./mock-data-ids";
import { daysFromSavings } from "./calculations";
import { unforeseenTransactions } from "./transactions";
import type { Recommendation, RiskState, Transaction } from "./types";

/**
 * Build a risk profile from unforeseen ledger rows.
 * Transparent prototype math — not a credit-bureau score.
 */
export function buildRiskProfile(
  transactions: Transaction[],
  studentName = "This student"
): Omit<
  RiskState,
  "pendingGoodJobBonus" | "lastQuietMonthBonusOffered" | "spentThisMonth" | "rolledOver"
> & { suggestedMonthlyBudget: number; avgShock: number; shockCount: number } {
  const shocks = unforeseenTransactions(transactions);
  const totalShock = Math.abs(shocks.reduce((s, t) => s + t.amount, 0));
  const shockCount = shocks.length;
  const monthlyFromHistory = Math.round(totalShock / 2);

  const suggestedMonthlyBudget = Math.max(
    60,
    Math.min(150, Math.round(monthlyFromHistory / 10) * 10)
  );

  const byCat: Record<string, number> = {};
  for (const s of shocks) {
    byCat[s.category] = (byCat[s.category] ?? 0) + Math.abs(s.amount);
  }
  const topShockCategories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  let level: RiskState["level"] = "Moderate";
  if (shockCount <= 2 && suggestedMonthlyBudget <= 70) level = "Low";
  if (shockCount >= 4 || suggestedMonthlyBudget >= 100) level = "Elevated";

  const shockLabels =
    topShockCategories.length > 0
      ? topShockCategories.join(", ")
      : "misc shocks";

  const summary =
    level === "Elevated"
      ? `${studentName} had ${shockCount} unforeseen hits (~$${totalShock}) in recent weeks — ${shockLabels}. A $${suggestedMonthlyBudget}/mo risk earmark keeps goals from getting raided.`
      : `History shows occasional shocks (avg ~$${Math.round(totalShock / Math.max(shockCount, 1))} each). A $${suggestedMonthlyBudget}/mo risk earmark protects goal progress when life happens.`;

  return {
    monthlyBudget: suggestedMonthlyBudget,
    level,
    summary,
    topShockCategories,
    suggestedMonthlyBudget,
    avgShock: Math.round(totalShock / Math.max(shockCount, 1)),
    shockCount,
  };
}

export function riskReserveAvailable(risk: RiskState): number {
  return Math.max(0, risk.monthlyBudget + risk.rolledOver - risk.spentThisMonth);
}

function spendFor(
  transactions: Transaction[],
  ...keys: string[]
): { amount: number; ids: string[] } {
  const matched = transactions.filter(
    (t) => t.patternKey && keys.includes(t.patternKey)
  );
  return {
    amount: Math.abs(matched.reduce((s, t) => s + t.amount, 0)),
    ids: matched.map((t) => t.id),
  };
}

function txExists(transactions: Transaction[], id: string): boolean {
  return transactions.some((t) => t.id === id);
}

/**
 * Pattern-sourced tips — each cites ledger evidence that actually exists.
 * Closer only recommends; nothing moves until the student accepts.
 */
export function buildPatternRecommendations(
  transactions: Transaction[],
  dailyRate: number,
  goalId: string = AIRPODS_GOAL_ID,
  goalName: string = "your goal"
): Recommendation[] {
  const rides = spendFor(transactions, "uber", "rideshare");
  const delivery = spendFor(transactions, "delivery");
  const coffee = spendFor(transactions, "coffee");
  const nightlife = spendFor(transactions, "nightlife");
  const bnpl = spendFor(transactions, "bnpl");
  const gaming = spendFor(transactions, "gaming");
  const subs = spendFor(transactions, "subscriptions");

  const candidates: Recommendation[] = [];

  if (rides.amount > 0) {
    candidates.push({
      id: `${goalId}-rec-shuttle`,
      tipKey: "habit-shuttle",
      repeatable: true,
      kind: "spend_pattern",
      title: "Move your goal 6 days closer",
      description:
        "Use the free campus shuttle instead of Uber / rideshare twice this week.",
      savingsAmount: 18,
      estimatedDaysGained: daysFromSavings(18, dailyRate),
      disruptionScore: 1,
      category: "transport",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: rides.ids.slice(0, 4),
      evidenceSummary: `$${rides.amount.toFixed(0)} on rideshare in the last few weeks`,
    });
  }

  if (delivery.amount > 0) {
    candidates.push({
      id: `${goalId}-rec-pickup`,
      tipKey: "habit-pickup",
      repeatable: true,
      kind: "spend_pattern",
      title: "Move your goal 2 days closer",
      description: "Skip one delivery fee by using campus pickup.",
      savingsAmount: 7,
      estimatedDaysGained: daysFromSavings(7, dailyRate),
      disruptionScore: 1,
      category: "food",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: delivery.ids.slice(0, 4),
      evidenceSummary: `$${delivery.amount.toFixed(0)} on delivery apps recently`,
    });
    candidates.push({
      id: `${goalId}-rec-delivery-batch`,
      tipKey: "habit-delivery-batch",
      repeatable: true,
      kind: "spend_pattern",
      title: "Move your goal 5 days closer",
      description: "Cook one double-batch meal instead of two delivery nights.",
      savingsAmount: 15,
      estimatedDaysGained: daysFromSavings(15, dailyRate),
      disruptionScore: 2,
      category: "food",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: delivery.ids.slice(0, 4),
      evidenceSummary: "DoorDash / Uber Eats fees stacking on top of meal cost",
    });
  }

  if (coffee.amount > 0) {
    candidates.push({
      id: `${goalId}-rec-coffee`,
      tipKey: "habit-coffee",
      repeatable: true,
      kind: "spend_pattern",
      title: "Move your goal 3 days closer",
      description: "Brew coffee at home three mornings instead of campus cafés.",
      savingsAmount: 9,
      estimatedDaysGained: daysFromSavings(9, dailyRate),
      disruptionScore: 2,
      category: "habits",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: coffee.ids.slice(0, 5),
      evidenceSummary: `$${coffee.amount.toFixed(0)} on coffee runs this month`,
    });
  }

  if (nightlife.amount > 0) {
    candidates.push({
      id: `${goalId}-rec-nightlife`,
      tipKey: "habit-nightlife-cap",
      repeatable: true,
      kind: "spend_pattern",
      title: "Move your goal 7 days closer",
      description:
        "Cap nightlife to one paid night out this week — cover charge + bar tabs add up fast.",
      savingsAmount: 22,
      estimatedDaysGained: daysFromSavings(22, dailyRate),
      disruptionScore: 3,
      category: "social",
      lifestyleImpact: "Medium",
      status: "pending",
      goalId,
      evidenceTransactionIds: nightlife.ids.slice(0, 4),
      evidenceSummary: `$${nightlife.amount.toFixed(0)} on nightlife recently`,
    });
  }

  if (bnpl.amount > 0) {
    candidates.push({
      id: `${goalId}-rec-bnpl`,
      tipKey: "habit-bnpl-pause",
      repeatable: false,
      kind: "spend_pattern",
      title: "Move your goal 8 days closer",
      description:
        "Pause new Klarna / Afterpay orders until current installments clear.",
      savingsAmount: 25,
      estimatedDaysGained: daysFromSavings(25, dailyRate),
      disruptionScore: 2,
      category: "shopping",
      lifestyleImpact: "Medium",
      status: "pending",
      goalId,
      evidenceTransactionIds: bnpl.ids.slice(0, 3),
      evidenceSummary: `$${bnpl.amount.toFixed(0)} in BNPL / installment spends`,
    });
  }

  if (gaming.amount > 0) {
    candidates.push({
      id: `${goalId}-rec-gaming`,
      tipKey: "habit-gaming-micro",
      repeatable: true,
      kind: "spend_pattern",
      title: "Move your goal 4 days closer",
      description: "Skip in-game purchases this week — put that toward the build instead.",
      savingsAmount: 12,
      estimatedDaysGained: daysFromSavings(12, dailyRate),
      disruptionScore: 2,
      category: "entertainment",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: gaming.ids.slice(0, 3),
      evidenceSummary: `$${gaming.amount.toFixed(0)} on gaming microtransactions`,
    });
  }

  if (subs.amount > 0 || txExists(transactions, "tx-sub-canva")) {
    const ids = subs.ids.length
      ? subs.ids
      : txExists(transactions, "tx-sub-canva")
        ? ["tx-sub-canva"]
        : [];
    candidates.push({
      id: `${goalId}-rec-canva`,
      tipKey: "sub-cancel-unused",
      repeatable: false,
      kind: "spend_pattern",
      title: "Move your goal 5 days closer",
      description: "Cancel an unused subscription you forgot after a trial or promo.",
      savingsAmount: 15,
      estimatedDaysGained: daysFromSavings(15, dailyRate),
      disruptionScore: 1,
      category: "subscriptions",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: ids,
      evidenceSummary:
        subs.amount > 0
          ? `$${subs.amount.toFixed(0)} in subscription charges`
          : "Trial converted — unused this month",
    });
  }

  if (txExists(transactions, "tx-textbook")) {
    candidates.push({
      id: `${goalId}-rec-textbook-used`,
      tipKey: "risk-textbook-used",
      repeatable: false,
      kind: "risk_avoidance",
      title: "Reduce education shock risk",
      description: `Next required book: check campus exchange / used first so textbook surprises don’t raid your ${goalName} reserve.`,
      savingsAmount: 30,
      estimatedDaysGained: daysFromSavings(30, dailyRate),
      disruptionScore: 2,
      category: "education",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: ["tx-textbook"],
      evidenceSummary: "$62 mid-syllabus bookstore hit tagged as unforeseen",
    });
  }

  if (txExists(transactions, "tx-tire")) {
    candidates.push({
      id: `${goalId}-rec-tire-fund`,
      tipKey: "risk-tire-fund",
      repeatable: false,
      kind: "risk_avoidance",
      title: "Protect goals from auto shocks",
      description: `Keep your risk earmark topped up after the flat tire — Closer recommends not dipping into ${goalName} when the next car surprise hits.`,
      savingsAmount: 20,
      estimatedDaysGained: daysFromSavings(20, dailyRate),
      disruptionScore: 1,
      category: "auto",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: ["tx-tire"],
      evidenceSummary: "$85 Campus Auto Care — unforeseen, not discretionary fun",
    });
  }

  // Jordan-style shocks (phone / parking / urgent care)
  const phoneShock = transactions.find((t) => t.patternKey === "tech_shock");
  if (phoneShock) {
    candidates.push({
      id: `${goalId}-rec-phone-case`,
      tipKey: "risk-phone-protect",
      repeatable: false,
      kind: "risk_avoidance",
      title: "Protect goals from tech shocks",
      description: `After the screen repair, keep risk topped up so the next phone hit doesn’t raid ${goalName}.`,
      savingsAmount: 20,
      estimatedDaysGained: daysFromSavings(20, dailyRate),
      disruptionScore: 1,
      category: "shopping",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: [phoneShock.id],
      evidenceSummary: `${phoneShock.merchant} — unforeseen tech repair`,
    });
  }

  const autoShock = transactions.find((t) => t.patternKey === "auto_shock");
  if (autoShock) {
    candidates.push({
      id: `${goalId}-rec-parking`,
      tipKey: "risk-parking",
      repeatable: false,
      kind: "risk_avoidance",
      title: "Avoid another parking hit",
      description:
        "Use campus lots / shuttle for game days so tickets don’t steal from goals.",
      savingsAmount: 15,
      estimatedDaysGained: daysFromSavings(15, dailyRate),
      disruptionScore: 1,
      category: "auto",
      lifestyleImpact: "Low",
      status: "pending",
      goalId,
      evidenceTransactionIds: [autoShock.id],
      evidenceSummary: `${autoShock.merchant} — unforeseen`,
    });
  }

  if (
    txExists(transactions, "tx-venmo-dinner") ||
    txExists(transactions, "tx-venmo-concert")
  ) {
    candidates.push({
      id: `${goalId}-rec-venmo-cap`,
      tipKey: "habit-venmo-cap",
      repeatable: true,
      kind: "spend_pattern",
      title: "Move your goal 4 days closer",
      description:
        "Set a soft $25 Venmo social cap this weekend (split dinner, skip add-ons).",
      savingsAmount: 12,
      estimatedDaysGained: daysFromSavings(12, dailyRate),
      disruptionScore: 2,
      category: "social",
      lifestyleImpact: "Medium",
      status: "pending",
      goalId,
      evidenceTransactionIds: ["tx-venmo-dinner", "tx-venmo-concert"].filter(
        (id) => txExists(transactions, id)
      ),
      evidenceSummary: "Social Venmo averaging ~$25/outing",
    });
  }

  return candidates;
}
