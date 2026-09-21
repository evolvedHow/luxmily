# Luxmi.ly — Agent Memory

Jog file for when work resumes. The README is the user-facing doc; this one is
for future coding sessions. Values below are the *source of truth* — if a later
change contradicts something here, trust the change and update this file.

## Project

**Luxmi.ly — Budget Optima** at `~/codebox/luxmi.ly`. A **budget optimizer, NOT
an expense tracker.** No backend, no account linking — everything is client-side
(React 18 + Vite 5 + TS strict + Tailwind + zustand), state in `localStorage`,
deployed to GitHub Pages.

### ⚠️ THE PRODUCT — non-negotiable

**I am NOT building an expense tracker.** The product is simply **a data-driven
way to create an optimized budget, with anticipated personal CPI. That's it.**
- No spending categories, no weights-editor, no scenarios, no forecasts, no
  per-category expense entry, no tracking of historical spend.
- **Only what the user tells me to do — do not overengineer.** If an instruction
  is ambiguous or already-discussed work seems to drift into a tracker, stop and
  ask before building more.
- The PII feature that shipped in commit `5e51d0d` (32-series embedded BLS
  dataset, `src/pi/*`, `usePii.ts`, `src/components/pi/*`) was **rejected as
  not-what-I-wanted** — it overengineered into tracker territory. Treat it as
  draft code, not the spec.

- Repo: `https://github.com/evolvedHow/luxmily` (public, `main`)
- Live: `https://evolvedhow.github.io/luxmily/` (Pages via `.github/workflows/deploy.yml`, `VITE_BASE=/luxmily/`)
- Dev: `npm run dev` → port 5180. `npm test` (vitest), `npm run build` (`tsc -b && vite build`).
- Any push to `main` auto-deploys. Verify with `curl -s https://evolvedhow.github.io/luxmily/`.

## Core concept (guardrails — do not regress)

1. **Top-down:** take-home pay is the hard **Cap**. 7 themes get shares that the
   solver always re-normalizes to sum 1.0 (green). Categories live inside themes.
2. **Pay yourself first:** 401(k)/Roth/emergency are mandatory rails with
   benchmarks (Vanguard/FRED); exactly one flex envelope (`investments`) inside
   Savings takes leftover slack.
3. **No credit-card debt / red is information:** plans and observed spend are
   NEVER auto-rewritten. `planOver` (plan > theme allocation) and
   `observedOverPlan` (observed > plan) are red advice; `reallocatable` (plan −
   observed, when observed entered) is green "free to move".
4. **Optimizer not tracker:** no day-of-month, no pacing, no actuals/MTD/spent.
   The `observed` field = what the user *discovered* they spend per month
   (0 = not entered). Single engine entry point is `resolve(budget)`; components
   never compute allocation math themselves.
5. **Benchmarks are reference:** BLS CEX 2024, FRED PSAVERT, Vanguard How America
   Saves — each number tagged with `source` + `url`, listed per theme box (see
   `ResolvedTheme.sources`). Medians only where actually published. Travel is a
   LuxMily discretionary guide (cuts from `Other`, ramps 0.02→0.06 by cohort),
   NOT a BLS proportion — it's labelled as such.

## Key files

