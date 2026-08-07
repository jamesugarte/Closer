"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { DemoBanner } from "@/components/DemoBanner";
import { GoalAdvisoryCard } from "@/components/GoalAdvisoryCard";
import { GoalArt } from "@/components/GoalArt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/AppContext";
import { assessGoalFeasibility } from "@/lib/goal-feasibility";
import type { GoalCategory } from "@/lib/types";
import { estimatedPurchaseDate } from "@/lib/calculations";
import { surplusAvailableForNewGoal } from "@/lib/surplus";
import { formatLongDate, formatMoney } from "@/lib/utils";

const CATEGORIES: GoalCategory[] = [
  "Technology",
  "Travel",
  "Fashion",
  "Experiences",
  "School",
  "Other",
];

export default function NewGoalPage() {
  const router = useRouter();
  const { createGoal, state, goalHealth, hydrated } = useApp();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [category, setCategory] = useState<GoalCategory>("Technology");
  const [prioritize, setPrioritize] = useState(true);
  const [timeSensitive, setTimeSensitive] = useState(false);

  useEffect(() => {
    if (hydrated && goalHealth.locked) {
      router.replace("/goals");
    }
  }, [hydrated, goalHealth.locked, router]);

  const priceNum = Number(price) || 0;
  const previewSurplus =
    priceNum > 0
      ? surplusAvailableForNewGoal(
          state.user,
          state.risk,
          state.goals.filter((g) => !g.purchased),
          priceNum,
          0
        )
      : 0;
  const previewDate =
    priceNum > 0
      ? estimatedPurchaseDate(
          0,
          priceNum,
          state.user.dailyContributionRate,
          state.demoToday,
          previewSurplus
        )
      : null;

  const otherActive = state.goals.filter((g) => !g.purchased);

  const advisory = useMemo(() => {
    if (priceNum <= 0) return null;
    return assessGoalFeasibility({
      targetPrice: priceNum,
      fundedAmount: 0,
      optionalTargetDate: targetDate || undefined,
      demoToday: state.demoToday,
      dailyContributionRate: state.user.dailyContributionRate,
      user: state.user,
      risk: state.risk,
      goals: otherActive,
      prioritize,
      goalName: name.trim() || "This goal",
    });
  }, [
    priceNum,
    targetDate,
    state.demoToday,
    state.user,
    state.risk,
    otherActive,
    prioritize,
    name,
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || priceNum <= 0 || goalHealth.locked) return;
    const id = createGoal({
      name: name.trim(),
      targetPrice: priceNum,
      category,
      optionalTargetDate: targetDate || undefined,
      prioritize,
      timeSensitive,
    });
    router.push(id ? "/goals" : "/goals");
  }

  if (hydrated && goalHealth.locked) {
    return (
      <div className="space-y-4">
        <DemoBanner />
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-rose-700">
            <Lock className="h-5 w-5" />
            <p className="font-display text-lg font-semibold">New goals locked</p>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Goal health is red. Approve trade-offs on your existing goals before
            adding another.
          </p>
          <Button size="full" onClick={() => router.push("/goals")}>
            Back to goals
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <DemoBanner />
        <h1 className="pt-2 font-display text-3xl font-semibold tracking-tight">
          New goal
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Closer estimates when you can get there — and reshuffles the portfolio
          when a larger goal (e.g. ~$2,000) takes #1.
        </p>
      </header>

      <Card className="flex items-center gap-3">
        <GoalArt category={category} name={name || "Preview"} />
        <div>
          <p className="font-display text-lg font-semibold">
            {name.trim() || "Your goal"}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {priceNum > 0 ? formatMoney(priceNum) : "Set a target"} · {category}
          </p>
          {previewDate && (
            <p className="mt-1 text-sm font-medium text-[var(--accent-deep)]">
              Est. {formatLongDate(previewDate)} at today&apos;s pace
            </p>
          )}
        </div>
      </Card>

      {advisory && <GoalAdvisoryCard advisory={advisory} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Goal name
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. February ski trip"
            className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-base outline-none ring-[var(--ring)] focus:ring-2"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Target price
          </span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              $
            </span>
            <input
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="1000"
              className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-8 pr-4 text-base outline-none ring-[var(--ring)] focus:ring-2"
            />
          </div>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Optional target date
          </span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => {
              const v = e.target.value;
              setTargetDate(v);
              if (v) setTimeSensitive(true);
              else setTimeSensitive(false);
            }}
            className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-base outline-none ring-[var(--ring)] focus:ring-2"
          />
          <span className="block text-[11px] text-[var(--muted)]">
            Add a date (e.g. February ski trip) to see likelihood vs. deadline —
            not just an open-ended estimate.
          </span>
        </label>

        {targetDate ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200/80">
            <input
              type="checkbox"
              checked={timeSensitive}
              onChange={(e) => setTimeSensitive(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-black/20"
            />
            <span className="text-sm leading-snug">
              <span className="font-semibold">Fixed deadline — can&apos;t move</span>
              <span className="mt-0.5 block text-[var(--muted)]">
                Like spring break or tickets. Closer will not push this date or
                raid its reserve for a flexible want. Leave unchecked if the
                date is a soft preference. (Car loans belong on protected bills,
                not as goals.)
              </span>
            </span>
          </label>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Category
          </legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${
                  category === c
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white text-foreground ring-1 ring-black/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        {otherActive.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--accent-soft)]/50 px-4 py-3">
            <input
              type="checkbox"
              checked={prioritize}
              onChange={(e) => setPrioritize(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-black/20"
            />
            <span className="text-sm leading-snug">
              <span className="font-semibold">Make this my #1 preference</span>
              <span className="mt-0.5 block text-[var(--muted)]">
                Auto-save and expected risk bonuses weight toward it. Feasibility
                updates above when you toggle this.
              </span>
            </span>
          </label>
        )}

        <Button type="submit" size="full" disabled={!name.trim() || priceNum <= 0}>
          Create goal
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="full"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </form>
    </div>
  );
}
