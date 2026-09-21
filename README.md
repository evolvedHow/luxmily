# Luxmi.ly — Budget Optima

A top-down, benchmark-guided **budget optimizer** — not an expense tracker. It
never records day-to-day spending, and there is no place to enter it. One number
you can live within — your take-home pay — then seven themes seeded from
BLS/FRED/Vanguard benchmarks keyed to your income cohort, and a **pII** that
tells you what inflation rate *that particular allocation* is running at.
Mobile-first, ink-dark, no backend, no account linking. State lives in
`localStorage`.

```bash
npm install
npm run dev      # → http://localhost:5180 (LAN-reachable: `vite` binds 0.0.0.0)
npm test         # engine + pII + export + render smoke tests
npm run build    # tsc -b && vite build → dist/
```

## The idea

Budgeting normally asks you to name every line item first, then tally what you
already spent. This app does neither:

1. **Income & take-home** are the two mandatory answers. Income picks the cohort.
2. **Themes** (Housing, Food, Transportation, Healthcare, Savings & Retirement,
   Travel, Other) hold the categories. Dollars are the model; a theme's
   percentage is simply its total over the cap.
3. **Themes and categories move together.** Drag a theme and the change is
   **prorated across its categories** in proportion to what they already hold —
   if Rent is 54% of Housing, it takes 54% of the change. Type a category
   directly and its theme follows.
4. **Lock what is already decided.** Pin any category or a whole theme and it
   sits out every resize; the remaining unlocked lines absorb the change,
   prorated. Each theme has a **Reset** that restores its benchmark seeding.
5. **Pay yourself first** — 401(k)/Roth/emergency — sits on its own strip with
   benchmark rails, so savings is never the leftover.
6. **Travel is a first-class theme** — a "well-lived life" allowance, carved out
   of Other, ramping with income. Airfare, Lodging, Rental Cars & Rideshare.
7. **pII** re-prices the plan against official CPI-U data, so the allocation
   carries a forward-looking cost as well as a present one.

## The holding bucket

Trimming a category does not shrink your money — it frees it. Money not
assigned to any category sits in **Available to allocate** on the cap card and
waits there. Raise another line and it gets drawn down; press **→ Emergency
buffer** and it is banked instead.

Themes never quietly rebalance against each other. Raising Housing does not
shrink Food; it draws from the bucket. That is the one rule that makes every
other number on screen trustworthy: **nothing moves unless you move it.**

The bucket starts non-empty whenever your take-home exceeds what your cohort's
benchmarks actually spend — that surplus is real, discretionary money, and the
app says so rather than silently inflating the categories to absorb it.

Only one line can be crossed: the cap. Allocate past your take-home and the
bucket goes negative and turns red, naming the shortfall. Nothing is rewritten
for you.

### What this app deliberately does not do

No actuals. No MTD, no pacing, no day-of-month, no "what did you spend on
groceries", no transaction import, no receipts, no historical spend. Every
number on screen is either a benchmark, a plan you set, or something derived
from those two. If a feature would require knowing what you actually spent, it
does not belong here.

There is also no viewpoint switcher. "Top-down" and "planned" used to be two
independent models of the same money; they are one model now — dollars up,
percentages derived — so there is nothing left to toggle between.

## pII — the personal Inflation index

The lowercase `p` is deliberate: **pII**, not PII. It has nothing to do with
personally identifiable information.

Headline CPI describes a national average household — roughly **41% housing,
14% food, 13% transportation**. Those weights *are* the number. If you own your
home outright and allocate 6% to housing, the shelter inflation driving the
headline barely touches you, and the reported figure is describing someone
else's life.

pII keeps the **official BLS price data** and swaps out **only the weights**,
substituting your own allocation:

```
pII = Σ ( weightline × inflationline )      weightline = line plan ÷ covered plan
```

