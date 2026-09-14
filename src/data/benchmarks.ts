import type { LockMode } from '../engine/types'

/**
 * Benchmark reference set. Every number shown to the user as a guide lives here,
 * tied to an income band ("cohort") and tagged with where it came from.
 *
 * Sources:
 *  - BLS Consumer Expenditure Survey 2024 (CEX) for spend shares and category
 *    averages by income quintile. Category dollars are monthly means derived
 *    from the published annual means.
 *  - FRED PSAVERT for the U.S. personal saving rate.
 *  - Vanguard / industry for typical 401(k) deferral and IRA contribution rails.
 *
 * Median values are included only where a reputable median is actually published
 * (e.g. Zillow observed rent); BLS CEX publishes means, so most categories carry
 * an avg and a "median not published" note instead of a made-up number.
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

export interface CatBench {
  /** All-consumer-unit monthly mean (dollars), or a fraction when `pctOf` is set. */
  avg: number
  median?: number
  /** When set, `avg` is a fraction of gross income or of take-home, not dollars. */
  pctOf?: 'gross' | 'takehome'
  medianNote?: string
  source: string
}

export interface CatDef {
  id: string
  label: string
  bench: CatBench
  lock: LockMode
  fixedCadence?: boolean
  /** Pay-yourself-first field: shown on the mandatory savings strip with its rail. */
  payFirst?: boolean
  /** Slack absorber inside a theme (e.g. leftover savings envelope). */
  flex?: boolean
}

export interface ThemeDef {
  id: string
  label: string
  payFirst?: boolean
  bench: { source: string }
  cats: CatDef[]
}

/** Share of total spending by cohort and theme. Sums to 1 per cohort column. */
export const THEME_SHARES: Record<string, Record<string, number>> = {
  c1: { housing: 0.36, food: 0.15, transport: 0.16, healthcare: 0.1, savings: 0.03, other: 0.2 },
  c2: { housing: 0.35, food: 0.14, transport: 0.17, healthcare: 0.09, savings: 0.07, other: 0.18 },
  c3: { housing: 0.34, food: 0.13, transport: 0.17, healthcare: 0.08, savings: 0.11, other: 0.17 },
  c4: { housing: 0.33, food: 0.12, transport: 0.17, healthcare: 0.08, savings: 0.14, other: 0.16 },
  c5: { housing: 0.32, food: 0.12, transport: 0.16, healthcare: 0.08, savings: 0.16, other: 0.16 },
  c6: { housing: 0.31, food: 0.11, transport: 0.16, healthcare: 0.07, savings: 0.19, other: 0.16 },
}

export function themeShare(cohortId: string, themeId: string): number {
  return THEME_SHARES[cohortId]?.[themeId] ?? 0.1
}

