/**
 * "Where do I stand?" context for the About sheet.
 *
 * These are REFERENCE approximations only — they live in the About popup, never
 * in the budget math. Two families of numbers:
 *
 *  - Cohort standing: which segment of U.S. households the user's income band
 *    roughly represents (household income percentile, not net worth). Classed
 *    from the same 6 income bands used by the benchmarks, mapped to an
 *    approximate U.S. ACS income distribution.
 *  - Net worth thresholds: where the common "10% / 1%" markers sit in dollar
 *    terms, so the number has a shape. Net worth is wealth, not income — we
 *    never pretend the app knows the user's net worth.
 *
 * Sources are the standard public references and are linked in the UI.
 */

export interface CohortStanding {
  /** Approximate share of U.S. households earning at or above this cohort's
   *  floor. For c1 (the bottom band) there is no "top" reading — ~30% of
   *  households sit inside it, so its label says "lower", not "top". */
  topPct: number
  /** Short human label, e.g. "top ~12%". */
  label: string
  note: string
}

export const COHORT_STANDING: Record<string, CohortStanding> = {
  c1: { topPct: 0.7, label: 'lower ~30% of households', note: 'under $40k/yr' },
  c2: { topPct: 0.52, label: 'around the US median', note: '$40–75k/yr' },
  c3: { topPct: 0.37, label: 'top ~37% of households', note: '$75–110k/yr' },
  c4: { topPct: 0.22, label: 'top ~22% of households', note: '$110–150k/yr' },
  c5: { topPct: 0.12, label: 'top ~12% of households', note: '$150–200k/yr' },
  c6: { topPct: 0.07, label: 'top ~7% of households', note: '$200k+/yr' },
}

export interface NetWorthThreshold {
  label: string
  value: string
  note: string
}

export const US_NET_WORTH: NetWorthThreshold[] = [
  { label: 'Median US household', value: '~$192,000', note: 'typical family' },
  { label: 'Top 10%', value: '~$1.9M', note: 'where “wealthy” usually starts' },
  { label: 'Top 1%', value: '~$13.9M', note: 'the famous 1% line' },
]

export const US_STANDING_SOURCES = [
  {
    label: 'U.S. Census · income distribution (approx. mapping, not exact percentile data)',
    url: 'https://www.census.gov/data/tables/time-series/demo/income-poverty/historical-income-households.html',
  },
  {
    label: 'Federal Reserve SCF 2022 · net worth thresholds',
    url: 'https://www.federalreserve.gov/econres/scfindex.htm',
  },
]