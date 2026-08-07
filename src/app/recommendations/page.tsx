"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { RecommendationCard } from "@/components/RecommendationCard";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { shiftDateEarlier } from "@/lib/calculations";
import type { Recommendation } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

function tipPriority(r: Recommendation): number {
  if (r.kind === "income_bridge") return 0;
  if (r.kind === "income_growth") return 1;
  if (r.category === "goal-health") return 2;
  if (r.kind === "portfolio") return 3;
  if (r.kind === "reallocation") return 4;
  if (r.kind === "surplus_allocation") return 5;
  if (r.kind === "good_job_bonus") return 6;
  return 7;
}

export default function RecommendationsPage() {
  const {
    state,
    hydrated,
    acceptRecommendation,
    rejectRecommendation,
    primaryGoal,
    goalHealth,
  } = useApp();

  const pending = useMemo(() => {
    return [...state.recommendations]
      .filter((r) => r.status === "pending")
      .sort((a, b) => tipPriority(a) - tipPriority(b));
  }, [state.recommendations]);

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
          Recommendations
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Ranked moves — cover bills, then earn more, then goal trade-offs. No
          tips that ask you to run bills short.
        </p>
      </header>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-5 text-sm text-[var(--muted)]">
          You&apos;re caught up. Advance time on the Master Key or add a goal to
          surface new tips.
          {!goalHealth.locked && (
            <Link href="/goals/new" className="mt-3 block">
              <Button variant="outline" size="full">
                Add a goal
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {pending.map((rec) => {
            const goal =
              state.goals.find((g) => g.id === rec.goalId) ?? primaryGoal;
            const feedback =
              state.activeRecommendationId === rec.id
                ? state.homeRecommendationFeedback
                : null;
            const newDateISO =
              !goal ||
              rec.kind === "income_bridge" ||
              rec.kind === "income_growth"
                ? state.demoToday
                : shiftDateEarlier(
                    goal.projectedPurchaseDate,
                    rec.estimatedDaysGained
                  );
            return (
              <li key={rec.id}>
                {goal && rec.kind !== "income_bridge" && (
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                    For {goal.name}
                    {rec.savingsAmount > 0
                      ? ` · ${formatMoney(rec.savingsAmount)}`
                      : ""}
                  </p>
                )}
                <RecommendationCard
                  recommendation={rec}
                  newDateISO={newDateISO}
                  feedback={feedback}
                  onAccept={() => acceptRecommendation(rec.id)}
                  onReject={() => rejectRecommendation(rec.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