export const THEMES: ThemeDef[] = [
  {
    id: 'housing',
    label: 'Housing',
    bench: { source: 'BLS CEX 2024 · largest spend share (~33%)' },
    cats: [
      { id: 'shelter', label: 'Rent / Mortgage', lock: 'floor', fixedCadence: true, bench: { avg: 1280, source: 'BLS CEX 2024 · shelter (owned + rented dwellings)' } },
      { id: 'utilities', label: 'Utilities & Public Services', lock: 'floor', fixedCadence: true, bench: { avg: 390, source: 'BLS CEX 2024 · utilities, fuels, public services' } },
      { id: 'home_maint', label: 'Maintenance & Furnishings', lock: 'elastic', bench: { avg: 190, source: 'BLS CEX 2024 · household operations + furnishings' } },
      { id: 'home_insurance', label: 'Home Insurance', lock: 'floor', fixedCadence: true, bench: { avg: 120, source: 'BLS CEX 2024 · household insurance' } },
    ],
  },
  {
    id: 'food',
    label: 'Food',
    bench: { source: 'BLS CEX 2024 · ~13% of spend' },
    cats: [
      { id: 'groceries', label: 'Groceries (food at home)', lock: 'elastic', bench: { avg: 400, medianNote: 'BLS publishes a mean, not a median', source: 'BLS CEX 2024 · food at home' } },
      { id: 'dining_out', label: 'Dining Out', lock: 'elastic', bench: { avg: 260, source: 'BLS CEX 2024 · food away from home' } },
    ],
  },
  {
    id: 'transport',
    label: 'Transportation',
    bench: { source: 'BLS CEX 2024 · ~17% of spend' },
    cats: [
      { id: 'vehicle_payment', label: 'Car Payment / Lease', lock: 'floor', fixedCadence: true, bench: { avg: 430, source: 'BLS CEX 2024 · vehicle purchases (net outlay incl. financing)' } },
      { id: 'vehicle_insurance', label: 'Car Insurance', lock: 'floor', fixedCadence: true, bench: { avg: 165, source: 'BLS CEX 2024 · vehicle insurance' } },
      { id: 'gas', label: 'Gasoline', lock: 'elastic', bench: { avg: 165, source: 'BLS CEX 2024 · gasoline and motor oil' } },
      { id: 'maintenance', label: 'Maintenance & Repairs', lock: 'elastic', bench: { avg: 100, source: 'BLS CEX 2024 · vehicle maintenance' } },
      { id: 'public_transit', label: 'Public Transit', lock: 'elastic', bench: { avg: 95, source: 'BLS CEX 2024 · public & other transportation' } },
      { id: 'parking_tolls', label: 'Parking & Tolls', lock: 'elastic', bench: { avg: 40, source: 'BLS CEX 2024 · other vehicle expenses' } },
    ],
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    bench: { source: 'BLS CEX 2024 · ~8% of spend' },
    cats: [
      { id: 'health_insurance', label: 'Insurance Premiums', lock: 'floor', fixedCadence: true, bench: { avg: 350, source: 'BLS CEX 2024 · health insurance' } },
      { id: 'medical_services', label: 'Medical Services', lock: 'elastic', bench: { avg: 150, source: 'BLS CEX 2024 · medical services' } },
      { id: 'prescriptions', label: 'Prescriptions', lock: 'elastic', bench: { avg: 80, source: 'BLS CEX 2024 · drugs' } },
      { id: 'dental_vision', label: 'Dental & Vision', lock: 'elastic', bench: { avg: 40, source: 'BLS CEX 2024 · dental + vision care' } },
    ],
  },
  {
    id: 'savings',
    label: 'Savings & Retirement',
    payFirst: true,
    bench: { source: 'CEX 2024 "personal insurance & pensions" ~12.5%; FRED personal saving rate; Vanguard contribution data' },
    cats: [
      { id: 'k401', label: '401(k) / Roth', payFirst: true, lock: 'floor', bench: { avg: 0.07, pctOf: 'gross', median: 0.07, source: "Vanguard 2024 · typical employee deferral ≈7% (≈11% with employer match); Fidelity guideline 15%" } },
      { id: 'roth', label: 'Roth IRA', payFirst: true, lock: 'floor', bench: { avg: 200, median: 167, medianNote: 'Vanguard median IRA contribution ≈ $2,000/yr', source: 'Vanguard · median rollout ~$2,000/yr; 2025 limit $7,000/yr' } },
      { id: 'emergency', label: 'Emergency / Cash Buffer', payFirst: true, lock: 'floor', bench: { avg: 0.05, pctOf: 'takehome', source: 'FRED PSAVERT · U.S. personal saving rate ≈3.8% (2024), long-run ≈8.9%' } },
      { id: 'life_insurance', label: 'Life / Other Insurance', lock: 'floor', fixedCadence: true, bench: { avg: 48, source: 'BLS CEX 2024 · life and other personal insurance' } },
      { id: 'investments', label: 'Investments & Brokerage', flex: true, lock: 'elastic', bench: { avg: 0, source: 'Slack inside the savings envelope → invest more' } },
    ],
  },
  {
    id: 'other',
    label: 'Other (everything else)',
    bench: { source: 'BLS CEX 2024 · entertainment, apparel, personal care, misc' },
    cats: [
      { id: 'entertainment', label: 'Entertainment & Activities', lock: 'elastic', bench: { avg: 100, source: 'BLS CEX 2024 · entertainment' } },
      { id: 'subscriptions', label: 'Digital Subscriptions', lock: 'elastic', bench: { avg: 90, medianNote: 'No published median for streaming', source: 'Approx. from CEX entertainment detail' } },
      { id: 'mobile', label: 'Mobile & Phone', lock: 'elastic', bench: { avg: 95, source: 'BLS CEX 2024 · telephone services' } },
      { id: 'internet', label: 'Internet', lock: 'elastic', bench: { avg: 65, source: 'Approx. from CEX telecom detail' } },
      { id: 'apparel', label: 'Apparel', lock: 'elastic', bench: { avg: 160, source: 'BLS CEX 2024 · apparel & services' } },
      { id: 'personal_care', label: 'Personal Care', lock: 'elastic', bench: { avg: 80, source: 'BLS CEX 2024 · personal care products & services' } },
      { id: 'misc', label: 'Miscellaneous', lock: 'elastic', bench: { avg: 100, source: 'BLS CEX 2024 · miscellaneous expenditures' } },
    ],
  },
]