"use client";

import {
  AlertTriangle,
  Banknote,
  ChevronDown,
  ChevronUp,
  PiggyBank,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Card } from "./ui/card";
import { safeSpendBreakdown } from "@/lib/calculations";
import {
  cadenceLabel,
  incomeSummary,
  monthlyCashflow,
  monthlyFromStream,
} from "@/lib/income";
import { riskReserveAvailable } from "@/lib/risk";
import { timePhraseForDollars } from "@/lib/wallet-integrity";
import type { Goal, IncomeStream, Obligation, RiskState } from "@/lib/types";
import { formatLongDate, formatMoney } from "@/lib/utils";

interface SafeSpendCardProps {
  checkingBalance: number;
  goalReserveBalance: number;
  /** Actual cash in the risk pot (not the planning budget) */
  riskReserveBalance: number;
  obligations: Obligation[];
  obligationsTotal: number;
  goals: Goal[];
  risk: RiskState;
  nextPaycheckAmount: number;
  nextPaycheckDate: string;
  connectedSources: string[];
  incomeStreams: IncomeStream[];
  /** Used to translate free-to-spend into days/weeks students understand */
  typicalDiscretionaryPerDay?: number;
}

/**
 * Two honest measures:
 * - Monthly cashflow (flow): income − protected bills — can be negative
 * - Free to spend (stock): balances left after this month’s bills & risk
 */
