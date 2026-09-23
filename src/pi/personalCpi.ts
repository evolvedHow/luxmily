/**
 * Personal CPI — reverse-engineer "current inflation" from the allocated
 * budget. Every plan line maps to a CPI-U category (or a custom yearly rate,
 * or is excluded — savings are not consumption). Each category's current
 * year-over-year inflation is weighted by the dollars actually allocated to
 * it, so a budget with no mortgage barely feels shelter inflation, a budget
 * carrying private insurance feels medical inflation hard, and so on.
 *
 * The output is a single number: the inflation rate this budget is operating
 * under today. If next year's allocation looks like this, income growth should
 * beat that rate to stay even.
 *
 * Pure + offline: reads the embedded BLS snapshot only. No tracking, no
 * expenses — just the plan and official data.
 */

import type { ResolvedBudget } from '../engine/types'
import { embedded, BLS_DATA_VERSION, BLS_DATA_ASOF, BLS_SCOPE } from './bls/data'
import { ALL_ITEMS_ID, blsSeriesById } from './blsMetadata'
import { shift } from './period'
import type { Period } from './types'

type Part = { seriesId: string; share: number }

type MapDef =
  /** `ri` overrides the series' published relative importance when that figure
   *  is the wrong weight for this budget line (see `other.misc`). */
  | { kind: 'series'; seriesId: string; ri?: number }
  | { kind: 'composite'; parts: Part[] }
  | { kind: 'custom'; ratePct: number }
  | { kind: 'excluded' }

/**
 * Budget category id → CPI-U mapping. Single series where the CPI has a
 * faithful line (shelter, groceries, gas,...), a blend where the budget line
 * spans two CPI items (car payment ≈ new vehicles, medical services ≈
 * hospitals + physicians), a custom yearly rate where no clean CPI line exists
 * (home insurance, parking/tolls, dental/vision, subscriptions, internet...),
 * and excluded for savings (not consumption).
 */
const CPI_MAP: Record<string, MapDef> = {
  'housing.shelter': { kind: 'series', seriesId: 'CUUR0000SAH1' },
  'housing.utilities': { kind: 'series', seriesId: 'CUUR0000SAH2' },
  'housing.home_maint': { kind: 'series', seriesId: 'CUUR0000SAH3' },
  'housing.home_insurance': { kind: 'custom', ratePct: 4 },

  'food.groceries': { kind: 'series', seriesId: 'CUUR0000SAF11' },
  'food.dining_out': { kind: 'series', seriesId: 'CUUR0000SEFV' },

  'transport.vehicle_payment': {
    kind: 'composite',
    parts: [
      { seriesId: 'CUUR0000SETA01', share: 0.58 },
      { seriesId: 'CUUR0000SETA02', share: 0.42 },
    ],
  },
  'transport.vehicle_insurance': { kind: 'series', seriesId: 'CUUR0000SETE' },
  'transport.gas': { kind: 'series', seriesId: 'CUUR0000SETB01' },
  'transport.maintenance': { kind: 'series', seriesId: 'CUUR0000SETD' },
  'transport.public_transit': { kind: 'series', seriesId: 'CUUR0000SETG' },
  'transport.rideshare': {
    kind: 'composite',
    parts: [
      { seriesId: 'CUUR0000SETG', share: 0.5 },
      { seriesId: 'CUUR0000SETB01', share: 0.5 },
    ],
  },
  'transport.parking_tolls': { kind: 'custom', ratePct: 3 },

  'healthcare.health_insurance': { kind: 'series', seriesId: 'CUUR0000SAM1' },
  'healthcare.medical_services': {
    kind: 'composite',
    parts: [
      { seriesId: 'CUUR0000SEMD01', share: 0.55 },
      { seriesId: 'CUUR0000SEMC01', share: 0.45 },
    ],
  },
  'healthcare.prescriptions': { kind: 'series', seriesId: 'CUUR0000SEMF01' },
  'healthcare.dental_vision': { kind: 'custom', ratePct: 4 },

  'savings.k401': { kind: 'excluded' },
  'savings.roth': { kind: 'excluded' },
  'savings.emergency': { kind: 'excluded' },
  'savings.life_insurance': { kind: 'excluded' },
  'savings.investments': { kind: 'excluded' },

  'travel.airfare': { kind: 'series', seriesId: 'CUUR0000SETG01' },
  'travel.lodging': { kind: 'series', seriesId: 'CUUR0000SEHB' },
  'travel.ground': { kind: 'custom', ratePct: 3 },

  'other.entertainment': { kind: 'series', seriesId: 'CUUR0000SAR' },
  'other.subscriptions': { kind: 'custom', ratePct: 4 },
  'other.mobile': { kind: 'series', seriesId: 'CUUR0000SAE' },
  'other.internet': { kind: 'custom', ratePct: 3 },
  'other.apparel': { kind: 'series', seriesId: 'CUUR0000SAA' },
  'other.personal_care': { kind: 'series', seriesId: 'CUUR0000SAG' },
  // All-items is the right *rate* for a catch-all line, but its relative
  // importance is 1.0 — the whole national basket. Left unchecked that single
  // row carried ~59% of the official-weight comparison and flattened every
  // other theme. Weight it as the small residual bucket it actually is.
  'other.misc': { kind: 'series', seriesId: 'CUUR0000SA0', ri: 0.02 },
}

