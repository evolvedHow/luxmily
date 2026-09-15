import type { LockMode } from '../engine/types'

/**
 * Benchmark reference set. Every number shown to the user as a guide lives here,
 * tied to an income band ("cohort") and tagged with where it came from.
 *
 * This app is an OPTIMIZER, not a tracker. It never records day-to-day spending.
 * The user types in what they have discovered they actually spend per month and
 * the app answers: "what % of your cap is that, how does it compare to your plan
 * (seeded from the industry avg), and what can you reallocate if it came in
 * lower?"
 *
 * Sources (each number carries its own `source` + `url` so the UI can link to
 * it inside the theme's box):
 *  - BLS Consumer Expenditure Survey 2024 (CEX) — spend shares and category
 *    averages by income quintile. Category dollars are monthly means derived
 *    from the published annual means.
 *    https://www.bls.gov/cex/tables.htm
 *  - FRED PSAVERT — U.S. personal saving rate.
 *    https://fred.stlouisfed.org/series/PSAVERT
 *  - Vanguard How America Saves — typical 401(k)/IRA contribution rails.
 *    https://institutional.vanguard.com/HAS/How-America-Saves.html
 *
 * Travel is NOT a BLS proportion. It is our own "well-lived life" discretionary
 * guide carved out of the Other theme, sourced from CEX entertainment-related
 * detail. Luxury by design, scaled by cohort.
 *
 * Median values are included only where a reputable median is actually published
 * (e.g. Vanguard IRA contributions); BLS CEX publishes means, so most categories
 * carry an avg and a "median not published" note instead of a made-up number.
 */

export interface Cohort {
  id: string
  label: string
  incomeMin: number
  incomeMax: number
  avgAnnualSpend: number
  source: string
}

export const ALL_CU_ANNUAL_SPEND = 78_535

export const COHORTS: Cohort[] = [
  { id: 'c1', label: 'Under $40k', incomeMin: 0, incomeMax: 40_000 / 12, avgAnnualSpend: 29_500, source: 'BLS CEX 2024 · bottom income quintile', },
  { id: 'c2', label: '$40k – $75k', incomeMin: 40_000 / 12, incomeMax: 75_000 / 12, avgAnnualSpend: 48_000, source: 'BLS CEX 2024 · second income quintile' },
  { id: 'c3', label: '$75k – $110k', incomeMin: 75_000 / 12, incomeMax: 110_000 / 12, avgAnnualSpend: 65_000, source: 'BLS CEX 2024 · third income quintile' },
  { id: 'c4', label: '$110k – $150k', incomeMin: 110_000 / 12, incomeMax: 150_000 / 12, avgAnnualSpend: 88_000, source: 'BLS CEX 2024 · fourth income quintile' },
  { id: 'c5', label: '$150k – $200k', incomeMin: 150_000 / 12, incomeMax: 200_000 / 12, avgAnnualSpend: 112_000, source: 'BLS CEX 2024 · toward the top quintile' },
  { id: 'c6', label: '$200k +', incomeMin: 200_000 / 12, incomeMax: Infinity, avgAnnualSpend: 150_000, source: 'BLS CEX 2024 · top income quintile' },
]

export function cohortForIncome(monthly: number): Cohort {
  return COHORTS.find((c) => monthly >= c.incomeMin && monthly < c.incomeMax) ?? COHORTS[2]
}

export function cohortById(id: string): Cohort {
  return COHORTS.find((c) => c.id === id) ?? COHORTS[2]
}

/** Scale a cohort's typical spending against the all-consumer-unit average. */
export function cohortScale(cohort: Cohort): number {
  return ALL_CU_ANNUAL_SPEND > 0 ? cohort.avgAnnualSpend / ALL_CU_ANNUAL_SPEND : 1
}

/* ---------------- Source links ---------------- */

