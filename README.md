# LuxMily · Budget Optima

A top-down, benchmark-guided budget optimizer. One number you can live within —
your take-home pay — then six themes seeded from BLS/FRED-style benchmarks keyed
to your income cohort. Mobile-first, ink-dark, no backend, no account linking.
State lives in `localStorage`.

```bash
npm install
npm run dev      # → http://localhost:5180 (LAN-reachable: `vite` binds 0.0.0.0)
npm test         # engine + export + render smoke tests
npm run build    # tsc -b && vite build → dist/
```

Open it on a phone and test with a thumb, not a mouse.

## The idea

Budgeting normally asks you to name every line item first. This app goes the
other way:

1. **Income & take-home** are the two mandatory answers. Income picks the cohort.
2. **Themes** (Housing, Food, Transportation, Healthcare, Savings & Retirement,
   Other) are allocated shares of the cap.
3. **Pay yourself first** — 401(k)/Roth/emergency — sits on its own strip with
   benchmark rails, so savings is never the leftover.
4. **Three viewpoints** over the same numbers: *top-down* (share sliders),
   *middle-out* (category plans), *bottom-up* (record actuals).
5. **Red is information, not punishment.** Planned *shares* are enforced green
   (they always sum to 100%); a category plan that overruns its theme allocation
   and an actual that overruns plan are reported red, never silently rewritten.

## Data sources

Every guide number lives in `src/data/benchmarks.ts`, tagged with its source:

- **BLS Consumer Expenditure Survey 2024** — theme spend shares and category
  averages by income quintile (6 cohorts, `c1`–`c6`).
- **FRED PSAVERT** — U.S. personal saving rate rails for the emergency buffer.
- **Vanguard / industry** — typical 401(k)/IRA contribution rails.

Medians are shown only where a median is actually published (e.g. Vanguard IRA
contributions); where only a mean exists the UI says so instead of inventing a
number.

## Architecture

```
src/engine/       pure TypeScript — no React, no DOM, no side effects
  types.ts          domain model
  solver.ts         clamped proportional allocation (shares always → 1.0)
  resolve.ts        the single entry point the UI calls
  pacing.ts         date-aware straight-line pacing
  model.ts          scaffold: benchmarks → starting plan
src/data/benchmarks.ts   cohorts, themes, categories, shares, sources
src/store/useBudget.ts   zustand + localStorage (key: luxmily-budget-v1)
src/export/        JSON, CSV (Google Sheets), print/PDF
src/components/    UI
```

`engine/` imports nothing from React. Every number on screen comes from one call
to `resolve(budget, day, totalDays)` — there is no allocation math in any
component. That constraint is what keeps the model testable in isolation.

## Publishing

`main` → GitHub Actions → GitHub Pages via `.github/workflows/deploy.yml`
(`VITE_BASE=/luxmily/`). The print/"Save as PDF" report and the CSV export are
browser-native; there is no server.

## Play with the model

1. Enter income, watch the cohort rail appear, build.
2. Drag **Housing** up top-down — watch every other share renormalize to keep
   the wheel at 100%.
3. Push a **Groceries** plan past the Food allocation — the theme turns red and
   tells you to take it from elsewhere.
4. Switch to *Bottom-up* and log an actual over plan — it flags red but never
   auto-corrects you.
5. Scrub the day-of-month slider to watch pacing re-project.
6. Export CSV → open in Google Sheets, or Print/Save as PDF.