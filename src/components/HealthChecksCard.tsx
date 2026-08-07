"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CloudLightning,
  CloudSun,
  Flame,
  Leaf,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card } from "./ui/card";
import { captureBalanceSnapshot } from "@/lib/balance-sheet";
import { safeSpendBreakdown } from "@/lib/calculations";
import { monthlyCashflow } from "@/lib/income";
import { riskReserveAvailable } from "@/lib/risk";
import type { AppState } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

type HealthMood = {
  id: string;
  Icon: typeof Flame;
  title: string;
  blurb: string;
  badge: string;
  ring: string;
  glow: string;
  iconColor: string;
};

function moodFor(passCount: number, freedom: number, free: number): HealthMood {
  if (passCount >= 4 && freedom >= 70 && free >= 500) {
    return {
      id: "on-fire",
      Icon: Flame,
      title: "On a roll",
      blurb: "Bills, cushion, and breathing room are all humming.",
      badge: "bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400",
      ring: "ring-amber-300/60",
      glow: "shadow-[0_12px_28px_-10px_rgba(251,146,60,0.55)]",
      iconColor: "text-white",
    };
  }
  if (passCount >= 3 && freedom >= 55) {
    return {
      id: "sunny",
      Icon: Sparkles,
      title: "Looking bright",
      blurb: "Most checks are green — keep the auto-save streak going.",
      badge: "bg-gradient-to-br from-teal-400 to-emerald-500",
      ring: "ring-teal-300/50",
      glow: "shadow-[0_12px_28px_-10px_rgba(20,184,166,0.45)]",
      iconColor: "text-white",
    };
  }
  if (passCount >= 2) {
    return {
      id: "mixed",
      Icon: CloudSun,
      title: "Mixed skies",
      blurb: "A couple soft spots — fixable without gutting goals.",
      badge: "bg-gradient-to-br from-sky-300 to-teal-500",
      ring: "ring-sky-300/50",
      glow: "shadow-[0_12px_28px_-12px_rgba(56,189,248,0.45)]",
      iconColor: "text-white",
    };
  }
  if (passCount === 1) {
    return {
      id: "wobbly",
      Icon: Leaf,
      title: "Needs a water",
      blurb: "One solid check left standing — rebuild cushion before new goals.",
      badge: "bg-gradient-to-br from-lime-300 to-amber-400",
      ring: "ring-lime-300/50",
      glow: "shadow-[0_12px_28px_-12px_rgba(163,230,53,0.4)]",
      iconColor: "text-emerald-950",
    };
  }
  return {
    id: "storm",
    Icon: CloudLightning,
    title: "Storm mode",
    blurb: "Protected bills first — then rebuild free cash and risk.",
    badge: "bg-gradient-to-br from-slate-500 to-rose-500",
    ring: "ring-rose-300/50",
    glow: "shadow-[0_12px_28px_-10px_rgba(244,63,94,0.4)]",
    iconColor: "text-white",
  };
}

/**
 * Compact health checks for Home dashboard — not the full analytics charts.
 */