export function SafeSpendCard({
  checkingBalance,
  goalReserveBalance,
  riskReserveBalance,
  obligations,
  obligationsTotal,
  goals,
  risk,
  nextPaycheckAmount,
  nextPaycheckDate,
  connectedSources,
  incomeStreams,
  typicalDiscretionaryPerDay = 20,
}: SafeSpendCardProps) {
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [billsOpen, setBillsOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);

  // Never earmark more risk than cash sitting in the pot
  const riskEarmark = Math.min(
    riskReserveAvailable(risk),
    Math.max(0, riskReserveBalance)
  );
  const activeGoals = goals.filter((g) => !g.purchased);
  const flow = monthlyCashflow(incomeStreams, obligationsTotal);
  const obligationsNet = flow.netObligations;
  const breakdown = safeSpendBreakdown({
    checkingBalance,
    goalReserveBalance,
    obligationsTotal: obligationsNet,
    riskEarmark,
    goals,
  });
  const income = incomeSummary(incomeStreams);
  const liquidStreams = incomeStreams.filter((s) => s.landsInChecking);
  const aidCreditStreams = incomeStreams.filter((s) => !s.landsInChecking);
  const nextPayTotal = liquidStreams
    .filter((s) => s.cadence === "biweekly")
    .reduce((sum, s) => sum + s.amount, 0);
  const semesterStreams = liquidStreams.filter((s) => s.cadence === "semester");
  const cashflowNegative = flow.cashflow < 0;

  return (
    <Card className="space-y-3 py-3.5">
      {/* Monthly cashflow — signed; Jordan is red */}
      <div
        className={`rounded-2xl px-3 py-3 ${
          cashflowNegative ? "bg-rose-50" : "bg-emerald-50"
        }`}
      >
        <p
          className={`text-xs font-medium uppercase tracking-wider ${
            cashflowNegative ? "text-rose-800/70" : "text-emerald-800/70"
          }`}
        >
          Monthly cashflow
        </p>
        <p
          className={`font-display text-2xl font-semibold tabular-nums ${
            cashflowNegative ? "text-rose-800" : "text-emerald-900"
          }`}
        >
          {formatMoney(flow.cashflow)}
          <span className="ml-1 text-sm font-medium opacity-70">/ mo</span>
        </p>
        <p
          className={`mt-1 text-[12px] leading-snug tabular-nums ${
            cashflowNegative ? "text-rose-900/80" : "text-emerald-900/80"
          }`}
        >
          Income {formatMoney(flow.liquidMonthly)} − bills{" "}
          {formatMoney(flow.netObligations)} = {formatMoney(flow.cashflow)}
        </p>
        {cashflowNegative && (
          <p className="mt-1.5 text-[11px] leading-snug text-rose-900/75">
            Bills exceed income — accept the aid bridge on Home first.
          </p>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
          <ShieldCheck className="h-5 w-5 text-[var(--accent-deep)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Free to spend
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-[var(--accent-deep)]">
            {formatMoney(breakdown.free)}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
            ≈{" "}
            <span className="font-semibold text-foreground/80">
              {timePhraseForDollars(
                breakdown.free,
                typicalDiscretionaryPerDay || 20
              )}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setMathOpen((v) => !v)}
            className="mt-1 text-[11px] font-medium text-[var(--accent-deep)] underline-offset-2 hover:underline"
          >
            {mathOpen ? "Hide math" : "Show math"}
          </button>
          {mathOpen && (
            <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
              (Checking {formatMoney(checkingBalance)} + goals{" "}
              {formatMoney(goalReserveBalance)}) − bills{" "}
              {formatMoney(obligationsNet)} − risk {formatMoney(riskEarmark)} ={" "}
              {formatMoney(breakdown.free)}.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div
          className="flex h-3 overflow-hidden rounded-full bg-black/[0.06]"
          role="img"
          aria-label={`Available ${breakdown.free}, unallocated ${breakdown.unallocated}, in goals ${breakdown.earmarkedGoals}, risk ${breakdown.earmarkedRisk}`}
        >
          {breakdown.pool > 0 && (
            <>
              <div
                className="bg-[var(--accent)] transition-all duration-500"
                style={{
                  width: `${(breakdown.unallocated / breakdown.pool) * 100}%`,
                }}
              />
              <div
                className="bg-amber-400/90 transition-all duration-500"
                style={{
                  width: `${(breakdown.earmarkedGoals / breakdown.pool) * 100}%`,
                }}
              />
              <div
                className="bg-rose-300 transition-all duration-500"
                style={{
                  width: `${(breakdown.earmarkedRisk / breakdown.pool) * 100}%`,
                }}
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
            Flexible {formatMoney(breakdown.unallocated)}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            In goals {formatMoney(breakdown.earmarkedGoals)}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-300" />
            Risk {formatMoney(breakdown.earmarkedRisk)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIncomeOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2.5 text-left text-sm transition-colors hover:bg-emerald-100/80"
        aria-expanded={incomeOpen}
      >
        <span className="flex items-center gap-2 font-medium text-emerald-950">
          <Banknote className="h-4 w-4" />
          Income · {formatMoney(flow.liquidMonthly)}/mo liquid
        </span>
        {incomeOpen ? (
          <ChevronUp className="h-4 w-4 text-emerald-800/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-emerald-800/60" />
        )}
      </button>

      {incomeOpen && (
        <div className="animate-soft-in space-y-2 px-1 text-sm">
          <p className="text-[13px] leading-snug text-[var(--muted)]">
            Money into checking only. Bill credits are under obligations.
          </p>
          <ul className="space-y-2">
            {liquidStreams.map((s) => (
              <li key={s.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium leading-snug">{s.label}</p>
                  <span className="shrink-0 font-semibold tabular-nums text-emerald-900">
                    {formatMoney(s.amount)}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  {cadenceLabel(s.cadence)} · {s.source} · ~
                  {formatMoney(monthlyFromStream(s))}/mo into checking
                </p>
                {s.note && (
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                    {s.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-[var(--muted)]">
            <p className="flex justify-between gap-2">
              <span>Expected into checking / mo</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoney(income.liquidMonthly)}
              </span>
            </p>
            {semesterStreams.length > 0 && (
              <p className="mt-1 flex justify-between gap-2">
                <span>Loan refund / semester</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatMoney(
                    semesterStreams.reduce((s, x) => s + x.amount, 0)
                  )}{" "}
                  · Aug + Jan
                </span>
              </p>
            )}
            <p className="mt-1 flex justify-between gap-2">
              <span>Next biweekly DD (job + work-study)</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoney(nextPayTotal || nextPaycheckAmount)} ·{" "}
                {formatLongDate(nextPaycheckDate)}
              </span>
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setRiskOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl bg-rose-50 px-3 py-2.5 text-left text-sm transition-colors hover:bg-rose-100/80"
        aria-expanded={riskOpen}
      >
        <span className="flex items-center gap-2 font-medium text-rose-950">
          <AlertTriangle className="h-4 w-4" />
          Risk cushion · {formatMoney(riskEarmark)} · {risk.level}
        </span>
        {riskOpen ? (
          <ChevronUp className="h-4 w-4 text-rose-800/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-rose-800/60" />
        )}
      </button>

      {riskOpen && (
        <div className="animate-soft-in space-y-2 px-1 text-sm">
          <p className="text-[13px] leading-snug text-[var(--muted)]">{risk.summary}</p>
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            <li className="flex justify-between gap-2">
              <span>Monthly risk budget</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(risk.monthlyBudget)}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Rolled from quiet months</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(risk.rolledOver)}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Used this month</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(risk.spentThisMonth)}
              </span>
            </li>
          </ul>
          <p className="text-[11px] leading-snug text-[var(--muted)]">
            Shocks like flat tires &amp; surprise textbooks hit this pot — not your
            goal earmarks. Quiet months roll unused $ forward; Closer may recommend
            a good-job bonus — you always choose.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setGoalsOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl bg-amber-50 px-3 py-2.5 text-left text-sm transition-colors hover:bg-amber-100/80"
        aria-expanded={goalsOpen}
      >
        <span className="flex items-center gap-2 font-medium text-amber-950">
          <PiggyBank className="h-4 w-4" />
          Earmarked for goals · {formatMoney(breakdown.earmarkedGoals)}
            {breakdown.stillToFund > 0
              ? ` · ${formatMoney(breakdown.stillToFund)} still to fund`
              : ""}
        </span>
        {goalsOpen ? (
          <ChevronUp className="h-4 w-4 text-amber-800/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-800/60" />
        )}
      </button>

      {goalsOpen && (
        <ul className="animate-soft-in space-y-2 px-1">
          {activeGoals.map((g) => {
            const reserved = Math.min(g.fundedAmount, g.targetPrice);
            const still = Math.max(0, g.targetPrice - g.fundedAmount);
            return (
              <li key={g.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium leading-snug">{g.name}</p>
                  <span className="shrink-0 font-semibold tabular-nums text-amber-900">
                    {formatMoney(g.targetPrice)}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  {formatMoney(reserved)} reserved
                  {still > 0
                    ? ` · ${formatMoney(still)} still to fund`
                    : " · fully funded"}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setBillsOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl bg-black/[0.03] px-3 py-2.5 text-left text-sm transition-colors hover:bg-black/[0.05]"
        aria-expanded={billsOpen}
      >
        <span className="font-medium">
          Protected obligations · {formatMoney(obligationsNet)}/mo after aid
        </span>
        {billsOpen ? (
          <ChevronUp className="h-4 w-4 text-[var(--muted)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
        )}
      </button>

      {billsOpen && (
        <div className="animate-soft-in space-y-2 px-1">
          <p className="text-[13px] leading-snug text-[var(--muted)]">
            Sticker price − aid credits (loan/scholarship). Credits ≠ spendable.
          </p>
          <ul className="space-y-2">
            {obligations.map((o) => (
              <li
                key={o.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{o.label}</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Due {formatLongDate(o.dueDate)}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">
                  {formatMoney(o.amount)}
                </span>
              </li>
            ))}
            {aidCreditStreams
              .filter((s) => s.cadence !== "one_time")
              .map((s) => (
              <li
                key={s.id}
                className="flex items-baseline justify-between gap-3 text-sm text-emerald-900"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{s.label}</p>
                  <p className="text-[11px] text-emerald-900/70">
                    {s.id.includes("bridge")
                      ? "Loan earmark · bills only"
                      : "Bursar credit · not free-to-spend"}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  −{formatMoney(monthlyFromStream(s))}
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 border-t border-black/5 pt-2 text-sm">
              <p className="font-semibold">Paid from checking</p>
              <span className="font-semibold tabular-nums">
                {formatMoney(obligationsNet)}
              </span>
            </li>
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-black/5 pt-2.5 text-xs text-[var(--muted)]">
        <Wallet className="h-3.5 w-3.5 shrink-0" />
        <p className="min-w-0 truncate">
          Wallet{" "}
          {formatMoney(
            checkingBalance + goalReserveBalance + riskReserveBalance
          )}{" "}
          · Checking {formatMoney(checkingBalance)} · Goals{" "}
          {formatMoney(goalReserveBalance)} · Risk{" "}
          {formatMoney(riskReserveBalance)}
        </p>
      </div>
      <p className="truncate text-[10px] text-[var(--muted)]/70">
        Connected: {connectedSources.join(" · ")}
      </p>
    </Card>
  );
}
