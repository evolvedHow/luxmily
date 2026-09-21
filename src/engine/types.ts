/**
 * Pure domain types. Imports nothing from React or the DOM — the allocation and
 * status math stays testable in isolation.
 */

/**
 * There is one viewpoint now. The old 'top-down' / 'planned' split existed
 * because theme shares and category dollars were independent models of the
 * same money; they are one model now (dollars up, share derived), so the
 * toggle had nothing left to toggle. Locks do the job it was reaching for.
 */

/** Where a budget is localized (user ZIP → area). `cola` / `rentFactor` are
 *  multipliers against US average (1.00 = national). Grounded in public BEA RPP
 *  + ACS figures via a curated ZIP3-level table, so it is an approximate
 *  regional guide, not official per-ZIP data. */
export interface BudgetLocation {
  zip: string
  /** Area label, e.g. "New York City" / "Atlanta metro". */
  metro: string
  cola: number
  rentFactor: number
  /** Median household income for the area (annual $) — context only. */
  medianIncome: number
  matched: boolean
}

interface Bench {
  /** Monthly avg (dollars) or a fraction of income/take-home, as the data says. */
  avg: number
  /** Monthly median (dollars) — only where actually published. */
  median?: number
  medianNote?: string
  source: string
  url?: string
  pctOf?: 'gross' | 'takehome'
}

export interface BudgetCategory extends Bench {
  id: string
  label: string
  /** Dollars/month the user commits to this line. */
  plan: number
  /** Pinned by the user — never moves when its theme is resized. */
  locked: boolean
  /** Pay-yourself-first field (401k / Roth / savings), shown on the strip. */
  payFirst: boolean
  /** Slack absorber inside its theme (e.g. investments envelope). */
  flex: boolean
}

export interface BudgetTheme {
  id: string
  label: string
  /** Pinned by the user — its total never moves. */
  locked: boolean
  payFirst: boolean
  /** Cohort benchmark share of spend. */
  benchShare: number
  benchSource: string
  cats: BudgetCategory[]
}

export interface Budget {
  incomeMonthly: number
  /** What you can spend — the hard Cap. */
  takeHome: number
  cohortId: string
  cohortLabel: string
  /** Where the benchmarks are localized, when a ZIP was given. */
  location?: BudgetLocation
  themes: BudgetTheme[]
}

/* ---------- Resolved output ---------- */

export interface ResolvedCategory {
  id: string
  /** Owning theme id — used to address the store. */
  themeId: string
  label: string
  locked: boolean
  plan: number
  benchAvg: number
  benchMedian?: number
  benchMedianNote?: string
  benchSource: string
  benchUrl?: string
  payFirst: boolean
  flex: boolean
}

export interface ResolvedTheme {
  id: string
  label: string
  payFirst: boolean
  locked: boolean
  /**
   * Derived, not set: this theme's planned dollars over the Cap. Shares no
   * longer sum to 1 — whatever is left over sits in `unallocated`.
   */
  share: number
  planTotal: number
  /** Sum of the locked category plans inside this theme (its hard floor). */
  lockedTotal: number
  /** True when every category here is locked, so the theme cannot be resized. */
  fullyLocked: boolean
  benchShare: number
  benchSource: string
  /** Distinct sources backing this theme's rows, each with its link. */
  sources: { label: string; url?: string }[]
  cats: ResolvedCategory[]
}

export interface ResolvedBudget {
  incomeMonthly: number
  takeHome: number
  /** The hard spend number everything is measured against. */
  cap: number
  cohortId: string
  cohortLabel: string
  /** Localization info, when the user entered a ZIP. */
  location?: BudgetLocation
  themes: ResolvedTheme[]
  /** Flattened pay-yourself-first fields for the mandatory strip. */
  payFirst: ResolvedCategory[]
  totalPlan: number
  /**
   * The holding bucket: Cap − totalPlan. Money freed by trimming a category
   * waits here until it is allocated somewhere else or swept into the
   * emergency buffer. Negative means the plan overruns the Cap.
   */
  unallocated: number
  /** True when the plan fits inside the Cap. */
  ok: boolean
}