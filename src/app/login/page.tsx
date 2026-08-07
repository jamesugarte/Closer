"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Flame,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { runDiagnostic, type FinancialDiagnostic } from "@/lib/diagnostic";
import {
  enactPlanAndSimulateMonth,
  type EnactPlanResult,
} from "@/lib/enact-plan";
import {
  blankBlueprint,
  JORDAN_BLUEPRINT,
  MAYA_BLUEPRINT,
} from "@/lib/personas";
import {
  PROFILE_INTAKE_FIELDS,
  type ProfileBlueprint,
  type SpendPatternId,
} from "@/lib/profile-blueprint";
import type { GoalCategory, IncomeStream } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

type Step = "pick" | "custom" | "diagnostic" | "plan";

const SPEND_OPTIONS: { id: SpendPatternId; label: string }[] = [
  { id: "heavy_delivery", label: "Heavy delivery" },
  { id: "rideshare_habit", label: "Rideshare habit" },
  { id: "nightlife", label: "Nightlife" },
  { id: "gaming_micro", label: "Gaming microtransactions" },
  { id: "bnpl_shopping", label: "BNPL / Klarna" },
  { id: "coffee_stack", label: "Coffee stack" },
  { id: "subscription_creep", label: "Subscription creep" },
];

const GOAL_CATS: GoalCategory[] = [
  "Technology",
  "Travel",
  "Fashion",
  "Experiences",
  "Other",
];

export default function LoginPage() {
  const router = useRouter();
  const { enterWithState } = useApp();
  const [step, setStep] = useState<Step>("pick");
  const [custom, setCustom] = useState<ProfileBlueprint>(() => blankBlueprint());
  const [diagnostic, setDiagnostic] = useState<FinancialDiagnostic | null>(
    null
  );
  const [planResult, setPlanResult] = useState<EnactPlanResult | null>(null);

  function openDiagnostic(bp: ProfileBlueprint) {
    const result = runDiagnostic(bp);
    setDiagnostic(result);
    setPlanResult(null);
    setStep("diagnostic");
  }

  function enterApp(state = diagnostic?.appState) {
    if (!state) return;
    enterWithState(state);
    router.replace("/");
  }

  function runPlan(selectedIds: string[]) {
    if (!diagnostic) return;
    const result = enactPlanAndSimulateMonth(diagnostic, selectedIds);
    setPlanResult(result);
    setStep("plan");
  }

  return (
    <div className="h-dvh overflow-y-auto overscroll-contain">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8 sm:py-12">
        <header className="mb-8 text-center sm:mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Closer · demo intake
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {step === "pick" && "Who are we banking today?"}
            {step === "custom" && "Build a student profile"}
            {step === "diagnostic" && "Financial diagnostic"}
            {step === "plan" && "One month later"}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            {step === "pick" &&
              "Pick a persona or invent one. You’ll get an instant diagnostic before entering the app."}
            {step === "custom" &&
              "These are the inputs Closer needs to spin up a realistic student ledger and goals."}
            {step === "diagnostic" &&
              "Pick recommendations to enact, then simulate a month to see health improve — or enter as-is."}
            {step === "plan" &&
              "Same student, after following the plan for a month. Enter Closer mid-recovery."}
          </p>
        </header>

        {step === "pick" && (
          <PickStep
            onMaya={() => openDiagnostic(MAYA_BLUEPRINT)}
            onJordan={() => openDiagnostic(JORDAN_BLUEPRINT)}
            onCustom={() => {
              setCustom(blankBlueprint());
              setStep("custom");
            }}
          />
        )}

        {step === "custom" && (
          <CustomIntakeForm
            value={custom}
            onChange={setCustom}
            onBack={() => setStep("pick")}
            onRun={() => openDiagnostic(custom)}
          />
        )}

        {step === "diagnostic" && diagnostic && (
          <DiagnosticView
            diagnostic={diagnostic}
            onBack={() => setStep("pick")}
            onSkip={() => enterApp(diagnostic.appState)}
            onEnact={runPlan}
          />
        )}

        {step === "plan" && planResult && diagnostic && (
          <PlanResultView
            diagnostic={diagnostic}
            result={planResult}
            onBack={() => setStep("diagnostic")}
            onEnter={() => enterApp(planResult.appState)}
          />
        )}
      </div>
    </div>
  );
}