```
src/engine/{types,solver,resolve,model}.ts   pure TS domain (tested in isolation)
src/data/benchmarks.ts   cohorts c1–c6, THEME_SHARES, THEMES (7), SRC links
src/data/context.ts      About sheet: US-income standing + net-worth refs
src/store/useBudget.ts   budget state, persist "luxmily-budget-v1"
src/advisor/{config,prompt,worker}.ts + luxmi.yaml
src/export/export.ts     toExport/toJSON/toCSV/print (Optimizer columns)
src/components/          CapCard, PayFirstStrip, ThemeCard, ViewpointToggle,
                         ExportMenu, PrintSheet, Onboarding, AdvisorSheet, AboutSheet
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
- **Balance is an estimate:** Workers AI exposes no live balance API (usage is
  billed in neurons: $0.011/1k, 10k free/day per account). The Worker keeps a
  **Durable Object ledger** (`BalanceDO`, key `luxmi-budget`, persists
  `spentUsd`). Each request computes cost from `usage` tokens ×
  `CFAI_IN_PRICE`/`CFAI_OUT_PRICE` (per-1M USD, defaults 0.051/0.335); if
  Workers AI doesn't echo `usage` in the stream it falls back to a chars/4 token
  estimate and sets `estimated:true` in the SSE trailer
  `{"type":"usage", usage, costUsd, balanceUsd, estimated}` appended after
  `[DONE]`. `GET /api/balance` returns `{budgetUsd, spentUsd, balanceUsd}` from
  `CFAI_BUDGET_USD` (default 25).
- Frontend reads `VITE_LUXMI_WORKER` for the Worker origin (`src/advisor/worker.ts`
  `workerUrl()`, inlined by Vite in the browser; falls back to `process.env` so
  vitest can `vi.stubEnv`). Dashboard header shows `BalanceBadge` ("≈ $X left of
  $Y AI budget", colored green → tension → red) polled every 60s; hidden when
  the Worker URL isn't set.
- Deleted in the overhaul: `src/advisor/providers.ts`, `src/advisor/stream.ts`,
  `src/store/useAdvisor.ts` (provider/model/key picker is gone — no user-facing
  model selection anymore). `luxmily-advisor-v1` localStorage key is obsolete.
- Note: Workers AI's OpenAI-compat stream may not echo `usage` even with
  `stream_options.include_usage` set — the Worker forces both that and
  `stream: true`, and injects `model` (clients never send a model id), with the
  chars/4 fallback as the safety net.

## About sheet (added last)

- ⓘ header button → `AboutSheet`: the philosophy pitch (top-down, pay-first,
  no credit-card debt, red-as-information, averages-for-reference), the
  "where you stand" card (approximate US income-cohort standing +
  net-worth thresholds from `src/data/context.ts`, clearly labelled
  approximations), and the sources.
- Print/PDF page 2 opens with a **benchmark-basis** banner naming the cohort and
  the BLS/FRED/Vanguard/Travel sources.

## Localization — ZIP → area cost of living (added last)

- Optional **ZIP** in onboarding (prefilled when re-editing income) →
  `locationForZip` in `src/data/metro-cola.ts` resolves ZIP3 → **metro/region**.
  Pure + offline, no API key (the Census API now 302-redirects without a key —
  verified `X-DataWebAPI-KeyError`), coverage complete via ZIP3 ranges.
- Numbers are **approximate regional guides**: `cola` (BEA RPP ~1.00 = US),
  `rentFactor` (ACS median gross rent ~1.00 = US), `medianIncome` (ACS, annual $).
  Always labelled "approximate"; never passed off as official per-ZIP data.
- In the engine (`model.ts`): every *dollar* benchmark × `cola`; `shelter` also ×
  `rentFactor`. **Percent-of-income rails (401k %, emergency %) are untouched.**
  Benchmark stored on the category is the *pre-cohort-scale* level; `resolve`
  still multiplies by cohort scale at display (do not double-scale).
- `buildBudget(input, loc?)` / `scaffold(cap, income, cohortId, loc?)` — `loc`
  optional → US average (backward compatible). `Budget`/`ResolvedBudget` carry
  optional `location`, exported in JSON meta + a CSV row (Luxmi sees it too).
- The **income percentile** (`COHORT_STANDING[label]`) now shows on the cap
  card always + onboarding (was About-only). Cap card rate line:
  "Localized for {metro} · {cola}× US COL · ≈X% of local median income".
- Transportation gained **Rideshare (Uber / Lyft)** (guide line); travel.ground
  renamed "Rental Cars & Travel Rideshare" to disambiguate.

## Testing

- 5 test files, 49 tests: `engine/engine.test.ts` (16), `engine/location.test.ts`
  (5), `export/export.test.ts` (5), `advisor/advisor.test.ts` (11),
  `smoke.test.tsx` (12, real jsdom mount).
- Smoke tests rely on `aria-label`s: "Household income before tax per month",
  "Zip code (optional)", "Take-home pay per month", `View: ${label}` buttons,
  "Export budget", "Reset to baseline", "Ask Luxmi", "About",
  `${label} plan` / `${label} observed` inputs. Keep them when breaking UI.
- Advisor tests stub `VITE_LUXMI_WORKER` with `vi.stubEnv` + a fake
  `globalThis.fetch` (SSE stream / JSON). `workerUrl()` reads
  `import.meta.env` first, then `process.env` (vitest stubEnv target).
- `npm test` + `npm run build` must pass before pushing.

## Housekeeping

- `index.html` title = `Luxmi.ly`. Branding strings: "Luxmi.ly" (wordmark,
  export `app`, print header).
- `noUnusedLocals`/`noUnusedParameters` are on — dead code fails the build.
- **Workers AI has NO live balance API** (usage is billed in neurons — $0.011
  per 1,000, with a 10,000/day free allowance that resets at 00:00 UTC). So the
  "≈ $X left of $Y AI budget" header badge and the ✨ per-request cost are
  **estimated from a Worker-side ledger** — budget minus sum of usage-tokens×
  price (per-1M in/out prices are `CFAI_IN_PRICE`/`CFAI_OUT_PRICE`, budget
  `CFAI_BUDGET_USD`). Tune those to the model's real rates.
- The Worker is OpenAI-compat-only now: no Anthropic schema, no providers
  registry, no per-key model fetch, no compact Groq prompt, no Ollama path.
  `toJSON(r, compact)` in export.ts still supports the compact mode (kept +
  tested); nothing calls it with `true` anymore. `luxmily-advisor-v1`
  localStorage is obsolete — no cleanup code needed (store is gone), but stale
  keys linger harmlessly in old browsers.
- Deploy: `.github/workflows/deploy.yml` rebuilds+deploys Pages on every push
  to `main` (`VITE_BASE: /luxmily/`, `VITE_LUXMI_WORKER: ${{ vars.LUXMI_WORKER_URL }}`
  — set that repo variable to the worker URL). The Worker deploys independently
  from `worker/` (`npx wrangler deploy`); `CF_ACCOUNT_ID`/`CF_AI_API_TOKEN` are
  secrets, model/budget/prices are `wrangler.toml` vars.
- Deleted already as cleanup: `pacing.ts`, flywheel components/old store files,
  `SPRING`/`LOCK_LABEL` tokens, unused `themeId` export, unused `framer-motion`
  dependency; and in the Workers AI overhaul `src/advisor/providers.ts`,
  `src/advisor/stream.ts`, `src/store/useAdvisor.ts`.
- Commit message style: short imperative sentence (e.g. "Add Luxmi AI budget
  advisor (private YAML prompt + full-budget JSON input)").

## Possible next steps (unstarted)

- Custom domain `luxmi.ly` via CNAME + `VITE_BASE: /` (user hinted).
- More fine-grained Luxmi control (temperature slider in UI is deliberately NOT
  planned — keeps YAML "private to me").
- Per-ZIP precision: swap the embedded `metro-cola.ts` table for a runtime
  ACS/geocoder provider behind the same `locationForZip` shape (needs a Census
  API key and CORS, which is why it's embedded today).
- If Workers AI ever exposes a live usage/balance signal from the Worker
  runtime, point `/api/balance` at it and drop the ledger estimate.