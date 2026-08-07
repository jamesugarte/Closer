# Closer — calculation & recommendation logic

This document explains the prototype math in plain English so you can walk through it in an interview.

## Core idea

Traditional banking apps answer: **“How much money do I have?”**

Closer answers: **“How far away (in time) am I from what I want — and what’s the easiest way to get there sooner?”**

Dollars are converted into **days** using a transparent contribution rate.

---

## How the projected purchase date is calculated

Inputs:

- **Target price** — what the goal costs (e.g. $200)
- **Funded amount** — what’s already in the goal reserve (e.g. $164)
- **Daily contribution rate** — Maya’s mock savings pace toward goals (**$3 / day** in this demo)
- **Demo today** — fixed at **August 23, 2026** so interview numbers stay stable

Steps:

1. `remaining = targetPrice − fundedAmount` → `$200 − $164 = $36`
2. `daysNeeded = ceil(remaining ÷ dailyRate)` → used when creating **new** goals
3. Projected date = demo today + daysNeeded

For the seeded AirPods goal, the prototype starts with an explicit projected date of **September 28** (36 days away) so the storyboard matches the interview script. New goals use the formula above live.

Code: `src/lib/calculations.ts` → `remainingAmount`, `estimatedPurchaseDate`

---

## How “safe to spend” is calculated

This directly answers the brief’s student pain point (“how much can I safely spend?”), while staying mindful of goals **and** life shocks:

```
discretionaryPool   = checking + goalReserve − obligations
                    ≈ $1,680 + $164 − $935 = $909

earmarkedForGoals   = $200 (AirPods)
earmarkedRisk       = monthly budget + rollover − spent
                    = $80 + $40 − $0 = $120

freeToSpend         ≈ $909 − $200 − $120 = $589
```

Freshman protected bills (Maya’s student share after aid/family help):

| Obligation | Amount |
| --- | --- |
| Dorm housing | $420 |
| Campus meal plan | $310 |
| Tuition payment plan | $150 |
| Student loan | $55 |
| **Total** | **$935** |

Sophomore stays dorm + meal plan (slightly higher rates). Junior/senior switch to apartment rent + utilities + groceries; junior year seeds an **Apartment starter furniture** goal with Facebook Marketplace / thrift tips (dorm years had furniture included).

Risk cushion is still “safe after bills,” but spoken for unforeseen hits (flat tire, textbook) so those don’t raid goal progress.

### Quiet month → good-job bonus (recommend only)

If Maya doesn’t spend her risk budget, unused $ rolls forward. Closer may recommend moving a slice into her goal as a “good job” bonus — **nothing moves unless she accepts.**

Code: `safeSpendBreakdown`, `buildRiskProfile`, `simulateQuietMonth`

---

## How “need it by” sliding works

On Home and goal detail, Maya can drag a **Need by** handle earlier than the forecast:

1. **Forecast pin** = projected purchase at the current `$3/day` pace  
2. **Need by thumb** = the date she wants  
3. While sliding, a bubble shows **extra dollars to save**, **days sooner**, and **required $/day**  
4. Tips underneath are **re-ranked** for that gap (`gapFitScore`) so the best trade-offs to close it float up  

```
extraSavingsNeeded = remaining − (dailyRate × daysUntil(wantBy))
```

Code: `paceGapToDate`, `gapFitScore` in `src/lib/calculations.ts` · UI: `CloserCalendar`

---

## How a contribution changes the date

When Maya accepts a recommendation that saves **$18**:

1. Add **$18** to the goal reserve → `$164 → $182`
2. Recompute funding % → `$182 / $200 ≈ 91%`
3. Convert savings into time:  
   `daysGained ≈ savings ÷ dailyRate` → `$18 ÷ $3 = 6 days`
4. Move the projected date earlier by that many days → **Sept 28 → Sept 22**
5. Reduce checking (discretionary) by the same **$18** and increase the goal reserve total
6. Log the acceptance, contribution, and date change in Activity

