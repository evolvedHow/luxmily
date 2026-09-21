/**
 * Pure domain types. Imports nothing from React or the DOM — the allocation and
 * status math stays testable in isolation.
 */

export type LockMode = 'hard' | 'floor' | 'ceiling' | 'elastic'

export type Viewpoint = 'top-down' | 'planned'

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
  lock: LockMode
  /** Pay-yourself-first field (401k / Roth / savings), shown on the strip. */
  payFirst: boolean
  /** Slack absorber inside its theme (e.g. investments envelope). */
  flex: boolean
}

export interface BudgetTheme {
  id: string
  label: string
  /** User's target share of the Cap, 0..1. */
  share: number
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
  lock: LockMode
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
  /** The user's setting, what the slider shows. */
  targetShare: number
  /** After the solver ensured shares sum to 1. */
  share: number
  /** share × Cap. */
  allocation: number
  planTotal: number
  /** Dollars by which plans exceed the theme allocation. */
  planOver: number
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
  totalPlanOver: number
  /** Cap − totalPlan; negative means the plan overruns the Cap. */
  buffer: number
  /** True when the whole budget is green: plans fit every theme's allocation. */
  ok: boolean
}