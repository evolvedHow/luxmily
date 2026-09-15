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
src/store/useAdvisor.ts  Luxmi settings, persist "luxmily-advisor-v1"
src/advisor/{providers,config,prompt,stream}.ts + luxmi.yaml
src/export/export.ts     toExport/toJSON/toCSV/print (Optimizer columns)
src/components/          CapCard, PayFirstStrip, ThemeCard, ViewpointToggle,
                         ExportMenu, PrintSheet, Onboarding, AdvisorSheet, AboutSheet
src/theme/tokens.ts      C palette, money(), pct()
```

## Luxmi — the AI advisor (added last)

- ✨ header button → `AdvisorSheet` bottom sheet. User picks provider + model +
  API key (key stays in `localStorage`); request goes **browser → provider
  directly** (no proxy). Streaming SSE narrative with light inline markdown.
- Providers: Groq, Google/Gemini, Anthropic, OpenAI, OpenRouter + **Local
  Ollama** (no key — the "don't want to sign up" path). Free tiers: Groq (no
  card), Gemini AI Studio, OpenRouter `:free`. Anthropic/OpenAI paid.
- **`src/advisor/luxmi.yaml` is the PRIVATE operator config** — system prompt +
  `temperature`/`max_tokens` + per-provider `models` defaults. Compiled in at
  build time, NOT shown/editable in the UI. Go there to tune Luxmi's voice.
- **Luxmi's input is the app's own exported JSON** (`toJSON(r)`, the exact
  downloadable file) — every input and computed parameter is in it; the model
  is told to use only numbers in that JSON. `prompt.ts` frames it, `stream.ts`
  handles both OpenAI- and Anthropic-shaped SSE.
- `stream.ts` `OPENAI_DELTA` / `ANTHROPIC_DELTA` parse the two event schemas;
  `journey()` reads the stream.

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

- 5 test files, 51 tests: `engine/engine.test.ts` (16), `engine/location.test.ts`
  (5), `export/export.test.ts` (4), `advisor/advisor.test.ts` (14),
  `smoke.test.tsx` (12, real jsdom mount).
- Smoke tests rely on `aria-label`s: "Household income before tax per month",
  "Zip code (optional)", "Take-home pay per month", `View: ${label}` buttons,
  "Export budget", "Reset to baseline", "Ask Luxmi", "About",
  `${label} plan` / `${label} observed` inputs. Keep them when breaking UI.
- `npm test` + `npm run build` must pass before pushing.

## Housekeeping

- `index.html` title = `Luxmi.ly`. Branding strings: "Luxmi.ly" (wordmark,
  export `app`, print header).
- `noUnusedLocals`/`noUnusedParameters` are on — dead code fails the build.
- **Advisor settings hygiene:** `useAdvisor.setProvider` clears the persisted
  `baseUrl` override (stale override = classic 405/404 source) **and the
  `customModel` id**, reseeding `modelId` via exported `defaultModelFor(providerId)`
  (YAML `models` win, else registry `defaultModel`). The UI adds a **Custom
  model id** text field — `effectiveModelId()` = typed custom id, else picker
  (dropdown has a "Custom model id…" sentinel). Keeping the YAML `models:`
  block in sync with `providers.ts` is enforced by a test. AdvisorSheet reseeds
  invalid persisted model ids on open and prints the effective endpoint+model
  under the Ask button. `stream.ts` parseError now surfaces the provider's raw
  status/message/type (429 explicitly labeled); requests send
  `accept: text/event-stream`.
- Deploy: `.github/workflows/deploy.yml` rebuilds+deploys Pages on every push to
  `main` (`VITE_BASE: /luxmily/`). Pushing is the ONLY step needed to change
  providers/models on github.io — but `localStorage` `luxmily-advisor-v1`
  survives deploys, so a browser with a stale baseUrl/model id keeps failing
  even on the new build (provider switch clears both).
- Deleted already as cleanup: `pacing.ts`, flywheel components/old store files,
  `SPRING`/`LOCK_LABEL` tokens, unused `themeId` export, unused `framer-motion`
  dependency.
- Commit message style: short imperative sentence (e.g. "Add Luxmi AI budget
  advisor (private YAML prompt + full-budget JSON input)").

## Possible next steps (unstarted)

- Custom domain `luxmi.ly` via CNAME + `VITE_BASE: /` (user hinted).
- More fine-grained Luxmi control (temperature slider in UI is deliberately NOT
  planned — keeps YAML "private to me").
- Per-ZIP precision: swap the embedded `metro-cola.ts` table for a runtime
  ACS/geocoder provider behind the same `locationForZip` shape (needs a Census
  API key and CORS, which is why it's embedded today).