# Luxmi.ly — Budget Optima

A top-down, benchmark-guided **budget optimizer** — not an expense tracker. It
never records day-to-day spending. One number you can live within — your take-
home pay — then seven themes seeded from BLS/FRED/Vanguard benchmarks keyed to
your income cohort. Mobile-first, ink-dark, no backend, no account linking. State
lives in `localStorage`.

```bash
npm install
npm run dev      # → http://localhost:5180 (LAN-reachable: `vite` binds 0.0.0.0)
npm test         # engine + export + render smoke tests
npm run build    # tsc -b && vite build → dist/
```

## The idea

Budgeting normally asks you to name every line item first. This app goes the
other way:

1. **Income & take-home** are the two mandatory answers. Income picks the cohort.
2. **Themes** (Housing, Food, Transportation, Healthcare, Savings & Retirement,
   Travel, Other) are allocated shares of the cap.
3. **Pay yourself first** — 401(k)/Roth/emergency — sits on its own strip with
   benchmark rails, so savings is never the leftover.
4. **Three viewpoints** over the same numbers: *top-down* (share sliders),
   *planned* ($ per category), *observed* (what you actually spend per line).
5. **Travel is a first-class theme** — a "well-lived life" allowance, carved out
   of Other, ramping with income. Airfare, Lodging, Rental Cars & Rideshare.
6. **Red is information, not punishment.** Planned *shares* are enforced green
   (they always sum to 100%); a category plan that overruns its theme allocation
   is red — take it from elsewhere, never silently rewritten.

## The "what is 6K?" loop

Discover you actually spend $6K on Groceries when you planned 12%? Switch to the
**Observed** view and enter it. Luxmi.ly answers three questions about that
number, per category and rolled up per theme:

- **What % of the cap is it?** `observed / cap`.
- **How does it compare to plan?** `observed − plan`, against the benchmark rail.
- **What can I do with the difference?** Spend below plan frees money →
  **Free to reallocate** (green), with the suggestion to move it to Savings,
  Travel, or wherever you'll enjoy it most. Over plan → red, trim or fund from
  elsewhere. Plans are never auto-rewritten.

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

Medians are shown only where a median is actually published (e.g. Vanguard IRA
contributions); where only a mean exists the UI says so instead of inventing a
number.

## Architecture

```
src/engine/       pure TypeScript — no React, no DOM, no side effects
  types.ts          domain model
  solver.ts         clamped proportional allocation (shares always → 1.0)
  resolve.ts        the single entry point the UI calls
  model.ts          scaffold: benchmarks → starting plan (COLA-aware)
src/data/         benchmarks.ts (cohorts, themes, shares, sources + links)
                  context.ts  (About sheet: US-income standing + net worth refs)
                  metro-cola.ts (ZIP → area: cost-of-living, rent factor, median income)
src/store/        useBudget.ts (zustand + localStorage: luxmily-budget-v1)
src/export/       JSON, CSV (Google Sheets), print/PDF
src/advisor/      Luxmi's client-side plumbing
  luxmi.yaml        PRIVATE operator prompt + model params (not in the UI)
  config.ts         typed YAML loader with safe defaults
  prompt.ts         user prompt = the app's own exported JSON (same file you download)
  worker.ts         client for the Cloudflare Worker (SSE streaming + /api/balance)
src/components/   UI (incl. AdvisorSheet + AboutSheet)
worker/           Cloudflare Worker + Durable Object (Workers AI proxy + budget ledger)
```

`engine/` imports nothing from React. Every number on screen comes from one call
to `resolve(budget)` — there is no allocation math in any component. That
constraint is what keeps the model testable in isolation.

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

## About

The ⓘ button opens the About sheet — the one-screen pitch for how the app
thinks: top-down (a cap, then themed shares, then categories), pay-yourself-
first rails, no credit-card debt, red-as-information, and averages as reference,
never a mandate. It also shows (approximate, clearly labelled) where the user's
income cohort stands among US households and where the familiar "top 10% / top
1%" net-worth lines sit in dollars — with sources.

## Publishing

`main` → GitHub Actions → GitHub Pages via `.github/workflows/deploy.yml`
(`VITE_BASE=/luxmily/`) → https://evolvedhow.github.io/luxmily/. The print/
"Save as PDF" report and the CSV export are browser-native; there is no server.

## Luxmi — the AI budget advisor

The ✨ button calls Luxmi, an LLM that reads your **entire budget as the exact
JSON the app exports** (`toJSON`) and writes a narrative: balance, theme-by-
theme benchmark comparison, pay-yourself-first health, anomalies, and 3–7
dollar-level tips.

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
deploy rebuilds with your prompt.

**To change the model on the live site:** set `CFAI_MODEL` on the deployed
Worker via the Cloudflare dashboard (or edit `worker/wrangler.toml` and redeploy
from `worker/`). Rebuild the frontend only if you change the Worker URL or the
prompt.

## Luxmi — troubleshooting

- **"Luxmi worker not configured"** ⇒ `VITE_LUXMI_WORKER` isn't set in the
  build that's running. For the Pages site it comes from the `LUXMI_WORKER_URL`
  repository variable (set in Settings → Secrets and variables → Actions). For
  local dev, use a `.env` file: `VITE_LUXMI_WORKER=http://localhost:8787`.
- **Worker returns 401 / 403** ⇒ Workers AI is rejecting the API token. Recreate
  a token with the "Workers AI — Edit" permission and set it on the Worker:
  `echo "<token>" | npx wrangler secret put CF_AI_API_TOKEN` (and `CF_ACCOUNT_ID`
  too if you haven't) — then re-deploy with `npx wrangler deploy` from `worker/`.
- **Worker returns 404 / 400 "model not found"** ⇒ `CFAI_MODEL` isn't a model
  id that exists on Workers AI — check the model catalog (`@cf/...`).
- **Balance shows the full budget** ⇒ either no requests have run yet, or the
  Durable Object ledger can't connect (local `wrangler dev` needs `--local`).
- **Check the worker is alive:** `curl https://<your-worker>.workers.dev/api/balance`
  — should return `{ "budgetUsd":…, "spentUsd":…, "balanceUsd":… }`.

## Play with the model

1. Enter income (watch the cohort rail + your US income percentile appear),
   add your ZIP to localize the averages (optional), build.
2. Drag **Housing** up top-down — watch every other share renormalize to keep
   the wheel at 100%.
3. Push a **Groceries** plan past the Food allocation — the theme turns red and
   tells you to take it from elsewhere.
4. Switch to **Observed**, enter $6K on Groceries, and see it as a % of cap, vs
   your plan, and what spending less frees up to reallocate.
5. Export CSV → open in Google Sheets, or Print/Save as PDF — page 2 of the
   report opens with the benchmark-basis note so the averages carry their cohort.
6. ✨ Ask Luxmi for a narrative, or ⓘ read the philosophy behind the layout.