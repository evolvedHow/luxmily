/**
 * Personal Inflation Index — pure domain types. Imports nothing from React or
 * the DOM. The reference BLS dataset, personal profiles and the calculation
 * engine stay testable in isolation, mirroring the app's `engine/` constraint.
 *
 * The four questions the feature answers stay conceptually separate (§56):
 *  1. What is happening?               → official BLS CPI (`BLS_*`)
 *  2. What is happening to me?         → personal CPI (`PiiProfile` weights × BLS)
 *  3. What is likely to happen to me?  → forward assumptions (`PiiProfile.future`)
 *  4. What does it mean for my money?  → budget inflation / spending forecast
 */

/* ------------------------------- BLS reference ------------------------------ */

export type Period = string // "YYYY-MM"

/** A BLS CPI series (index level), e.g. CUUR0000SA1F. */
export interface BlsSeries {
  /** BLS series id is the fundamental identifier — never rely on names alone. */
  id: string
  /** Official BLS series title, e.g. "Food in U.S. city average, all urban consumers…" */
  title: string
  /** Short display label, e.g. "Food". */
  label: string
  /** Major CPI-U group this item belongs to. */
  group: string
  /** Optional taxonomy parent series id. */
  parentId?: string
  /** Depth in the BLS item hierarchy (0 = all items). */
  level: number
  /** Latest published CPI-U relative importance (share of expenditure, 0..1). */
  relImportance?: number
  /** Data provenance note (e.g. which distribution the snapshot used). */
  sourceNote?: string
}

/** One monthly index observation. `index` is the published index level. */
export interface BlsObservation {
  period: Period
  index: number
}

/** A reference dataset: series taxonomy + monthly observations + provenance. */
export interface BlsDataset {
  /** Snapshot/version tag, e.g. "bls-cpiu-2026-08". */
  version: string
  /** Population + geography this dataset reflects. */
  scope: { population: string; area: string }
  series: Record<string, BlsSeries>
  /** seriesId → sorted monthly observations (ascending period). */
  observations: Record<string, BlsObservation[]>
  /** Epoch of the source data (when the reference snapshot was fetched). */
  asOf: string
}

/* ------------------------------ Personal side ------------------------------ */

/** How a personal expense gets its price change. */
export type Mapping =
  | { kind: 'series'; seriesId: string } // exact BLS series
  | { kind: 'composite'; parts: { seriesId: string; share: number }[] } // weighted mix of BLS series
  | { kind: 'custom'; rate: number } // user-defined inflation, %/yr
  | { kind: 'excluded' } // excluded from the CPI calculation

export type CostType = 'fixed' | 'variable' | 'semi-variable' | 'contractual' | 'discretionary'

/** How market price change passes into the user's actual cash requirement
 *  (Budget Inflation — a distinct concept from Personal CPI). */
export type PassThrough =
  | { mode: 'market' } // actual spending grows with the CPI of that category
  | { mode: 'fixed' } // contractual / fixed — does not follow the CPI at all
  | { mode: 'custom'; rate: number } // user's own expectation for the cash line

export interface PersonalCategory {
  id: string
  label: string
  /** Optional grouping container id (display only — weights live on leaves). */
  parentId?: string
  mapping: Mapping
  /** Fixed / variable / contractual classification — advisory, disclosed. */
  cost?: CostType
  /** How this line's cash requirement moves (Budget Inflation model). */
  passThrough: PassThrough
}

export interface PiiProfile {
  id: string
  label: string
  /** Bumped on structural change so old calculations are never silently rewritten. */
  version: number
  createdAt: string
  updatedAt: string
  categories: PersonalCategory[]
  /** Leaf weights, keyed by category id, target sum 1. */
  weights: Record<string, number>
  /** Forward-looking inflation assumptions (%/yr) per leaf id. */
  future: Record<string, number>
  /** Optional annual spend ($/yr) per leaf id — used to generate weights + forecast. */
  spending: Record<string, number>
  weightSource: 'custom' | 'spend' | 'budget'
  basePeriod: Period
  /** Where the starting mix came from, shown verbatim in methodology. */
  notes?: string
}

/** A scenario modifies a profile's weights / assumptions / spending without
 *  touching the profile itself. Overrides are sparse. */
export interface PiiScenario {
  id: string
  label: string
  profileId: string
  /** Category id → weight (leaf, sparse). */
  weightOverrides: Record<string, number>
  /** Category id → annualized inflation assumption % (sparse). */
  assumptionOverrides: Record<string, number>
  /** Category id → annual spend $ (sparse). */
  spendingOverrides: Record<string, number>
  notes?: string
}

/* ------------------------------- Calculation ------------------------------- */

/** Source used for one category's price change. */
export type SourceKind = 'bls' | 'user' | 'excluded' | 'missing'

export interface CategoryContribution {
  /** Leaf category this contribution belongs to. */
  categoryId: string
  label: string
  parentId?: string
  /** Leaf weight, 0..1. */
  weight: number
  /** Which series/assumption produced the price change. */
  source: SourceKind
  sourceDetail: string
  /** Category price change over the period (fraction, e.g. 0.055 = 5.5%). */
  catChange: number
  /** Contribution in percentage points (weight × catChange). */
  contributionPts: number
  /** Annual value used when the price change came from an assumption. */
  annualRate?: number
}

export interface PiResult {
  /** Personal inflation over the period (fraction). */
  total: number
  /** Same in percentage points for display. */
  totalPts: number
  /** Annualized (CAGR) rate over the period, when months > 1 (fraction). */
  annualized: number
  from: Period
  to: Period
  months: number
  contributions: CategoryContribution[]
  /** True if any leaf had no BLS data and was carried/assumed. */
  assumptions: boolean
  /** Weight coverage of the profile in this calculation (0..1). */
  covered: number
  methodology?: Methodology
}

export interface Methodology {
  population: string
  area: string
  datasetVersion: string
  dataAsOf: string
  profileLabel: string
  profileVersion: number
  weightSource: string
  basePeriod: Period | null
  weightBasis: 'current-weights' | 'historical-weights'
  baseWeights: Record<string, number>
  calculation: string
  note?: string
}