1. **Map** each budget line to its CPI-U series — Rent/Mortgage → `Shelter`,
   Groceries → `Food at home`, Gasoline → `Motor fuel`. A few lines blend two
   series (a car payment is part new-vehicle, part used-car); a few with no
   clean counterpart use a flat assumed rate, labelled as such.
2. **Exclude savings.** 401(k), Roth, emergency and investments are not
   consumption — money saved does not get repriced.
3. **Weight by your dollars**, not the nation's.
4. **Reprice and sum** each series' 12-month change.

The card shows your current rate, the rate **as originally seeded** from the
benchmarks (so you can see how far your edits moved it), your weight beside
CPI's own weight per theme (both renormalized
over the same set of lines, so both add to 100%), each theme's inflation rate,
and the gap between your pII and the headline. The ⓘ button on the card opens a
full walk-through of the math **using your own numbers**, plus its honest
limits. Practical reading: pII is the raise you need next year just to stand
still.

Data is an **embedded BLS CPI-U snapshot** (`src/pi/bls/data.ts`, U.S. city
average, not seasonally adjusted) — offline, no API key, nothing about your
budget leaves the browser. Known limits, all stated in the UI: rates are
national rather than local (your ZIP localizes benchmark *dollars*, not these
rates); the mapping is coarse (a phone line is priced off the whole
`Education and communication` series, which also carries tuition); and
custom-rate lines are assumptions, not measurements.

## Data sources — linked, per theme box

Every guide number lives in `src/data/benchmarks.ts`, tagged with its source and
link. Each theme's box lists the distinct sources behind its numbers, and the
savings theme mixes all three:

