# Luxmi.ly — Agent Memory

Jog file for when work resumes. The README is the user-facing doc; this one is
for future coding sessions. Values below are the *source of truth* — if a later
change contradicts something here, trust the change and update this file.

## Project

**Luxmi.ly — Budget Optima** at `~/codebox/luxmily`. A **budget optimizer, NOT
an expense tracker.** No backend, no account linking — everything is client-side
(React 18 + Vite 5 + TS strict + Tailwind + zustand), state in `localStorage`,
deployed to GitHub Pages.

### ⚠️ THE PRODUCT — non-negotiable

**I am NOT building an expense tracker.** The product is **a data-driven way to
create an optimized budget, plus a personal inflation index (pII) computed from
that allocation. That's it.**
- No expense entry, no actuals, no MTD/pacing/day-of-month, no transaction
  import, no historical spend, no weights editor, no scenarios, no forecasts.
- Every number on screen is a benchmark, a plan the user set, or something
  derived from those two. If a feature needs to know what was actually spent,
  it does not belong here.
- **Only what the user tells me to do — do not overengineer.** If an instruction
  is ambiguous or work seems to drift into tracker territory, stop and ask.

- Repo: `https://github.com/evolvedHow/luxmily` (public, `main`)
- Live: `https://evolvedhow.github.io/luxmily/` (Pages via `.github/workflows/deploy.yml`, `VITE_BASE=/luxmily/`)
- Dev: `npm run dev` → port 5180. `npm test` (vitest), `npm run build` (`tsc -b && vite build`).
- Any push to `main` auto-deploys. Verify with `curl -s https://evolvedhow.github.io/luxmily/`.

## Core concept (guardrails — do not regress)

> ⚠️ **The model changed.** Shares no longer sum to 1.0 and there is no solver.
> If you find older notes or code assuming renormalization, they are stale.

1. **Dollars are the source of truth.** `plan['theme.cat']` is the only stored
   money. A theme's share is **derived** (`planTotal / cap`) and is NOT stored.
   There is no `share` in state, no `allocation`, no `planOver`.
2. **Themes never renormalize against each other.** Raising Housing does not
   shrink Food — it draws from the unallocated bucket
   (`ResolvedBudget.unallocated = cap − totalPlan`). Nothing moves unless the
   user moves it. This replaced the old always-100% solver behaviour.
3. **Theme resize prorates into its categories** via `prorate()`
   (`engine/prorate.ts`), in proportion to current values. Locked categories sit
   the move out; the rest absorb it. The locked subtotal is a hard floor — a
   theme cannot be dragged below it.
4. **Locks are a plain boolean**, keyed by theme id AND `theme.cat` in one
   `locked: Record<string, boolean>` map. The old 4-mode `LockMode`
   (hard/floor/ceiling/elastic) is **deleted** — it was never exposed in UI.
5. **Only the cap can be crossed.** Over-cap = negative `unallocated`, shown red
   and named. Plans are NEVER auto-rewritten; `resolve` is strictly read-only
   and every mutation is a deliberate store action.
6. **Pay yourself first:** 401(k)/Roth/emergency are mandatory rails with
   benchmarks (Vanguard/FRED); exactly one flex envelope (`investments`) inside
   Savings takes leftover slack at scaffold time.
7. **Optimizer not tracker:** there is no `observed` field, no actuals. There is
   also no `Viewpoint` — the top-down/planned toggle is **gone**, because the
   two models became one. Smoke tests lock both in; keep them.
8. **Benchmarks are reference:** BLS CEX 2024, FRED PSAVERT, Vanguard How America
   Saves — each number tagged with `source` + `url`, listed per theme box (see
   `ResolvedTheme.sources`). Medians only where actually published. Travel is a
   LuxMily discretionary guide (cuts from `Other`, ramps 0.02→0.06 by cohort),
   NOT a BLS proportion — it's labelled as such.
9. **Single entry points:** `resolve(budget)` to read, `prorate()` to
   redistribute, `currentPersonalCpi(r)` for pII. Components never compute any
   of it themselves.

### Store actions (all mutation lives here)

`setPlan` (direct edit, delta → bucket) · `setThemeTotal` (prorated resize) ·
`toggleLock` · `resetTheme` (restores benchmark seeding + clears that theme's
locks, so a reset is not instantly re-pinned) · `sweepToEmergency` (surplus only
— never raids the buffer to cover an overdraft) · `reset` · `editIncome`.

