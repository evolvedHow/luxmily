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
  model.ts          scaffold: benchmarks → starting plan
src/data/benchmarks.ts   cohorts, themes, categories, shares, sources (+ links)
src/store/useBudget.ts   zustand + localStorage (key: luxmily-budget-v1)
src/export/        JSON, CSV (Google Sheets), print/PDF
src/components/    UI
```

`engine/` imports nothing from React. Every number on screen comes from one call
to `resolve(budget)` — there is no allocation math in any component. That
constraint is what keeps the model testable in isolation.

## Publishing

`main` → GitHub Actions → GitHub Pages via `.github/workflows/deploy.yml`
(`VITE_BASE=/luxmily/`) → https://evolvedhow.github.io/luxmily/. The print/
"Save as PDF" report and the CSV export are browser-native; there is no server.

## Play with the model

1. Enter income, watch the cohort rail appear, build.
2. Drag **Housing** up top-down — watch every other share renormalize to keep
   the wheel at 100%.
3. Push a **Groceries** plan past the Food allocation — the theme turns red and
   tells you to take it from elsewhere.
4. Switch to **Observed**, enter $6K on Groceries, and see it as a % of cap, vs
   your plan, and what spending less frees up to reallocate.
5. Export CSV → open in Google Sheets, or Print/Save as PDF.