export const SRC = {
  bls: { label: 'BLS CEX 2024', url: 'https://www.bls.gov/cex/tables.htm' },
  fred: { label: 'FRED · PSAVERT', url: 'https://fred.stlouisfed.org/series/PSAVERT' },
  vanguard: { label: 'Vanguard · How America Saves', url: 'https://institutional.vanguard.com/HAS/How-America-Saves.html' },
} as const

export type SourceRef = { label: string; url?: string }

export interface CatBench {
  /** All-consumer-unit monthly mean (dollars), or a fraction when `pctOf` is set. */
  avg: number
  median?: number
  /** When set, `avg` is a fraction of gross income or of take-home, not dollars. */
  pctOf?: 'gross' | 'takehome'
  medianNote?: string
  source: string
  url?: string
}

export interface CatDef {
  id: string
  label: string
  bench: CatBench
  lock: LockMode
  /** Mirrors back which source ref owns this category. */
  sourceRef: keyof typeof SRC
  /** Pay-yourself-first field: shown on the mandatory savings strip with its rail. */
  payFirst?: boolean
  /** Slack absorber inside a theme (e.g. leftover savings envelope). */
  flex?: boolean
}

export interface ThemeDef {
  id: string
  label: string
  payFirst?: boolean
  bench: { source: string; url?: string; sourceRef?: keyof typeof SRC }
  cats: CatDef[]
}

/**
 * Share of total spending by cohort and theme. Sums to 1 per cohort column.
 * Travel is ours, carved out of Other — luxury by design, ramping with income.
 */
export const THEME_SHARES: Record<string, Record<string, number>> = {
  c1: { housing: 0.36, food: 0.15, transport: 0.16, healthcare: 0.1, savings: 0.03, travel: 0.02, other: 0.18 },
  c2: { housing: 0.35, food: 0.14, transport: 0.17, healthcare: 0.09, savings: 0.07, travel: 0.03, other: 0.15 },
  c3: { housing: 0.34, food: 0.13, transport: 0.17, healthcare: 0.08, savings: 0.11, travel: 0.04, other: 0.13 },
  c4: { housing: 0.33, food: 0.12, transport: 0.17, healthcare: 0.08, savings: 0.14, travel: 0.05, other: 0.11 },
  c5: { housing: 0.32, food: 0.12, transport: 0.16, healthcare: 0.08, savings: 0.16, travel: 0.06, other: 0.1 },
  c6: { housing: 0.31, food: 0.11, transport: 0.16, healthcare: 0.07, savings: 0.19, travel: 0.06, other: 0.1 },
}

export function themeShare(cohortId: string, themeId: string): number {
  return THEME_SHARES[cohortId]?.[themeId] ?? 0.1
}

