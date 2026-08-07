"use client";

import { DemoBanner } from "@/components/DemoBanner";
import { HealthTimeCalendar } from "@/components/HealthTimeCalendar";
import { SafeSpendCard } from "@/components/SafeSpendCard";
import { useApp } from "@/context/AppContext";

export default function CashflowPage() {
  const { state, hydrated } = useApp();

  if (!hydrated) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <DemoBanner />
        <h1 className="pt-1 font-display text-3xl font-semibold tracking-tight">
          Monthly cashflow
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Income vs bills · free-to-spend in weeks of life.
        </p>
      </header>

      <SafeSpendCard
        checkingBalance={state.user.checkingBalance}
        goalReserveBalance={state.user.goalReserveBalance}
        riskReserveBalance={state.user.riskReserveBalance}
        obligations={state.user.obligations}
        obligationsTotal={state.user.upcomingObligations}
        goals={state.goals}
        risk={state.risk}
        nextPaycheckAmount={state.user.nextPaycheckAmount}
        nextPaycheckDate={state.user.nextPaycheckDate}
        connectedSources={state.user.connectedSources}
        incomeStreams={state.user.incomeStreams ?? []}
        typicalDiscretionaryPerDay={state.user.typicalDiscretionaryPerDay}
      />

      <HealthTimeCalendar
        history={state.balanceHistory ?? []}
        typicalDailyBurn={state.user.typicalDiscretionaryPerDay}
        demoToday={state.demoToday}
      />
    </div>
  );
}