- **BLS Consumer Expenditure Survey 2024** — spend shares and category averages
  by income quintile (6 cohorts, `c1`–`c6`). [bls.gov/cex](https://www.bls.gov/cex/tables.htm)
- **FRED PSAVERT** — U.S. personal saving rate rails for the emergency buffer.
  [fred.stlouisfed.org/series/PSAVERT](https://fred.stlouisfed.org/series/PSAVERT)
- **Vanguard How America Saves** — typical 401(k)/IRA contribution rails.
  [How America Saves](https://institutional.vanguard.com/HAS/How-America-Saves.html)
- **BLS CPI-U** — the price series behind pII. [bls.gov/cpi](https://www.bls.gov/cpi/)

Medians are shown only where a median is actually published (e.g. Vanguard IRA
contributions); where only a mean exists the UI says so instead of inventing a
number.

## Architecture

```
src/engine/       pure TypeScript — no React, no DOM, no side effects
  types.ts          domain model
  prorate.ts        proportional redistribution with locks (replaced solver.ts)
  resolve.ts        the single entry point the UI calls
  model.ts          scaffold: benchmarks → starting plan (COLA-aware)
src/pi/           pII — personal Inflation index (pure, offline)
  personalCpi.ts    budget line → CPI-U mapping, reweighting, theme rollup
  blsMetadata.ts    CPI-U series taxonomy + official relative importances
  bls/data.ts       embedded CPI-U observations (generated — do not hand-edit)
  period.ts         "YYYY-MM" arithmetic
src/data/         benchmarks.ts (cohorts, themes, shares, sources + links)
                  context.ts  (About sheet: US-income standing + net worth refs)
                  metro-cola.ts (ZIP → area: cost-of-living, rent factor, median income)
src/store/        useBudget.ts (zustand + localStorage: luxmily-budget-v2)
                  owns every mutation: proration, locks, theme reset, sweep
src/export/       JSON, CSV (Google Sheets), print/PDF — all carry pII
src/advisor/      Luxmi's client-side plumbing
  luxmi.yaml        PRIVATE operator prompt + model params (not in the UI)
  config.ts         typed YAML loader with safe defaults
  prompt.ts         user prompt = the app's own exported JSON (same file you download)
  worker.ts         client for the Cloudflare Worker (SSE streaming + /api/balance)
src/components/   UI (incl. PiiCard + PiiSheet, AdvisorSheet, AboutSheet)
worker/           Cloudflare Worker + Durable Object (Workers AI proxy + budget ledger)
```

`engine/` and `pi/` import nothing from React. Every number on screen comes from
one call to `resolve(budget)`, and pII from one call to `currentPersonalCpi(r)` —
there is no allocation or inflation math in any component. `resolve` is
strictly read-only: it reports, it never redistributes. Every mutation is a
deliberate user action handled in the store via `prorate`. That split is what
keeps the model testable in isolation.

## Your area (ZIP → cost of living)

An optional ZIP localizes every benchmark to where you live. The dollar lines
scale with that area's **cost of living** (vs US = 1.00), and the Rent/Mortgage
rail carries the area's **rent factor** too — so NYC rent starts ~1.9× national
while Marietta, GA stays ~1.1×. The cap card then answers "where do I fit?": your
income percentile by US household income, plus ≈% of your local median income.
The data (`src/data/metro-cola.ts`) is an **approximate, ZIP3-level regional guide**
synthesized from BEA Regional Price Parities and ACS 5-year medians — deterministic
and offline (no API key, works on a static site). It's always labelled
"approximate"; swap the file for a live provider behind the same
`locationForZip` shape if per-ZIP precision ever matters.

Note this scales **dollars**, not inflation rates: pII stays national.

## About

The ⓘ button in the header opens the About sheet — the one-screen pitch for how
the app thinks: top-down (a cap, then themed shares, then categories),
pay-yourself-first rails, no credit-card debt, red-as-information, and averages
as reference, never a mandate. It also shows (approximate, clearly labelled)
where the user's income cohort stands among US households and where the familiar
"top 10% / top 1%" net-worth lines sit in dollars — with sources.

## Publishing

`main` → GitHub Actions → GitHub Pages via `.github/workflows/deploy.yml`
(`VITE_BASE=/luxmily/`) → https://evolvedhow.github.io/luxmily/. The print/
"Save as PDF" report and the CSV export are browser-native; there is no server.

## Luxmi — the AI budget advisor

The ✨ button calls Luxmi, an LLM that reads your **entire budget as the exact
JSON the app exports** (`toJSON`) and writes a narrative: balance, theme-by-
theme benchmark comparison, pay-yourself-first health, what the pII says about
how this basket is inflating, anomalies, and 3–7 dollar-level tips.

The request flows through a **Cloudflare Worker** that proxies to **Cloudflare
Workers AI** (OpenAI-compatible Chat Completions). The Cloudflare API token is
held as a Worker secret — the browser never sees an API key.

```
browser (GitHub Pages)
  → Cloudflare Worker (worker/)   holds the Workers AI API token as a secret
    → Cloudflare Workers AI       runs the model via OpenAI-compatible Chat Completions
```

The model, budget, and per-1M-token prices are **operator config on the Worker**
(`CFAI_MODEL`, `CFAI_BUDGET_USD`, `CFAI_IN_PRICE`, `CFAI_OUT_PRICE`) — see
`worker/README.md`.

**⚠️ The worker endpoint is unauthenticated.** A static Pages frontend has
nowhere to hide a credential, so anyone who learns the worker URL can spend your
Workers AI allowance. The worker mitigates but cannot solve this: it pins the
model server-side, caps `max_tokens`, refuses requests once `CFAI_BUDGET_USD` is
exhausted, and honours an `ALLOWED_ORIGINS` allowlist (defaults to `*` — **set
it in production**). For real protection put Cloudflare Access or WAF
rate-limiting in front of the worker.

**AI budget on the dashboard:** the header shows "≈ $X left of $Y AI budget".
Workers AI exposes no live balance API (usage is billed in neurons, $0.011/1k,
with a 10,000/day free allowance), so the Worker keeps a **Durable Object
ledger**: each request's estimated cost (from usage tokens × price rates, or a
chars/4 fallback when Workers AI doesn't echo usage) is accumulated against the
budget you set in `CFAI_BUDGET_USD`. The ✨ dialog shows the same estimate for
the current request and the remaining balance. All figures are estimates —
tune the prices.

**Private operator config — the prompt & model params:** Luxmi's system prompt
and generation parameters live in **`src/advisor/luxmi.yaml`**. It is compiled
into the bundle at build time and is **not shown or editable in the app UI**.
Edit `system`, `temperature`, `max_tokens`, then commit + push — the Pages
deploy rebuilds with your prompt. A YAML syntax error falls back to a stub
prompt and logs loudly to the console — check there if Luxmi sounds generic.

**To change the model on the live site:** set `CFAI_MODEL` on the deployed
Worker via the Cloudflare dashboard (or edit `worker/wrangler.toml` and redeploy
from `worker/`). Rebuild the frontend only if you change the Worker URL or the
prompt.

## Luxmi — troubleshooting

- **"Luxmi worker not configured"** ⇒ `VITE_LUXMI_WORKER` isn't set in the
  build that's running. For the Pages site it comes from the `LUXMI_WORKER_URL`
  repository variable (set in Settings → Secrets and variables → Actions). For
  local dev, use a `.env` file: `VITE_LUXMI_WORKER=http://localhost:8787`.
- **Luxmi's replies feel generic** ⇒ `luxmi.yaml` may have failed to parse; the
  loader falls back to a one-line stub prompt. Open the browser console and look
  for `[luxmi] luxmi.yaml failed to parse`.
- **Worker returns 401 / 403** ⇒ Workers AI is rejecting the API token. Recreate
  a token with the "Workers AI — Edit" permission and set it on the Worker:
  `echo "<token>" | npx wrangler secret put CF_AI_API_TOKEN` (and `CF_ACCOUNT_ID`
  too if you haven't) — then re-deploy with `npx wrangler deploy` from `worker/`.
  A 403 with `origin not allowed` instead means `ALLOWED_ORIGINS` doesn't list
  the site's origin.
- **Worker returns 429 "AI budget exhausted"** ⇒ the ledger has reached
  `CFAI_BUDGET_USD`. Raise it, or reset the Durable Object.
- **Worker returns 404 / 400 "model not found"** ⇒ `CFAI_MODEL` isn't a model
  id that exists on Workers AI — check the model catalog (`@cf/...`).
- **Balance shows the full budget** ⇒ either no requests have run yet, or the
  Durable Object ledger can't connect (local `wrangler dev` needs `--local`).
- **Check the worker is alive:** `curl https://<your-worker>.workers.dev/api/balance`
  — should return `{ "budgetUsd":…, "spentUsd":…, "balanceUsd":… }`.

## Play with the model

1. Enter income (watch the cohort rail + your US income percentile appear),
   add your ZIP to localize the averages (optional), build.
2. Drag **Housing** up — watch the increase land on Rent, Utilities and
   Maintenance in proportion, while every other theme stays exactly where it
   was and the holding bucket pays for it.
3. Lock **Rent/Mortgage**, drag Housing again — Rent does not budge and the
   other three absorb the whole change. Hit the theme's **Reset** to put it
   back on its benchmarks.
4. Trim **Groceries** to $50 and watch the freed cash appear in *Available to
   allocate* — then press **→ Emergency buffer** to bank it.
5. Watch **pII** move as you reallocate — the card shows your rate *as seeded*
   beside your current one, so you can see exactly how much your edits changed
   the inflation you are exposed to. Hit ⓘ for the arithmetic on your numbers.
6. Export CSV → open in Google Sheets, or Print/Save as PDF — page 2 of the
   report opens with the benchmark-basis note so the averages carry their cohort.
7. ✨ Ask Luxmi for a narrative, or ⓘ read the philosophy behind the layout.
