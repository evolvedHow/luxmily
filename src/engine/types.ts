/**
 * Pure domain types. Imports nothing from React or the DOM — the allocation and
 * status math stays testable in isolation.
 */

export type LockMode = 'hard' | 'floor' | 'ceiling' | 'elastic'

export type Viewpoint = 'top-down' | 'middle-out' | 'bottom-up'

/** A time-aware spending record for one line item. */
export interface Pacing {
  planned: number
  actual: number
  /** What you'd expect to have spent by today if perfectly evenly paced. */
  expected: number
  delta: number
  deltaPct: number
  /** Straight-line extrapolation to month end. */
  projected: number
  status: 'over' | 'under' | 'on-pace'
  dayFraction: number
}

interface Bench {
  /** Monthly avg (dollars) or a fraction of income/take-home, as the data says. */
  avg: number
  /** Monthly median (dollars) — only where actually published. */
  median?: number
  medianNote?: string
  source: string
  pctOf?: 'gross' | 'takehome'
}

export interface BudgetCategory extends Bench {
  id: string
  label: string
  /** Dollars/month the user commits. */
  plan: number
  /** Dollars actually spent this month. */
  actual: number
  lock: LockMode
  fixedCadence: boolean
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
  actual: number
  benchAvg: number
  benchMedian?: number
  benchMedianNote?: string
  benchSource: string
  payFirst: boolean
  flex: boolean
  fixedCadence: boolean
  pacing: Pacing
  /** Dollars spent beyond plan. */
  overPlan: number
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
  actualTotal: number
  /** Dollars by which plans exceed the theme allocation. */
  planOver: number
  /** Dollars by which actuals exceed plans. */
  spendOver: number
  benchShare: number
  benchSource: string
  pacing: Pacing
  cats: ResolvedCategory[]
}

export interface ResolvedBudget {
  incomeMonthly: number
  takeHome: number
  /** The hard spend number everything is measured against. */
  cap: number
  cohortId: string
  cohortLabel: string
  themes: ResolvedTheme[]
  /** Flattened pay-yourself-first fields for the mandatory strip. */
  payFirst: ResolvedCategory[]
  totalPlan: number
  totalActual: number
  totalPlanOver: number
  totalSpendOver: number
  /** Cap − totalPlan; negative means the plan overruns the Cap. */
  buffer: number
  /** True when the whole budget is in the green: shares, plans, actuals. */
  ok: boolean
  day: number
  totalDays: number
}