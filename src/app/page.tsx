"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { GoalHealthCard } from "@/components/GoalHealthCard";
import { HealthChecksCard } from "@/components/HealthChecksCard";
import { HealthTimeCalendar } from "@/components/HealthTimeCalendar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { shiftDateEarlier } from "@/lib/calculations";
import { formatLongDate, formatMoney, greetingForHour } from "@/lib/utils";

function SpentBanner() {
  const params = useSearchParams();
  const { state } = useApp();
  if (params.get("spent") !== "1") return null;
  const last = state.activity.find((a) => a.kind === "purchase");
  if (!last) return null;
  return (
    <div className="animate-soft-in rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
      <p className="font-semibold">{last.title}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-rose-900/80">
        {last.detail}
        {last.amount != null ? ` · ${formatMoney(last.amount)}` : ""}
      </p>
    </div>
  );
}

function HomeBody() {
  const {
    state,
    hydrated,
    activeRecommendation,
    acceptRecommendation,
    rejectRecommendation,
    primaryGoal,
    goalHealth,
    goalHealthTips,
  } = useApp();

  const feedback =
    activeRecommendation &&
    state.activeRecommendationId === activeRecommendation.id
      ? state.homeRecommendationFeedback
      : null;

  const newDateISO = useMemo(() => {
    if (!activeRecommendation || !primaryGoal) return state.demoToday;
    if (activeRecommendation.kind === "income_bridge") return state.demoToday;
    if (activeRecommendation.kind === "income_growth") return state.demoToday;
    if (activeRecommendation.applyOptionalTargetDate) {
      return activeRecommendation.applyOptionalTargetDate;
    }
    return shiftDateEarlier(
      primaryGoal.projectedPurchaseDate,
      activeRecommendation.estimatedDaysGained
    );
  }, [activeRecommendation, primaryGoal, state.demoToday]);

  if (!hydrated) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
        Loading Closer…
      </div>
    );
  }

  const greeting = greetingForHour(19);
  const yearLabel = (
    ["", "Freshman", "Sophomore", "Junior", "Senior"] as const
  )[state.user.collegeYear ?? 1];

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <DemoBanner />
        <p className="pt-1 text-sm text-[var(--muted)]">
          {greeting} · {formatLongDate(state.demoToday)} · {yearLabel}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Financial health
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Goals vs life — time is the lever.
        </p>
      </header>

      <SpentBanner />

      <GoalHealthCard
        report={goalHealth}
        tradeoffs={goalHealthTips}
        onApprove={acceptRecommendation}
        onReject={rejectRecommendation}
        compact={goalHealth.level === "green"}
      />

      <HealthTimeCalendar
        history={state.balanceHistory ?? []}
        typicalDailyBurn={state.user.typicalDiscretionaryPerDay}
        demoToday={state.demoToday}
      />

      <HealthChecksCard state={state} />

      <section className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Do this next
          </h2>
          <Link
            href="/recommendations"
            className="text-[11px] font-medium text-[var(--accent-deep)]"
          >
            All tips
          </Link>
        </div>
        {activeRecommendation ? (
          <RecommendationCard
            recommendation={activeRecommendation}
            newDateISO={newDateISO}
            feedback={feedback}
            onAccept={() => acceptRecommendation(activeRecommendation.id)}
            onReject={() => rejectRecommendation(activeRecommendation.id)}
          />
        ) : (
          <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-4 text-sm text-[var(--muted)]">
            No open recommendation right now. Check Goals or Cashflow for
            context.
            <Link href="/goals" className="mt-3 block">
              <Button variant="outline" size="full">
                Review goals
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <HomeBody />
    </Suspense>
  );
}