function seriesLabel(seriesId: string): string {
  return blsSeriesById[seriesId]?.label ?? seriesId
}

function mappedLabel(def: MapDef): string {
  if (def.kind === 'series') return seriesLabel(def.seriesId)
  if (def.kind === 'composite') return def.parts.map((p) => seriesLabel(p.seriesId)).join(' + ')
  if (def.kind === 'custom') return 'custom rate'
  return 'excluded'
}

/**
 * The official CPI-U relative importance behind a mapping — i.e. how much
 * weight the *national* basket gives this line. This is the number a personal
 * index is measured against: CPI weights shelter ~35.6% of its basket, and if
 * your plan only puts 6% there you simply do not feel shelter inflation the
 * way the headline number says you do.
 *
 * Returns undefined for custom-rate and excluded lines, which have no CPI
 * counterpart to compare against.
 */
function officialWeight(def: MapDef): number | undefined {
  if (def.kind === 'series') return def.ri ?? blsSeriesById[def.seriesId]?.relImportance
  if (def.kind === 'composite') {
    let out = 0
    for (const part of def.parts) {
      const ri = blsSeriesById[part.seriesId]?.relImportance
      if (ri === undefined) return undefined
      out += part.share * ri
    }
    return out
  }
  return undefined
}

/** Latest month with a published value for a series (index math from `from`). */
function latestIndex(seriesId: string): number {
  const row = embedded[seriesId]
  if (!row) return -1
  for (let i = row.v.length - 1; i >= 0; i--) if (row.v[i] != null) return i
  return -1
}