function PickStep({
  onMaya,
  onJordan,
  onCustom,
}: {
  onMaya: () => void;
  onJordan: () => void;
  onCustom: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <PersonaCard
        name="Maya"
        badge="On track"
        badgeTone="ok"
        tagline={MAYA_BLUEPRINT.tagline}
        story={MAYA_BLUEPRINT.lifeSituation}
        icon={<Sparkles className="h-5 w-5" />}
        stats={[
          ["Checking", formatMoney(MAYA_BLUEPRINT.checkingBalance)],
          ["Burn / day", formatMoney(MAYA_BLUEPRINT.typicalDiscretionaryPerDay)],
          ["Auto-save", `${formatMoney(MAYA_BLUEPRINT.dailyContributionRate)}/d`],
        ]}
        onSelect={onMaya}
      />
      <PersonaCard
        name="Jordan"
        badge="Course correct"
        badgeTone="warn"
        tagline={JORDAN_BLUEPRINT.tagline}
        story={JORDAN_BLUEPRINT.lifeSituation}
        icon={<Flame className="h-5 w-5" />}
        stats={[
          ["Checking", formatMoney(JORDAN_BLUEPRINT.checkingBalance)],
          ["Burn / day", formatMoney(JORDAN_BLUEPRINT.typicalDiscretionaryPerDay)],
          ["Auto-save", "$0/d"],
        ]}
        onSelect={onJordan}
      />
      <button
        type="button"
        onClick={onCustom}
        className="sm:col-span-2 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-black/15 bg-white/50 px-5 py-4 text-left transition hover:border-accent/40 hover:bg-white/80"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold">Custom student</p>
            <p className="mt-0.5 text-sm text-muted">
              Fill every intake field yourself — identity, cash, income, goals,
              spend patterns.
            </p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-accent" />
      </button>

      <details className="sm:col-span-2 rounded-2xl border border-black/8 bg-white/60 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-foreground">
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-accent" />
            Profile intake fields (what we collect)
          </span>
        </summary>
        <div className="mt-3 space-y-3 border-t border-black/5 pt-3">
          {PROFILE_INTAKE_FIELDS.map((group) => (
            <div key={group.group}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                {group.group}
              </p>
              <ul className="mt-1 space-y-0.5 text-muted">
                {group.fields.map((f) => (
                  <li key={f.key}>
                    <span className="text-foreground">{f.label}</span>
                    {f.required ? (
                      <span className="text-danger"> *</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function PersonaCard({
  name,
  badge,
  badgeTone,
  tagline,
  story,
  icon,
  stats,
  onSelect,
}: {
  name: string;
  badge: string;
  badgeTone: "ok" | "warn";
  tagline: string;
  story: string;
  icon: React.ReactNode;
  stats: [string, string][];
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col rounded-2xl border border-black/8 bg-white/80 p-5 text-left shadow-sm transition hover:border-accent/35 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
          {icon}
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            badgeTone === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
          )}
        >
          {badge}
        </span>
      </div>
      <h2 className="font-display mt-3 text-2xl font-semibold">{name}</h2>
      <p className="mt-1 text-xs font-medium text-accent">{tagline}</p>
      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted">
        {story}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-black/5 pt-3">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] uppercase tracking-wide text-muted">{k}</dt>
            <dd className="text-sm font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent group-hover:gap-2">
        Run diagnostic <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function CustomIntakeForm({
  value,
  onChange,
  onBack,
  onRun,
}: {
  value: ProfileBlueprint;
  onChange: (next: ProfileBlueprint) => void;
  onBack: () => void;
  onRun: () => void;
}) {
  const goal = value.goals[0] ?? {
    name: "Primary goal",
    targetPrice: 250,
    fundedAmount: 0,
    category: "Other" as GoalCategory,
    priority: 1,
  };

  const canRun = useMemo(
    () => value.name.trim().length > 0 && goal.name.trim().length > 0,
    [value.name, goal.name]
  );

  const patch = (partial: Partial<ProfileBlueprint>) =>
    onChange({ ...value, ...partial });

  const setGoal = (g: Partial<typeof goal>) =>
    patch({ goals: [{ ...goal, ...g, priority: 1 }] });

  const setStream = (idx: number, partial: Partial<IncomeStream>) => {
    const streams = [...value.incomeStreams];
    streams[idx] = { ...streams[idx], ...partial };
    patch({ incomeStreams: streams });
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to personas
      </button>

      <Section title="Identity">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name *">
            <input
              className={inputCls}
              value={value.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Alex"
            />
          </Field>
          <Field label="Age">
            <input
              type="number"
              className={inputCls}
              value={value.age}
              onChange={(e) => patch({ age: Number(e.target.value) || 18 })}
            />
          </Field>
          <Field label="College year">
            <select
              className={inputCls}
              value={value.collegeYear}
              onChange={(e) =>
                patch({
                  collegeYear: Number(e.target.value) as 1 | 2 | 3 | 4,
                })
              }
            >
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Demo today">
            <input
              type="date"
              className={inputCls}
              value={value.demoToday}
              onChange={(e) => patch({ demoToday: e.target.value })}
            />
          </Field>
          <Field label="Life situation" className="sm:col-span-2">
            <textarea
              className={cn(inputCls, "min-h-[72px]")}
              value={value.lifeSituation}
              onChange={(e) => patch({ lifeSituation: e.target.value })}
              placeholder="Housing, job, parental help, pressure points…"
            />
          </Field>
        </div>
      </Section>

      <Section title="Cash position">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumField
            label="Checking $"
            value={value.checkingBalance}
            onChange={(n) => patch({ checkingBalance: n })}
          />
          <NumField
            label="Goal reserve $"
            value={value.goalReserveBalance}
            onChange={(n) => patch({ goalReserveBalance: n })}
          />
          <NumField
            label="Risk cushion $"
            value={value.riskReserveBalance}
            onChange={(n) => patch({ riskReserveBalance: n })}
          />
          <NumField
            label="Daily auto-save $"
            value={value.dailyContributionRate}
            onChange={(n) => patch({ dailyContributionRate: n })}
          />
          <NumField
            label="Discretionary $/day"
            value={value.typicalDiscretionaryPerDay}
            onChange={(n) => patch({ typicalDiscretionaryPerDay: n })}
          />
          <NumField
            label="Risk monthly budget $"
            value={value.riskMonthlyBudget ?? 100}
            onChange={(n) => patch({ riskMonthlyBudget: n })}
          />
        </div>
      </Section>

      <Section title="Income">
        <div className="space-y-3">
          {value.incomeStreams.map((s, idx) => (
            <div
              key={s.id}
              className="grid gap-2 rounded-xl border border-black/5 bg-black/[0.02] p-3 sm:grid-cols-4"
            >
              <Field label="Label">
                <input
                  className={inputCls}
                  value={s.label}
                  onChange={(e) => setStream(idx, { label: e.target.value })}
                />
              </Field>
              <NumField
                label="Amount $"
                value={s.amount}
                onChange={(n) => setStream(idx, { amount: n })}
              />
              <Field label="Cadence">
                <select
                  className={inputCls}
                  value={s.cadence}
                  onChange={(e) =>
                    setStream(idx, {
                      cadence: e.target.value as IncomeStream["cadence"],
                    })
                  }
                >
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="semester">Semester</option>
                </select>
              </Field>
              <Field label="Lands in checking">
                <select
                  className={inputCls}
                  value={s.landsInChecking ? "yes" : "no"}
                  onChange={(e) =>
                    setStream(idx, {
                      landsInChecking: e.target.value === "yes",
                    })
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No (aid credit)</option>
                </select>
              </Field>
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField
              label="Next paycheck $"
              value={value.nextPaycheckAmount}
              onChange={(n) => patch({ nextPaycheckAmount: n })}
            />
            <Field label="Next paycheck date">
              <input
                type="date"
                className={inputCls}
                value={value.nextPaycheckDate}
                onChange={(e) => patch({ nextPaycheckDate: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Primary goal">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Goal name *" className="sm:col-span-2">
            <input
              className={inputCls}
              value={goal.name}
              onChange={(e) => setGoal({ name: e.target.value })}
            />
          </Field>
          <NumField
            label="Target price $"
            value={goal.targetPrice}
            onChange={(n) => setGoal({ targetPrice: n })}
          />
          <NumField
            label="Funded so far $"
            value={goal.fundedAmount}
            onChange={(n) => setGoal({ fundedAmount: n })}
          />
          <Field label="Category">
            <select
              className={inputCls}
              value={goal.category}
              onChange={(e) =>
                setGoal({ category: e.target.value as GoalCategory })
              }
            >
              {GOAL_CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deadline (optional)">
            <input
              type="date"
              className={inputCls}
              value={goal.optionalTargetDate ?? ""}
              onChange={(e) =>
                setGoal({
                  optionalTargetDate: e.target.value || undefined,
                })
              }
            />
          </Field>
        </div>
      </Section>

      <Section title="Spend patterns">
        <div className="flex flex-wrap gap-2">
          {SPEND_OPTIONS.map((opt) => {
            const on = value.spendPatterns.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const next = on
                    ? value.spendPatterns.filter((p) => p !== opt.id)
                    : [...value.spendPatterns, opt.id];
                  patch({ spendPatterns: next });
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  on
                    ? "border-accent bg-accent-soft text-accent-deep"
                    : "border-black/10 bg-white text-muted hover:border-black/20"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={value.useCollegePhaseDefaults}
            onChange={(e) =>
              patch({ useCollegePhaseDefaults: e.target.checked })
            }
          />
          Use dorm/apartment obligation defaults for college year
        </label>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-4">
        <p className="text-xs text-muted">
          Arc defaults to course-correct for custom profiles.
        </p>
        <button
          type="button"
          disabled={!canRun}
          onClick={onRun}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-deep disabled:opacity-40"
        >
          Run diagnostic <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DiagnosticView({
  diagnostic,
  onBack,
  onSkip,
  onEnact,
}: {
  diagnostic: FinancialDiagnostic;
  onBack: () => void;
  onSkip: () => void;
  onEnact: (selectedIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(diagnostic.recommendations.map((r) => r.id))
  );

  const gradeColor =
    diagnostic.grade === "A" || diagnostic.grade === "B"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : diagnostic.grade === "C"
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : "text-rose-700 bg-rose-50 border-rose-200";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Choose someone else
      </button>

      <div className="rounded-2xl border border-black/8 bg-white/85 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {diagnostic.arc === "course_correct"
                ? "Course correction needed"
                : "Healthy trajectory"}
            </p>
            <h2 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">
              {diagnostic.name}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {diagnostic.headline}
            </p>
          </div>
          <div
            className={cn(
              "flex h-16 w-16 flex-col items-center justify-center rounded-2xl border",
              gradeColor
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">
              Grade
            </span>
            <span className="font-display text-2xl font-bold leading-none">
              {diagnostic.grade}
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          {diagnostic.summary}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Freedom score" value={`${diagnostic.freedomScore}`} />
          <Stat
            label="Cashflow / mo"
            value={formatMoney(diagnostic.monthlyCashflow)}
          />
          <Stat
            label="Liquid in / mo"
            value={formatMoney(diagnostic.liquidMonthly)}
          />
          <Stat
            label="Net bills / mo"
            value={formatMoney(diagnostic.netObligations)}
          />
        </dl>
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Cashflow = liquid income − protected bills
          {diagnostic.monthlyCashflow < 0
            ? ` (${formatMoney(diagnostic.monthlyCashflow)}). Free-to-spend stock is ${formatMoney(diagnostic.freeToSpend)} — leftover balances, not a surplus.`
            : `. Free-to-spend stock ${formatMoney(diagnostic.freeToSpend)}.`}
        </p>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold">Findings</h3>
        <ul className="mt-3 space-y-2">
          {diagnostic.findings.map((f) => (
            <li
              key={f.id}
              className="flex gap-3 rounded-xl border border-black/6 bg-white/70 px-3 py-3"
            >
              <SeverityIcon severity={f.severity} />
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {f.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">
            Enact recommendations
          </h3>
          <p className="text-xs text-muted">
            {selected.size} selected · simulate +1 month after apply
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          {diagnostic.recommendations.map((r, i) => {
            const on = selected.has(r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  className={cn(
                    "flex w-full gap-3 rounded-xl border px-4 py-3 text-left transition",
                    on
                      ? "border-accent/35 bg-accent-soft/50"
                      : "border-black/8 bg-white/60 opacity-70"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold",
                      on
                        ? "border-accent bg-accent text-white"
                        : "border-black/20 bg-white text-transparent"
                    )}
                  >
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-accent-deep">
                      {i + 1}. {r.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {r.detail}
                    </p>
                    {r.monthlyImpact != null ? (
                      <p className="mt-1.5 text-[11px] font-semibold text-accent">
                        ~{formatMoney(r.monthlyImpact)}/mo impact if followed
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 bg-[linear-gradient(180deg,transparent,rgba(247,245,242,0.95)_30%)] pt-4">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          Skip — enter as-is
        </button>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onEnact([...selected])}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-deep disabled:opacity-40"
        >
          Enact &amp; simulate +1 mo <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PlanResultView({
  diagnostic,
  result,
  onBack,
  onEnter,
}: {
  diagnostic: FinancialDiagnostic;
  result: EnactPlanResult;
  onBack: () => void;
  onEnter: () => void;
}) {
  const { before, after } = result;
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Adjust recommendations
      </button>

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white p-5 shadow-sm sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/70">
          After {result.enacted.length} tip
          {result.enacted.length === 1 ? "" : "s"} · clock → {result.monthLabel}
        </p>
        <h2 className="font-display mt-1 text-2xl font-semibold text-emerald-950">
          {diagnostic.name}&apos;s course correction is working
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-950/70">
          Enacted habits stick into the live app — lower burn, real auto-save,
          rebuilt cushion — so Home health checks look different than day one.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CompareCard
          label="Before (diagnostic day)"
          tone="before"
          grade={before.grade}
          freedom={before.freedomScore}
          free={before.freeToSpend}
          burn={before.burnDaily}
          autosave={before.dailyAutoSave}
          risk={before.riskReserve}
        />
        <CompareCard
          label="After +1 month on plan"
          tone="after"
          grade={after.grade}
          freedom={after.freedomScore}
          free={after.freeToSpend}
          burn={after.burnDaily}
          autosave={after.dailyAutoSave}
          risk={after.riskReserve}
        />
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold">What changed</h3>
        <ul className="mt-3 space-y-2">
          {result.narrative.map((line, i) => (
            <li
              key={`${i}-${line.slice(0, 24)}`}
              className="flex gap-2 rounded-xl border border-black/6 bg-white/70 px-3 py-2.5 text-sm text-foreground/90"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="sticky bottom-4 flex justify-end pt-2">
        <button
          type="button"
          onClick={onEnter}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-deep"
        >
          Enter Closer · improved state <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CompareCard({
  label,
  tone,
  grade,
  freedom,
  free,
  burn,
  autosave,
  risk,
}: {
  label: string;
  tone: "before" | "after";
  grade: string;
  freedom: number;
  free: number;
  burn: number;
  autosave: number;
  risk: number;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "after"
          ? "border-emerald-200 bg-white/90"
          : "border-black/8 bg-white/70"
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="font-display mt-1 text-3xl font-bold">{grade}</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Freedom</dt>
          <dd className="font-semibold tabular-nums">{freedom}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Free to spend</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(free)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Burn / day</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(burn)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Auto-save / day</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(autosave)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Risk cushion</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(risk)}</dd>
        </div>
      </dl>
    </div>
  );
}

function SeverityIcon({
  severity,
}: {
  severity: "critical" | "warn" | "ok" | "info";
}) {
  if (severity === "critical" || severity === "warn") {
    return (
      <AlertTriangle
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          severity === "critical" ? "text-rose-600" : "text-amber-600"
        )}
      />
    );
  }
  return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/8 bg-white/75 p-4 sm:p-5">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-xs font-medium text-muted", className)}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={inputCls}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </Field>
  );
}

const inputCls =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-foreground outline-none ring-accent focus:ring-2";