`baselinePlan()` recomputes the pristine scaffold on demand. Because `scaffold`
is pure in (cap, income, cohort, location), nothing has to be frozen at
onboarding — this backs both theme reset and the pII baseline.

**The initial bucket is not zero.** Benchmarks often seed below the cap (e.g.
~$1.8k left of a $9k take-home at c4), and that surplus is shown honestly
rather than inflating categories to absorb it. It used to be the hidden "Cap
buffer" line. Do not "fix" this by scaling the scaffold up to the cap.

## pII — personal Inflation index

**Branding: `pII`, lowercase p, always.** Deliberately distinct from PII
(personally identifiable information) / PCI-DSS. Never write "PII".

- **What it is:** official BLS CPI-U rates reweighted by the user's own
  allocation. Headline CPI is ~41% housing; if the user allocates 6% to housing
  they do not feel shelter inflation the way the headline claims. Same rates,
  their weights. `pII = Σ(weight_line × inflation_line)`, where
  `weight_line = line plan ÷ covered plan`.
- **Savings are excluded** from the basket — saving is not consumption.
- **Where it lives:** `src/pi/` — `personalCpi.ts` (mapping + math + theme
  rollup), `blsMetadata.ts` (series taxonomy + official relative importances),
  `bls/data.ts` (generated CPI-U observations, DO NOT hand-edit), `period.ts`,
  `types.ts`. Pure + offline, no network, no API key.
- **UI:** `PiiCard` on the dashboard shows **current rate, the as-seeded
  baseline, and the drift between them**, plus a per-theme "You vs CPI" weight
  table. Both rates recompute live (memoised, ~5ms each) — no Calculate button
  needed. ⓘ opens `PiiSheet` — the math walked through with the user's own
  numbers, plus honest limits. Also in JSON export (`personalInflation` block),
  two CSV rows, and the print report.
- **History:** commit `5e51d0d` shipped an overengineered version (scenarios,
  forecasts, weights editor, per-category expense entry) that was **rejected**
  and reverted. The surviving `src/pi/` is the clean rewrite: reweighting only.
  Do not reintroduce the rejected surface.
- **Known limits (all stated in the UI):** rates are U.S. city average, not
  local — a ZIP scales benchmark *dollars*, never these rates. The mapping is
  coarse (phone → whole `Education and communication` series, which carries
  tuition). Lines with no CPI counterpart use a flat assumed rate.
- **Gotcha:** `other.misc` maps to the All-items series, whose published
  relative importance is **1.0 (the entire basket)**. It carries an explicit
  `ri: 0.02` override — without it that one row took ~59% of the official-weight
  comparison and flattened every theme. A test guards this.

## Key files

```
src/engine/{types,prorate,resolve,model}.ts  pure TS domain (tested in isolation)
src/pi/{personalCpi,blsMetadata,period,types}.ts + bls/data.ts   pII (pure)
src/data/benchmarks.ts   cohorts c1–c6, THEME_SHARES, THEMES (7), SRC links
src/data/context.ts      About sheet: US-income standing + net-worth refs
src/store/useBudget.ts   budget state + ALL mutations, persist "luxmily-budget-v2"
src/advisor/{config,prompt,worker}.ts + luxmi.yaml
src/export/export.ts     toExport/toJSON/toCSV/print (Optimizer columns + pII)
src/components/          CapCard, PayFirstStrip, ThemeCard, ExportMenu,
                         PrintSheet, Onboarding, AdvisorSheet, AboutSheet,
                         PiiCard, PiiSheet
src/theme/tokens.ts      C palette, money(), pct()
worker/                  Cloudflare Worker (Workers AI proxy) + Durable Object ledger
```

## Luxmi — the AI advisor (Cloudflare Workers AI)

- ✨ header button → `AdvisorSheet` bottom sheet. One Ask button, streamed SSE
  narrative, per-request cost + remaining AI budget in the footer.
- **Pipeline: browser → Cloudflare Worker (`worker/`) → Cloudflare Workers AI.**
  The Worker holds `CF_ACCOUNT_ID` + `CF_AI_API_TOKEN` as `wrangler` secrets and
  calls `<account>/ai/v1/chat/completions` (Workers AI's OpenAI-compatible
  endpoint — the OpenAI SSE shape the client already parsed, no SDK needed).
