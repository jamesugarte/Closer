"use client";

import { DemoBanner } from "@/components/DemoBanner";
import { SpendingReportView } from "@/components/SpendingReportView";
import { useApp } from "@/context/AppContext";

export default function SpendingPage() {
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
          Spending
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Statement-style tracking by category — what actually left the wallet.
        </p>
      </header>

      <SpendingReportView
        transactions={state.transactions}
        activity={state.activity}
        demoToday={state.demoToday}
        studentName={state.user.name}
      />
    </div>
  );
}