Required obligations are **itemized and ring-fenced** before any goal move — see the freshman table above (meal plan included). Housing switches when the demo clock crosses into junior year.

Code: `src/context/AppContext.tsx` → `acceptRecommendation`  
Helpers: `shiftDateEarlier`, `daysFromSavings`, `fundingPercentage`

---

## How recommendations are ranked

Each recommendation has:

| Field | Meaning |
| --- | --- |
| `savingsAmount` | Dollars freed |
| `estimatedDaysGained` | Approximate days closer |
| `disruptionScore` | 1 (easy) → 5 (painful) |
| `lifestyleImpact` | Low / Medium / High copy |
| `status` | pending / accepted / rejected |

**Prototype score (not ML):**

```
score = (daysGained × 10) − (disruptionScore × 4) + (obligationsProtected ? 15 : −50)
```

Higher score surfaces first. In the demo, the campus shuttle tip ranks above coffee or delivery tips because it gains more days at very low disruption while keeping obligations protected.

Code: `src/lib/calculations.ts` → `recommendationScore`  
Seed + sort: `src/lib/mock-data.ts`

This is a **transparent scoring function for the prototype**, not a trained production model.

---

## Balance sheet & financial freedom

Closer tracks a simple **balance sheet** over the demo clock:

| Slice | What it is |
| --- | --- |
| Checking | Everyday cash |
| Goal reserves | Money already earmarked toward goals |
| Risk cushion | Shock buffer (monthly budget + rollover − spent) |
| Liquid assets | Checking + goals + risk |

**Financial freedom (0–100)** blends cushion after bills, free-to-spend share, goal funding progress, and risk health. Advancing months on Activity records a snapshot so Home can show the score climb as saving compounds.

Code: `src/lib/balance-sheet.ts` · UI: `BalanceSheetCard`

---

## Goal preference ranking & reallocation

Each goal has a **priority** (1 = Maya’s top preference). Creating a new goal as #1 demotes others. Monthly auto-save **weights toward higher ranks**.

If the previous goal still has reserved money, Closer may recommend **reallocation**: siphon a slice into the preferred goal — rearranging money already saved, not only cutting new spend. Nothing moves until Maya accepts.

Code: `src/lib/reallocation.ts` · `splitSavingsByPriority`

---

## Simulated months

Each `+1 month` on Activity:

1. Living spend + protected bills
2. Two biweekly campus-job deposits
3. Occasional small shock (risk cushion first)
4. Priority-weighted auto-save into goals
5. Risk floor top-up + rollover accounting
6. Balance-sheet snapshot (+ optional good-job tip)

---

## Which elements are simulated

- Bank balances, Venmo, Apple Cash, campus job deposits
- “AI” coach answers (deterministic templates from current state)
- Price opportunity / Campus Tech Store sale
- Purchase confirmation (no real payment rail)
- Recommendation personalization beyond accept/reject history in-session
- Demo clock (`demoToday`) advanced by Activity controls
- Month simulation (spend, bills, pay, auto-save, risk, freedom score)

Nothing connects to a real bank, retailer, or paid AI API. Persistence is **localStorage only**.

---

## How a production AI system could learn from user behavior

In production, Closer could:

1. **Log preference signals** — accepts, rejects, time-of-day, category (transport vs food), disruption tolerance
2. **Constraint-aware optimization** — never propose cuts that threaten rent, tuition, or minimum cash buffers (hard rules + model)
3. **Personal utility model** — learn that Maya will take shuttle tips but rejects skipping social dinners
4. **Causal time estimates** — replace flat `$ / day` with predicted discretionary cashflow from real transaction streams
5. **Multi-goal portfolio** — allocate spare cash across goals based on deadlines and stated priorities (prototype already demos ranking + reallocation)
6. **Explainability** — keep showing the same “save $X → gain Y days” narrative so trust stays high

The interview-ready takeaway: **start with transparent math and clear constraints; layer learning on top of user choices without hiding how time is estimated.**