- **The model is operator config, not UI:** `CFAI_MODEL` env on the Worker
  (default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`). `src/advisor/luxmi.yaml` keeps only
  the system prompt + `temperature`/`max_tokens` (still the PRIVATE operator
  config, compiled in at build time).
- **`luxmi.yaml` is load-bearing and silently fragile.** It shipped broken: an
  unindented list item inside the `system:` block scalar made js-yaml throw, and
  `config.ts` swallowed the error, so production ran on the 48-char fallback
  prompt for who knows how long. It now logs loudly on parse failure. **If you
  edit that YAML, run `npm test`** — `advisor.test.ts` asserts
  `system.length > 80`, which is what catches it.
- **js-yaml is v5** (`load` is still the entry point). Not v3/v4.
- **Balance is an estimate:** Workers AI exposes no live balance API (usage is
  billed in neurons: $0.011/1k, 10k free/day per account). The Worker keeps a
  **Durable Object ledger** (`BalanceDO`, key `luxmi-budget`, persists
  `spentUsd`). Each request computes cost from `usage` tokens ×
  `CFAI_IN_PRICE`/`CFAI_OUT_PRICE` (per-1M USD, defaults 0.051/0.335); if
  Workers AI doesn't echo `usage` in the stream it falls back to a chars/4 token
  estimate and sets `estimated:true` in the SSE trailer
  `{"type":"usage", usage, costUsd, balanceUsd, estimated}` appended after
  `[DONE]`. `GET /api/balance` returns `{budgetUsd, spentUsd, balanceUsd}` from
  `CFAI_BUDGET_USD` (default 25), clamped at 0.
- **The endpoint is unauthenticated** — a static Pages site cannot hold a
  secret. Mitigations in place (defence in depth, NOT auth): `ALLOWED_ORIGINS`
  allowlist (default `*` — set it in prod), hard stop at `CFAI_BUDGET_USD`
  (429), server-pinned model, `max_tokens` clamped to 4096. Real protection
  needs Cloudflare Access / WAF rate-limiting in front.
- Frontend reads `VITE_LUXMI_WORKER` for the Worker origin (`src/advisor/worker.ts`
  `workerUrl()`, inlined by Vite in the browser; falls back to `process.env` so
  vitest can `vi.stubEnv`). Dashboard header shows `BalanceBadge` ("≈ $X left of
  $Y AI budget", colored green → tension → red) polled every 60s; hidden when
  the Worker URL isn't set.
- Deleted in the overhaul: `src/advisor/providers.ts`, `src/advisor/stream.ts`,
  `src/store/useAdvisor.ts` (provider/model/key picker is gone — no user-facing
  model selection anymore). `luxmily-advisor-v1` localStorage key is obsolete.

## About sheet

- ⓘ header button → `AboutSheet`: the philosophy pitch (top-down, pay-first,
  no credit-card debt, red-as-information, averages-for-reference), the
  "where you stand" card (approximate US income-cohort standing +
  net-worth thresholds from `src/data/context.ts`, clearly labelled
  approximations), and the sources.
- `COHORT_STANDING` is keyed by **cohort id** (`c1`–`c6`), not label. `c1` is
  the *bottom* band — its label reads "lower ~30% of households"; it previously
  said "top ~30%", which was backwards.
- Print/PDF page 2 opens with a **benchmark-basis** banner naming the cohort and
  the BLS/FRED/Vanguard/Travel sources.

## Localization — ZIP → area cost of living

- Optional **ZIP** in onboarding (prefilled when re-editing income) →
  `locationForZip` in `src/data/metro-cola.ts` resolves ZIP3 → **metro/region**.
  Pure + offline, no API key (the Census API now 302-redirects without a key —
  verified `X-DataWebAPI-KeyError`), coverage complete via ZIP3 ranges.
- Numbers are **approximate regional guides**: `cola` (BEA RPP ~1.00 = US),
  `rentFactor` (ACS median gross rent ~1.00 = US), `medianIncome` (ACS, annual $).
  Always labelled "approximate"; never passed off as official per-ZIP data.
- In the engine (`model.ts`): every *dollar* benchmark × `cola`; `shelter` also ×
  `rentFactor`. **Percent-of-income rails (401k %, emergency %) are untouched,
  and so are pII inflation rates.** Benchmark stored on the category is the
  *pre-cohort-scale* level; `resolve` still multiplies by cohort scale at
  display (do not double-scale).
- `buildBudget(input, loc?)` / `scaffold(cap, income, cohortId, loc?)` — `loc`
  optional → US average (backward compatible). `Budget`/`ResolvedBudget` carry
  optional `location`, exported in JSON meta + a CSV row (Luxmi sees it too).
- The **income percentile** (`COHORT_STANDING[cohortId]`) shows on the cap card
  always + onboarding. Cap card rate line: "Localized for {metro} · {cola}× US
  COL · ≈X% of local median income".

## Testing

- 7 test files, 79 tests: `engine/engine.test.ts` (17),
  `engine/prorate.test.ts` (9), `engine/location.test.ts` (5),
  `export/export.test.ts` (7), `advisor/advisor.test.ts` (12),
  `pi/pii.test.ts` (9), `smoke.test.tsx` (20, real jsdom mount).
- Smoke tests rely on `aria-label`s: "Household income before tax per month",
  "Zip code (optional)", "Take-home pay per month", `View: ${label}` buttons,
  "Export budget", "Reset to baseline", "Ask Luxmi", "About", "pII rate",
  "How pII is calculated", "Unallocated",
  `${label} plan` / `${label} share of cap` / `Lock ${label}` /
  `Reset ${theme} to benchmark` / "Sweep available cash to emergency buffer".
  Keep them when breaking UI.
- Theme names now render **twice** (theme card + pII weight table + print
  sheet), so `getByText('Housing')` throws — use `getAllByText`.
- `buildBudget` seeds benchmark defaults for any absent `plan` key, so an empty
  `plan: {}` is NOT an empty budget. Zero each `cat.plan` explicitly to test the
  degenerate case.
- Advisor tests stub `VITE_LUXMI_WORKER` with `vi.stubEnv` + a fake
  `globalThis.fetch` (SSE stream / JSON). `workerUrl()` reads
  `import.meta.env` first, then `process.env` (vitest stubEnv target).
- `npm test` + `npm run build` must pass before pushing.

## Housekeeping

- `index.html` title = `Luxmi.ly`. Branding strings: "Luxmi.ly" (wordmark,
  export `app`, print header), and **`pII`** for the inflation index.
- `noUnusedLocals`/`noUnusedParameters` are on — dead code fails the build.
- `EPS` (half a cent) now lives in `engine/prorate.ts`; `resolve()` uses it for
  `ok`. Do not compare dollars with `=== 0`.
- `prorate()` rounds to whole dollars and dumps rounding drift on the largest
  unlocked line, so a resize lands exactly on target. It is idempotent —
  re-applying the current total is a no-op.
- The Worker is OpenAI-compat-only: no Anthropic schema, no providers registry,
  no per-key model fetch, no compact Groq prompt, no Ollama path.
  `toJSON(r, compact)` in export.ts still supports the compact mode (kept +
  tested); nothing calls it with `true` anymore.
- Worker stream gotcha: `controller.enqueue(value)` already forwards every raw
  byte — `buffer` is only a parsing mirror. Re-enqueueing it on flush (as the
  original did) duplicated the final partial SSE line.
- Deploy: `.github/workflows/deploy.yml` rebuilds+deploys Pages on every push
  to `main` (`VITE_BASE: /luxmily/`, `VITE_LUXMI_WORKER: ${{ vars.LUXMI_WORKER_URL }}`
  — set that repo variable to the worker URL). The Worker deploys independently
  from `worker/` (`npx wrangler deploy`); `CF_ACCOUNT_ID`/`CF_AI_API_TOKEN` are
  secrets, model/budget/prices/`ALLOWED_ORIGINS` are `wrangler.toml` vars.
- Commit message style: short imperative sentence (e.g. "Add Luxmi AI budget
  advisor (private YAML prompt + full-budget JSON input)").

## Possible next steps (unstarted)

- Custom domain `luxmi.ly` via CNAME + `VITE_BASE: /` (user hinted).
- Consider an "assign the bucket for me" action (spread unallocated across
  unlocked themes pro-rata) — currently the only one-click option is the
  emergency-buffer sweep.
- Refresh the embedded CPI-U snapshot (`src/pi/bls/data.ts`) — it is a
  generated file with a `BLS_DATA_ASOF` stamp; it will go stale.
- Tighten the pII mapping where it is coarse (phone/tuition, custom-rate lines).
- Set `ALLOWED_ORIGINS` on the deployed Worker; consider Cloudflare Access.
- Per-ZIP precision: swap the embedded `metro-cola.ts` table for a runtime
  ACS/geocoder provider behind the same `locationForZip` shape.
- If Workers AI ever exposes a live usage/balance signal, point `/api/balance`
  at it and drop the ledger estimate.
