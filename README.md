# Closer

**Closer** is an AI-powered banking prototype for college students. Traditional apps show balances. Closer converts dollars into **time** — how far you are from what you want, and the lowest-friction ways to get there sooner.


> Demo environment — simulated financial data only. No real banks, payments, auth, or paid APIs.

## What the product does

- Surfaces a primary savings goal (AirPods Pro) as a **projected purchase date**, not just a balance
- Recommends personalized, low-disruption trade-offs (e.g. campus shuttle instead of Uber)
- When accepted: moves money into the goal reserve, updates funding %, animates the date earlier, and logs Activity
- Includes Coach Q&A, goal creation, a simulated sale → completion → purchase confirmation flow
- Persists demo state in `localStorage` with a one-click **Reset demo**

## Install

Requires **Node.js 18+** and npm.

```bash
cd closer
npm install
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use a phone-width viewport for the intended experience (the UI is centered in a phone shell on desktop).

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Framework preset: **Next.js** (defaults are fine)
4. Click **Deploy**

Or from the CLI:

```bash
npm i -g vercel
vercel
```

No environment variables or API keys are required.

## 90-second demo sequence

1. **Home (0:00–0:20)** — Greeting for Maya. Point at AirPods card: **82%**, projected **September 28**. Show **$900** after bills with **$200 goals + $120 risk** earmarked → **~$580 free to spend**.
2. **Recommendation (0:20–0:40)** — Read shuttle tip: save **$18**, new date **September 22**, low impact. Tap **Gain 6 days**. Watch reserve → **$182**, progress → **91%**, date animate to **September 22**, success copy appear.
3. **Goals (0:40–0:55)** — Open AirPods detail. Show charging meter, timeline (original Sept 28 → current Sept 22), contributions + recommendation history.
4. **Sale (0:55–1:10)** — Tap **Simulate price opportunity**. Price **$200 → $180**, funding hits **100%**, date becomes **Today**. Tap **Review purchase**.
5. **Purchase (1:10–1:25)** — Confirm simulated purchase at Campus Tech Store. Show **Goal achieved** / days earlier messaging.
6. **Coach or Activity (1:25–1:30)** — Optional: ask “Why did my date change?” or scroll Activity + mention **Reset demo**.

Tip: If state is mid-demo from a prior run, open **Activity → Reset demo** first.

## What is functional

- Four tabs: Home, Goals, Coach, Activity
- Accept / reject recommendations with persistence
- Goal create flow with category-based art
- Sale simulation, purchase confirmation, completion state
- Deterministic Coach answers from live mock state
- localStorage persistence + reset
- Transparent scoring & date math (`src/lib/calculations.ts`)

## What is simulated

- All balances, paychecks, Venmo, Apple Cash
- Coach “AI” (rules + templates, no LLM API)
- Retailer sale and purchase (Campus Tech Store is fictional)
- Bank connectivity and authentication
- Live market prices

## Production integration possibilities

- Open banking / Plaid-style account aggregation
- Core banking ledger for goal sub-accounts / pots
- Card transaction categorization to detect Uber, delivery fees, etc.
- Real-time offer networks for student retail partners
- Reinforcement or preference learning from accept/reject signals (see `LOGIC.md`)
- Push notifications when a trade-off would meaningfully move a date

## Project structure (high level)

```
src/app/           # App Router screens
src/components/    # UI (phone shell, meters, cards)
src/context/       # App state + localStorage
src/lib/           # Types, mock data, calculations
LOGIC.md           # Interview explanation of the math
```

## AI tool used to build it

This prototype was built with **[Cursor](https://cursor.com)**.

## License

Interview / portfolio prototype — not a production banking product.