export const THEMES: ThemeDef[] = [
  {
    id: 'housing',
    label: 'Housing',
    bench: { source: 'BLS CEX 2024 · largest spend share (~33%)', url: SRC.bls.url },
    cats: [
      { id: 'shelter', label: 'Rent / Mortgage', lock: 'floor', sourceRef: 'bls', bench: { avg: 1280, source: 'BLS CEX 2024 · shelter (owned + rented dwellings)', url: SRC.bls.url } },
      { id: 'utilities', label: 'Utilities & Public Services', lock: 'floor', sourceRef: 'bls', bench: { avg: 390, source: 'BLS CEX 2024 · utilities, fuels, public services', url: SRC.bls.url } },
      { id: 'home_maint', label: 'Maintenance & Furnishings', lock: 'elastic', sourceRef: 'bls', bench: { avg: 190, source: 'BLS CEX 2024 · household operations + furnishings', url: SRC.bls.url } },
      { id: 'home_insurance', label: 'Home Insurance', lock: 'floor', sourceRef: 'bls', bench: { avg: 120, source: 'BLS CEX 2024 · household insurance', url: SRC.bls.url } },
    ],
  },
  {
    id: 'food',
    label: 'Food',
    bench: { source: 'BLS CEX 2024 · ~13% of spend', url: SRC.bls.url },
    cats: [
      { id: 'groceries', label: 'Groceries (food at home)', lock: 'elastic', sourceRef: 'bls', bench: { avg: 400, medianNote: 'BLS publishes a mean, not a median', source: 'BLS CEX 2024 · food at home', url: SRC.bls.url } },
      { id: 'dining_out', label: 'Dining Out', lock: 'elastic', sourceRef: 'bls', bench: { avg: 260, source: 'BLS CEX 2024 · food away from home', url: SRC.bls.url } },
    ],
  },
  {
    id: 'transport',
    label: 'Transportation',
    bench: { source: 'BLS CEX 2024 · ~17% of spend', url: SRC.bls.url },
    cats: [
      { id: 'vehicle_payment', label: 'Car Payment / Lease', lock: 'floor', sourceRef: 'bls', bench: { avg: 430, source: 'BLS CEX 2024 · vehicle purchases (net outlay incl. financing)', url: SRC.bls.url } },
      { id: 'vehicle_insurance', label: 'Car Insurance', lock: 'floor', sourceRef: 'bls', bench: { avg: 165, source: 'BLS CEX 2024 · vehicle insurance', url: SRC.bls.url } },
      { id: 'gas', label: 'Gasoline', lock: 'elastic', sourceRef: 'bls', bench: { avg: 165, source: 'BLS CEX 2024 · gasoline and motor oil', url: SRC.bls.url } },
      { id: 'maintenance', label: 'Maintenance & Repairs', lock: 'elastic', sourceRef: 'bls', bench: { avg: 100, source: 'BLS CEX 2024 · vehicle maintenance', url: SRC.bls.url } },
      { id: 'public_transit', label: 'Public Transit', lock: 'elastic', sourceRef: 'bls', bench: { avg: 95, source: 'BLS CEX 2024 · public & other transportation', url: SRC.bls.url } },
      { id: 'rideshare', label: 'Rideshare (Uber / Lyft)', lock: 'elastic', sourceRef: 'bls', bench: { avg: 60, source: 'LuxMily guide · in-town rideshare (drawn from CEX "other transportation" detail — the car-free city line)', url: SRC.bls.url } },
      { id: 'parking_tolls', label: 'Parking & Tolls', lock: 'elastic', sourceRef: 'bls', bench: { avg: 40, source: 'BLS CEX 2024 · other vehicle expenses', url: SRC.bls.url } },
    ],
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    bench: { source: 'BLS CEX 2024 · ~8% of spend', url: SRC.bls.url },
    cats: [
      { id: 'health_insurance', label: 'Insurance Premiums', lock: 'floor', sourceRef: 'bls', bench: { avg: 350, source: 'BLS CEX 2024 · health insurance', url: SRC.bls.url } },
      { id: 'medical_services', label: 'Medical Services', lock: 'elastic', sourceRef: 'bls', bench: { avg: 150, source: 'BLS CEX 2024 · medical services', url: SRC.bls.url } },
      { id: 'prescriptions', label: 'Prescriptions', lock: 'elastic', sourceRef: 'bls', bench: { avg: 80, source: 'BLS CEX 2024 · drugs', url: SRC.bls.url } },
      { id: 'dental_vision', label: 'Dental & Vision', lock: 'elastic', sourceRef: 'bls', bench: { avg: 40, source: 'BLS CEX 2024 · dental + vision care', url: SRC.bls.url } },
    ],
  },
  {
    id: 'savings',
    label: 'Savings & Retirement',
    payFirst: true,
    bench: { source: 'Mixed — CEX "personal insurance & pensions" ~12.5% + FRED saving rate + Vanguard rails' },
    cats: [
      { id: 'k401', label: '401(k) / Roth', payFirst: true, lock: 'floor', sourceRef: 'vanguard', bench: { avg: 0.07, pctOf: 'gross', median: 0.07, source: "Vanguard · typical employee deferral ≈7% (≈11% with employer match); Fidelity guideline 15%", url: SRC.vanguard.url } },
      { id: 'roth', label: 'Roth IRA', payFirst: true, lock: 'floor', sourceRef: 'vanguard', bench: { avg: 200, median: 167, medianNote: 'Vanguard median IRA contribution ≈ $2,000/yr', source: 'Vanguard · median rollout ~$2,000/yr; 2026 limit $7,000/yr', url: SRC.vanguard.url } },
      { id: 'emergency', label: 'Emergency / Cash Buffer', payFirst: true, lock: 'floor', sourceRef: 'fred', bench: { avg: 0.05, pctOf: 'takehome', source: 'FRED PSAVERT · U.S. personal saving rate ≈3.8% (2024); long-run ≈8.9%', url: SRC.fred.url } },
      { id: 'life_insurance', label: 'Life / Other Insurance', lock: 'floor', sourceRef: 'bls', bench: { avg: 48, source: 'BLS CEX 2024 · life and other personal insurance', url: SRC.bls.url } },
      { id: 'investments', label: 'Investments & Brokerage', flex: true, lock: 'elastic', sourceRef: 'vanguard', bench: { avg: 0, source: 'Slack inside the savings envelope → invest more' } },
    ],
  },
  {
    id: 'travel',
    label: 'Travel',
    bench: { source: 'LuxMily guide · a well-lived life. Not a BLS proportion — carved out of Other, from CEX entertainment detail', url: SRC.bls.url },
    cats: [
      { id: 'airfare', label: 'Airfare', lock: 'elastic', sourceRef: 'bls', bench: { avg: 85, medianNote: 'Fares vary widely; this is our guide level', source: 'LuxMily guide · air travel allowance (BTS average domestic fare context)', url: 'https://www.bts.gov/travel-patterns-and-trends' } },
      { id: 'lodging', label: 'Hotels & Short-Term Rentals', lock: 'elastic', sourceRef: 'bls', bench: { avg: 140, medianNote: 'Varies hugely by destination', source: 'LuxMily guide · hotel/short-term rental allowance', url: SRC.bls.url } },
      { id: 'ground', label: 'Rental Cars & Travel Rideshare', lock: 'elastic', sourceRef: 'bls', bench: { avg: 55, source: 'LuxMily guide · rental cars + travel rideshare', url: SRC.bls.url } },
    ],
  },
  {
    id: 'other',
    label: 'Other (everything else)',
    bench: { source: 'BLS CEX 2024 · entertainment, apparel, personal care, misc', url: SRC.bls.url },
    cats: [
      { id: 'entertainment', label: 'Entertainment & Activities', lock: 'elastic', sourceRef: 'bls', bench: { avg: 100, source: 'BLS CEX 2024 · entertainment', url: SRC.bls.url } },
      { id: 'subscriptions', label: 'Digital Subscriptions', lock: 'elastic', sourceRef: 'bls', bench: { avg: 90, medianNote: 'No published median for streaming', source: 'Approx. from CEX entertainment detail', url: SRC.bls.url } },
      { id: 'mobile', label: 'Mobile & Phone', lock: 'elastic', sourceRef: 'bls', bench: { avg: 95, source: 'BLS CEX 2024 · telephone services', url: SRC.bls.url } },
      { id: 'internet', label: 'Internet', lock: 'elastic', sourceRef: 'bls', bench: { avg: 65, source: 'Approx. from CEX telecom detail', url: SRC.bls.url } },
      { id: 'apparel', label: 'Apparel', lock: 'elastic', sourceRef: 'bls', bench: { avg: 160, source: 'BLS CEX 2024 · apparel & services', url: SRC.bls.url } },
      { id: 'personal_care', label: 'Personal Care', lock: 'elastic', sourceRef: 'bls', bench: { avg: 80, source: 'BLS CEX 2024 · personal care products & services', url: SRC.bls.url } },
      { id: 'misc', label: 'Miscellaneous', lock: 'elastic', sourceRef: 'bls', bench: { avg: 100, source: 'BLS CEX 2024 · miscellaneous expenditures', url: SRC.bls.url } },
    ],
  },
]