export function HealthChecksCard({ state }: { state: AppState }) {
  const riskEarmark = Math.min(
    riskReserveAvailable(state.risk),
    Math.max(0, state.user.riskReserveBalance)
  );
  const flow = monthlyCashflow(
    state.user.incomeStreams ?? [],
    state.user.upcomingObligations
  );
  const obligationsNet = flow.netObligations;
  const breakdown = safeSpendBreakdown({
    checkingBalance: state.user.checkingBalance,
    goalReserveBalance: state.user.goalReserveBalance,
    obligationsTotal: obligationsNet,
    riskEarmark,
    goals: state.goals,
  });
  const live = captureBalanceSnapshot({
    date: state.demoToday,
    monthsAdvanced: state.monthsAdvanced,
    user: state.user,
    goals: state.goals,
    risk: state.risk,
  });
  const freedom = live.financialFreedomScore;

  const cashflowOk = flow.cashflow >= 0;
  const billsOk = state.user.checkingBalance >= obligationsNet;
  const riskOk = riskEarmark >= state.risk.monthlyBudget * 0.75;
  const freeOk = breakdown.free >= 150;
  const goalsActive = state.goals.filter((g) => !g.purchased).length;
  const primary = state.goals
    .filter((g) => !g.purchased)
    .sort((a, b) => a.priority - b.priority)[0];
  const primaryRemaining = primary
    ? Math.max(0, primary.targetPrice - primary.fundedAmount)
    : 0;
  // Pass when surplus isn't sitting idle against an underfunded goal —
  // either no gap, or free cash can't cover it yet (Jordan), or reserve is full.
  const surplusAligned =
    !primary ||
    primaryRemaining <= 0 ||
    breakdown.free < primaryRemaining ||
    state.recommendations.some(
      (r) =>
        r.kind === "surplus_allocation" &&
        r.goalId === primary.id &&
        r.status === "accepted"
    );

  const checks = [
    {
      ok: cashflowOk,
      label: "Monthly cashflow",
      detail: cashflowOk
        ? `Income ${formatMoney(flow.liquidMonthly)} covers bills ${formatMoney(obligationsNet)}`
        : `${formatMoney(flow.liquidMonthly)} in − ${formatMoney(obligationsNet)} bills = ${formatMoney(flow.cashflow)}/mo`,
      icon: AlertTriangle,
    },
    {
      ok: billsOk,
      label: "Bills covered",
      detail: billsOk
        ? `Checking covers ${formatMoney(obligationsNet)} after aid`
        : "Checking below this month’s net obligations",
      icon: Wallet,
    },
    {
      ok: riskOk,
      label: "Risk cushion",
      detail: `${formatMoney(riskEarmark)} on hand · ${state.risk.level}`,
      icon: ShieldCheck,
    },
    {
      ok: freeOk,
      label: "Breathing room",
      detail: `${formatMoney(breakdown.free)} free stock after bills & risk`,
      icon: PiggyBank,
    },
    {
      ok: surplusAligned,
      label: "Surplus vs goals",
      detail:
        !primary || primaryRemaining <= 0
          ? "No underfunded primary goal"
          : breakdown.free >= primaryRemaining
            ? `${formatMoney(primaryRemaining)} for ${primary.name} sits in free-to-spend — move it to get closer`
            : `Free ${formatMoney(breakdown.free)} · still need ${formatMoney(primaryRemaining)} for ${primary.name}`,
      icon: Sparkles,
    },
    {
      ok: freedom >= 45,
      label: "Freedom score",
      detail: `${freedom}/100 · financial freedom`,
      icon: TrendingUp,
    },
  ];

  const passCount = checks.filter((c) => c.ok).length;
  const mood = moodFor(passCount, freedom, breakdown.free);
  const MoodIcon = mood.Icon;

  return (
    <Card className="relative space-y-3 overflow-hidden py-3.5">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-30 blur-2xl"
        style={{
          background:
            passCount >= 3
              ? "radial-gradient(circle, #5eead4 0%, transparent 70%)"
              : passCount >= 2
                ? "radial-gradient(circle, #7dd3fc 0%, transparent 70%)"
                : "radial-gradient(circle, #fda4af 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative flex items-start gap-3">
        <div
          key={mood.id}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] ring-2 animate-health-bounce",
            mood.badge,
            mood.ring,
            mood.glow
          )}
          aria-hidden
        >
          <MoodIcon className={cn("h-7 w-7", mood.iconColor)} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                Financial health
              </p>
              <p className="font-display text-xl font-semibold tracking-tight">
                {mood.title}
              </p>
            </div>
            <Link
              href="/cashflow"
              className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-deep)]"
            >
              Cashflow →
            </Link>
          </div>
          <p className="mt-0.5 text-sm leading-snug text-[var(--muted)]">
            {mood.blurb}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                passCount >= checks.length
                  ? "bg-emerald-500"
                  : passCount >= 2
                    ? "bg-amber-400"
                    : "bg-rose-500"
              )}
            />
            {passCount}/{checks.length} checks clear
          </p>
        </div>
      </div>

      <ul className="relative space-y-2">
        {checks.map((c) => {
          const Icon = c.ok ? c.icon : AlertTriangle;
          return (
            <li
              key={c.label}
              className={cn(
                "flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                c.ok ? "bg-[var(--accent-soft)]/55" : "bg-rose-50"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
                  c.ok ? "bg-white/80 text-[var(--accent-deep)]" : "bg-white text-rose-600"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="text-xs text-[var(--muted)]">{c.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="relative text-[11px] text-[var(--muted)]">
        {goalsActive} active goal{goalsActive === 1 ? "" : "s"} · manage tips on
        the Goals tab
      </p>
    </Card>
  );
}
