# Luxmi.ly — Agent Memory

Jog file for when work resumes. The README is the user-facing doc; this one is
for future coding sessions. Values below are the *source of truth* — if a later
change contradicts something here, trust the change and update this file.

## Project

**Luxmi.ly — Budget Optima** at `~/codebox/luxmi.ly`. A **budget optimizer, NOT
an expense tracker.** No backend, no account linking — everything is client-side
(React 18 + Vite 5 + TS strict + Tailwind + zustand), state in `localStorage`,
deployed to GitHub Pages.

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
worker/                  Cloudflare Worker (Modal proxy) + Durable Object ledger
```

## Luxmi — the AI advisor (Modal + Cloudflare Worker)

- ✨ header button → `AdvisorSheet` bottom sheet. One Ask button, streamed SSE
  narrative, per-request cost + remaining Modal budget in the footer.
- **Pipeline: browser → Cloudflare Worker (`worker/`) → Modal Dedicated
  Endpoint.** The Worker holds the Modal proxy token (`wk-….ws-…`) as a
  `wrangler secret` and injects `Authorization: Bearer <token>` on calls to
  `<MODAL_ENDPOINT>/v1/chat/completions` (OpenAI-compatible, so no Modal app
  code is needed — the operator creates the Endpoint in the Modal dashboard).
- **The model is operator config, not UI:** `MODAL_MODEL` env on the Worker.
  `src/advisor/luxmi.yaml` keeps only the system prompt + `temperature`/
  `max_tokens` (still the PRIVATE operator config, compiled in at build time).
- **Balance is an estimate, not Modal's number:** Modal exposes no live balance
  API (billing SDK is usage reports only). The Worker keeps a **Durable Object
  ledger** (`BalanceDO`, key `luxmi-budget`, persists `spentUsd`). Each request
  computes cost from `usage` tokens × `MODAL_IN_PRICE`/`MODAL_OUT_PRICE`
  (per-1M USD, defaults 0.12/0.36) and appends an SSE trailer event
  `{"type":"usage", usage, costUsd, balanceUsd}` after `[DONE]`. `GET /api/balance`
  returns `{budgetUsd, spentUsd, balanceUsd}` from `MODAL_BUDGET_USD` (default 50).
- Frontend reads `VITE_LUXMI_WORKER` for the Worker origin (`src/advisor/worker.ts`
  `workerUrl()`, inlined by Vite in the browser; falls back to `process.env` so
  vitest can `vi.stubEnv`). Dashboard header shows `BalanceBadge` ("≈ $X left of
  $Y Modal budget", colored green → tension → red) polled every 60s; hidden when
  the Worker URL isn't set.
- Deleted in the overhaul: `src/advisor/providers.ts`, `src/advisor/stream.ts`,
  `src/store/useAdvisor.ts` (provider/model/key picker is gone — no user-facing
  model selection anymore). `luxmily-advisor-v1` localStorage key is obsolete.
- Note: Modal's OpenAI-compat streaming only returns `usage` when
  `stream_options.include_usage` is set — the Worker forces both that and
  `stream: true`, and injects `model` (clients never send a model id).

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
- **Modal has NO live balance API** (SDK = usage reports only). So the "≈ $X
  left of $Y Modal budget" header badge and the ✨ per-request cost are
  **estimated from a Worker-side ledger** — budget minus sum of
  usage-tokens×price (per-1M in/out prices are `MODAL_IN_PRICE`/`MODAL_OUT_PRICE`,
  budget `MODAL_BUDGET_USD`). Tune those for the endpoint's real billing.
- The Worker is OpenAI-compat-only now: no Anthropic schema, no providers
  registry, no per-key model fetch, no compact Groq prompt, no Ollama path.
  `toJSON(r, compact)` in export.ts still supports the compact mode (kept +
  tested); nothing calls it with `true` anymore. `luxmily-advisor-v1`
  localStorage is obsolete — no cleanup code needed (store is gone), but stale
  keys linger harmlessly in old browsers.
- Deploy: `.github/workflows/deploy.yml` rebuilds+deploys Pages on every push
  to `main` (`VITE_BASE: /luxmily/`, `VITE_LUXMI_WORKER: ${{ vars.LUXMI_WORKER_URL }}`
  — set that repo variable to the worker URL). The Worker deploys independently
  from `worker/` (`npx wrangler deploy`); `MODAL_PROXY_TOKEN` is a secret.
- Deleted already as cleanup: `pacing.ts`, flywheel components/old store files,
  `SPRING`/`LOCK_LABEL` tokens, unused `themeId` export, unused `framer-motion`
  dependency; and in the Modal overhaul `src/advisor/providers.ts`,
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
- If Modal ever exposes a real account balance/credits endpoint, point the
  Worker's `/api/balance` at it and drop the ledger estimate.