function indexToPeriod(row: { from: Period }, i: number): Period {
  const fy = Number(row.from.slice(0, 4))
  const fm = Number(row.from.slice(5, 7)) - 1
  const t = fy * 12 + fm + i
  const y = Math.floor(t / 12)
  const m = (t % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

/** Carry-forward lookup: value at target month, or the last value published at
 *  or before it (missing lanes stay on the latest known observation). */
function obsAt(seriesId: string, target: Period): number | null {
  const row = embedded[seriesId]
  if (!row) return null
  const fy = Number(row.from.slice(0, 4))
  const fm = Number(row.from.slice(5, 7)) - 1
  const ty = Number(target.slice(0, 4))
  const tm = Number(target.slice(5, 7)) - 1
  let i = ty * 12 + tm - (fy * 12 + fm)
  while (i >= 0) {
    const v = row.v[i]
    if (v != null) return v
    i--
  }
  return null
}

/** Latest published period across the dataset (the "current CPI" month). */
export function latestPublishedPeriod(): Period | null {
  const i = latestIndex(ALL_ITEMS_ID)
  const row = embedded[ALL_ITEMS_ID]
  if (i < 0 || !row) return null
  return indexToPeriod(row, i)
}

/** Year-over-year inflation (percentage points, e.g. 3.2) for a series at
 *  `target`, carry-forwarding missing months. null when the data is absent. */
export function seriesRate(seriesId: string, target: Period): number | null {
  const now = obsAt(seriesId, target)
  const then = obsAt(seriesId, shift(target, -12))
  if (now == null || then == null || then <= 0) return null
  return (now / then - 1) * 100
}

function defRate(def: MapDef, target: Period): number | null {
  if (def.kind === 'series') return seriesRate(def.seriesId, target)
  if (def.kind === 'composite') {
    let out = 0
    for (const p of def.parts) {
      const r = seriesRate(p.seriesId, target)
      if (r == null) return null
      out += p.share * r
    }
    return out
  }
  if (def.kind === 'custom') return def.ratePct
  return null
}

export interface CpiContribution {
  themeId: string
  catId: string
  label: string
  /** Dollars/mo allocated to this line. */
  plan: number
  /** Mapped CPI category (label, or "custom rate"). */
  mappedLabel: string
  /** That category's current y/y inflation (%). */
  inflationPct: number | null
  /** Your allocation's share of the covered basket (%). */
  weightPct: number
  /**
   * What the official CPI-U basket weights this line, renormalized over the
   * same covered set so it compares like-for-like with `weightPct` (%).
   * undefined for custom-rate lines with no CPI counterpart.
   */
  officialWeightPct?: number
  /** share × inflation — this line's contribution to the personal rate (pts). */
  contributionPts: number
}

/** Per-theme rollup — the level users actually reason about. */
export interface CpiThemeRollup {
  themeId: string
  label: string
  /** Dollars/mo this theme contributes to the covered basket. */
  plan: number
  /** Your share of the covered basket (%). */
  weightPct: number
  /** CPI-U's own share of the same covered set (%), when comparable. */
  officialWeightPct?: number
  /** Dollar-weighted inflation across this theme's lines (%). */
  inflationPct: number | null
  /** Points of your personal rate that come from this theme. */
  contributionPts: number
}

export interface PersonalCpiResult {
  /** Your current personal inflation rate (y/y, %). null when uncomputable. */
  ratePct: number | null
  /** Official all-items CPI-U rate over the same window (%), for comparison. */
  officialPct: number | null
  /** As-of month for the computed rates. */
  asOf: Period | null
  /** Dollars/mo covered by the CPI basket (excludes savings). */
  coveredPlan: number
  /** Dollars/mo allocated to savings (held out of the basket). */
  excludedPlan: number
  contributions: CpiContribution[]
  /** The same contributions grouped by budget theme. */
  themes: CpiThemeRollup[]
  version: string
  area: string
  population: string
}

export const personalCpi = { version: BLS_DATA_VERSION, committed: BLS_DATA_ASOF }

/**
 * Current personal CPI for a resolved budget: allocate each category's current
 * inflation by the dollars the optimized plan actually assigns to it.
 */
export function currentPersonalCpi(r: ResolvedBudget): PersonalCpiResult {
  const asOf = latestPublishedPeriod()

  const rows = r.themes.flatMap((t) => t.cats.map((c) => ({ t, c })))

  const covered = rows.filter(({ t, c }) => {
    const def = CPI_MAP[`${t.id}.${c.id}`]
    return def && def.kind !== 'excluded' && c.plan > 0
  })
  const excludedPlan = rows
    .filter(({ t, c }) => {
      const def = CPI_MAP[`${t.id}.${c.id}`]
      return def && def.kind === 'excluded' && c.plan > 0
    })
    .reduce((s, { c }) => s + c.plan, 0)

  const coveredPlan = covered.reduce((s, { c }) => s + c.plan, 0)

  // Official CPI weights, renormalized across exactly the lines we cover, so
  // "CPI says 36%, you say 25%" is a like-for-like comparison rather than a
  // comparison against the full national basket (which includes items this
  // budget has no line for).
  const officialTotal = covered.reduce((sum, { t, c }) => {
    const w = officialWeight(CPI_MAP[`${t.id}.${c.id}`]!)
    return sum + (w ?? 0)
  }, 0)

  const contributions: CpiContribution[] = covered.map(({ t, c }) => {
    const def = CPI_MAP[`${t.id}.${c.id}`]!
    const inflationPct = asOf ? defRate(def, asOf) : null
    const weight = coveredPlan > 0 ? c.plan / coveredPlan : 0
    const ow = officialWeight(def)
    return {
      themeId: t.id,
      catId: c.id,
      label: c.label,
      plan: c.plan,
      mappedLabel: mappedLabel(def),
      inflationPct,
      weightPct: weight * 100,
      officialWeightPct: ow !== undefined && officialTotal > 0 ? (ow / officialTotal) * 100 : undefined,
      contributionPts: inflationPct != null ? weight * inflationPct : 0,
    }
  })

  contributions.sort((a, b) => b.contributionPts - a.contributionPts)

  // Theme rollup — the altitude the user actually allocates at.
  const themes: CpiThemeRollup[] = r.themes
    .map((t): CpiThemeRollup => {
      const rows = contributions.filter((c) => c.themeId === t.id)
      const plan = rows.reduce((sum, c) => sum + c.plan, 0)
      const weightPct = rows.reduce((sum, c) => sum + c.weightPct, 0)
      const contributionPts = rows.reduce((sum, c) => sum + c.contributionPts, 0)
      const official = rows.reduce<number | undefined>(
        (sum, c) => (c.officialWeightPct === undefined || sum === undefined ? sum : sum + c.officialWeightPct),
        0,
      )
      return {
        themeId: t.id,
        label: t.label,
        plan,
        weightPct,
        officialWeightPct: official,
        // Dollar-weighted inflation within the theme: the rate this theme is
        // running at, independent of how big a slice of the budget it is.
        inflationPct: weightPct > 0 ? (contributionPts / weightPct) * 100 : null,
        contributionPts,
      }
    })
    .filter((t) => t.plan > 0)
    .sort((a, b) => b.contributionPts - a.contributionPts)

  const ratePct =
    covered.length > 0 && contributions.every((c) => c.inflationPct != null)
      ? contributions.reduce((s, c) => s + c.contributionPts, 0)
      : null

  return {
    ratePct,
    officialPct: asOf ? seriesRate(ALL_ITEMS_ID, asOf) : null,
    asOf,
    coveredPlan,
    excludedPlan,
    contributions,
    themes,
    version: BLS_DATA_VERSION,
    area: BLS_SCOPE.area,
    population: BLS_SCOPE.population,
  }
}

/** Debug/sanity export: every budget category id in the themes has a map def. */
export function coveredCategoryCount(): number {
  return Object.values(CPI_MAP).filter((d) => d.kind !== 'excluded').length
}