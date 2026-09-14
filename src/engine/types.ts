/**
 * Pure domain types. Imports nothing from React or the DOM — the allocation and
 * status math stays testable in isolation.
 */

export type LockMode = 'hard' | 'floor' | 'ceiling' | 'elastic'

export type Viewpoint = 'top-down' | 'planned' | 'observed'

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
  /** Dollars/month the user has discovered they actually spend. 0 = not entered. */
  observed: number
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
  /** The user's own observed spend. 0 means "haven't checked this line yet". */
  observed: number
  /** observed ÷ Cap × 100 — what the discovered number actually means. */
  observedPct: number
  /** observed − plan. Positive = over plan. */
  delta: number
  /** delta ÷ plan (only when observed > 0). */
  deltaPct: number
  benchAvg: number
  benchMedian?: number
  benchMedianNote?: string
  benchSource: string
  benchUrl?: string
  payFirst: boolean
  flex: boolean
  /** Surplus candidate: plan − observed, only when observed < plan. */
  surplus: number
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
  observedTotal: number
  /** Dollars by which plans exceed the theme allocation. */
  planOver: number
  /** What the user must find elsewhere. */
  observedOverPlan: number
  /** Room this theme gave back where spending came in below plan. */
  reallocatable: number
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
  themes: ResolvedTheme[]
  /** Flattened pay-yourself-first fields for the mandatory strip. */
  payFirst: ResolvedCategory[]
  totalPlan: number
  totalObserved: number
  totalPlanOver: number
  /** Total spending discovered above plan. */
  observedOverPlan: number
  /** What came in under plan and is free to move elsewhere. */
  reallocatable: number
  /** Cap − totalPlan; negative means the plan overruns the Cap. */
  buffer: number
  /** True when the whole budget is green: plans fit every theme's allocation. */
  ok: boolean
}