/**
 * Personal Inflation Index engine — pure, dependency-free (no React, no DOM).
 *
 * Concepts (§ per spec):
 *  - Personal CPI: base-weighted average of the price change of the consumption
 *    categories the user actually buys, each mapped to an official BLS CPI-U
 *    series (or a weighted composite, or a user assumption), Laspeyres-type
 *    with weights taken from the profile and normalized over the covered basket.
 *  - Budget Inflation: a separate metric — how the user's actual cash
 *    requirement moves, given each line's PassThrough (market / fixed / custom).
 *  - Forward: expected personal inflation from explicit assumptions; falls back
 *    to the latest 12-month BLS pace for each mapped series.
 *  - Forecast: current spend × the forward assumptions, compounded per year.
 */

import { blsSeriesById } from './blsMetadata'
import { indexAtOrBefore } from './bls'
import { monthDiff, toY, toM } from './period'
import type {
  BlsDataset,
  CategoryContribution,
  Mapping,
  PersonalCategory,
  PiiProfile,
  PiiScenario,
  Period,
  PiResult,
  SourceKind,
} from './types'

export const ALL_ITEMS = 'CUUR0000SA0'

/* ------------------------------ helpers ------------------------------ */

export function annualize(change: number, months: number): number {
  if (months <= 1) return change
  return Math.pow(1 + change, 12 / months) - 1
}

/** Expand a mapping into plain BLS series shares (sum 1). Empty for custom/excluded. */
export function mappingShares(mapping: Mapping): { seriesId: string; share: number }[] {
  switch (mapping.kind) {
    case 'series':
      return [{ seriesId: mapping.seriesId, share: 1 }]
    case 'composite': {
      const p = mapping.parts
      const tot = p.reduce((a, b) => a + b.share, 0)
      return tot > 0 ? p.map((x) => ({ seriesId: x.seriesId, share: x.share / tot })) : []
    }
    default:
      return []
  }
}

/** Leaves: mapped (non-excluded) categories, weight-normalized copies for math. */
export interface BasketItem {
  category: PersonalCategory
  /** Original weight as stored in the profile. */
  rawWeight: number
  /** Normalized over the covered basket. */
  weight: number
}

export function basketOf(profile: PiiProfile): BasketItem[] | null {
  const leaves = profile.categories.filter((c) => c.mapping.kind !== 'excluded')
  const covered = leaves.reduce((a, c) => a + (profile.weights[c.id] ?? 0), 0)
  if (covered <= 0) return null
  return leaves.map((category) => ({
    category,
    rawWeight: profile.weights[category.id] ?? 0,
    weight: (profile.weights[category.id] ?? 0) / covered,
  }))
}

export function coveredWeight(profile: PiiProfile): number {
  return profile.categories
    .filter((c) => c.mapping.kind !== 'excluded')
    .reduce((a, c) => a + (profile.weights[c.id] ?? 0), 0)
}

/* ------------------------------ price change ------------------------------ */

export interface SeriesHit {
  seriesId: string
  base: { period?: Period; index?: number } | undefined
  to: { period?: Period; index?: number } | undefined
}

export interface CategoryChange {
  change: number // fraction over the period
  source: SourceKind
  sourceDetail: string
  missing: boolean
  annualRate?: number
}

const SERIES_LABEL = (id: string) => blsSeriesById[id]?.label ?? id

function seriesRatio(
  dataset: BlsDataset,
  seriesId: string,
  base: Period,
  to: Period,
): { ratio: number; missing: boolean; detail: string } | null {
  const b = indexAtOrBefore(dataset, seriesId, base)
  const t = indexAtOrBefore(dataset, seriesId, to)
  if (!b || !t || b.index <= 0) return null
  const carried = b.period !== base || t.period !== to
  return {
    ratio: t.index / b.index,
    missing: carried,
    detail:
      `${SERIES_LABEL(seriesId)} · ${b.period}:${b.index.toFixed(2)} → ${t.period}:${t.index.toFixed(2)}` +
      (carried ? ' (latest available)' : ''),
  }
}

export function categoryChange(
  dataset: BlsDataset,
  mapping: Mapping,
  base: Period,
  to: Period,
): CategoryChange {
  switch (mapping.kind) {
    case 'series': {
      const hit = seriesRatio(dataset, mapping.seriesId, base, to)
      if (!hit)
        return { change: 0, source: 'missing', sourceDetail: `No BLS data for ${mapping.seriesId}`, missing: true }
      return { change: hit.ratio - 1, source: 'bls', sourceDetail: hit.detail, missing: hit.missing }
    }
    case 'composite': {
      const parts = mappingShares(mapping)
      if (parts.length === 0)
        return { change: 0, source: 'missing', sourceDetail: 'Empty composite', missing: true }
      let change = 0
      let missing = false
      const seen: string[] = []
      for (const p of parts) {
        const hit = seriesRatio(dataset, p.seriesId, base, to)
        if (!hit) {
          missing = true
          continue
        }
        change += p.share * (hit.ratio - 1)
        missing = missing || hit.missing
        seen.push(`${SERIES_LABEL(p.seriesId)}`)
      }
      if (seen.length === 0)
        return { change: 0, source: 'missing', sourceDetail: 'No BLS data', missing: true }
      return {
        change,
        source: 'bls',
        sourceDetail: `Mix of ${seen.filter((x, i) => seen.indexOf(x) === i).join(' + ')}`,
        missing,
      }
    }
    case 'custom': {
      const months = monthDiff(base, to)
      if (months <= 0) return { change: 0, source: 'user', sourceDetail: 'User assumption (no span)', missing: false }
      const rate = mapping.rate / 100
      return {
        change: Math.pow(1 + rate, months / 12) - 1,
        source: 'user',
        sourceDetail: `User assumption ${mapping.rate}%/yr`,
        missing: false,
        annualRate: mapping.rate,
      }
    }
    case 'excluded':
      return { change: 0, source: 'excluded', sourceDetail: 'Excluded from basket', missing: false }
  }
}

/** Forward assumption for a leaf, %/yr. Explicit profile.future wins; mappings
 *  with a fixed rate win over series; else the series' latest 12-month pace. */
export function forwardAssumption(
  profile: PiiProfile,
  dataset: BlsDataset,
  category: PersonalCategory,
  asOf: Period,
): number {
  const explicit = profile.future[category.id]
  if (explicit !== undefined && Number.isFinite(explicit)) return explicit

  const m = category.mapping
  if (m.kind === 'custom') return m.rate
  if (m.kind === 'excluded') return 0

  const rate = compositePace(dataset, m, asOf)
  if (rate === null) return fallbackPace(dataset, asOf)
  return rate
}

/** Latest 12-month change (%) of a mapping as of `period`, or null when unavailable. */
export function compositePace(
  dataset: BlsDataset,
  mapping: Mapping,
  asOf: Period,
): number | null {
  const parts = mappingShares(mapping)
  if (parts.length === 0) return null
  let w = 0
  let acc = 0
  for (const p of parts) {
    const a = indexAtOrBefore(dataset, p.seriesId, asOf)
    const b = indexAtOrBefore(dataset, p.seriesId, shiftYear(asOf))
    if (!a || !b) continue
    acc += p.share * (a.index / b.index - 1)
    w += p.share
  }
  return w > 0 ? acc / w * 100 : null
}

function fallbackPace(dataset: BlsDataset, asOf: Period): number {
  const a = indexAtOrBefore(dataset, ALL_ITEMS, asOf)
  const b = indexAtOrBefore(dataset, ALL_ITEMS, shiftYear(asOf))
  return a && b ? (a.index / b.index - 1) * 100 : 2
}

function shiftYear(p: Period): Period {
  const y = toY(p) - 1
  const m = toM(p)
  return `${y}-${String(m).padStart(2, '0')}`
}

/* ------------------------------ personal CPI ------------------------------ */

export interface CalcInput {
  profile: PiiProfile
  dataset: BlsDataset
  from: Period
  to: Period
  /** Optional sparse per-category weight overrides (scenario) — merged & renormed. */
  weightOverrides?: Record<string, number>
}

export function calcPersonalInflation(input: CalcInput): PiResult | null {
  const { profile, dataset, from, to, weightOverrides } = input
  if (from >= to) return null
  const months = monthDiff(from, to)

  const merged = { ...profile.weights, ...weightOverrides }
  const leaves = profile.categories.filter((c) => c.mapping.kind !== 'excluded')
  const covered = leaves.reduce((a, c) => a + (merged[c.id] ?? 0), 0)
  if (covered <= 0) return null

  const contributions: CategoryContribution[] = []
  let total = 0
  let anyMissing = false
  let sources = new Set<SourceKind>()

  for (const cat of leaves) {
    const w = (merged[cat.id] ?? 0) / covered
    const cc = categoryChange(dataset, cat.mapping, from, to)
    const contributionPts = w * cc.change
    total += contributionPts
    anyMissing = anyMissing || cc.missing
    sources.add(cc.source)
    contributions.push({
      categoryId: cat.id,
      label: cat.label,
      parentId: cat.parentId,
      weight: w,
      source: cc.source,
      sourceDetail: cc.sourceDetail,
      catChange: cc.change,
      contributionPts,
      annualRate: cc.annualRate,
    })
  }

  contributions.sort((a, b) => Math.abs(b.contributionPts) - Math.abs(a.contributionPts))

  return {
    total,
    totalPts: total,
    annualized: annualize(total, months),
    from,
    to,
    months,
    contributions,
    assumptions: anyMissing || sources.has('user'),
    covered,
    methodology: {
      population: dataset.scope.population,
      area: dataset.scope.area,
      datasetVersion: dataset.version,
      dataAsOf: dataset.asOf,
      profileLabel: profile.label,
      profileVersion: profile.version,
      weightSource: profile.weightSource,
      basePeriod: profile.basePeriod ?? null,
      weightBasis: 'current-weights',
      baseWeights: leaves.reduce<Record<string, number>>((a, c) => ({ ...a, [c.id]: merged[c.id] }), {}),
      calculation:
        'Personal CPI = Σ (weight × price change) over mapped categories; weights normalized over the covered basket; custom mappings compound their annual rate over the period.',
    },
  }
}

/* ------------------------------ personal index series ------------------------------ */

export interface IndexPoint {
  period: Period
  /** Official all-items CPI as index relative to base (100). */
  official: number | null
  /** Personal CPI index, base = 100. */
  personal: number | null
}

/** Personal index from `from` to `to` (monthly, when available). Uses the
 *  profile's base-period basket and carried latest observations per series. */
export function personalIndexSeries(
  profile: PiiProfile,
  dataset: BlsDataset,
  from: Period,
  to: Period,
): IndexPoint[] {
  const leaves = profile.categories.filter((c) => c.mapping.kind !== 'excluded')
  const covered = leaves.reduce((a, c) => a + (profile.weights[c.id] ?? 0), 0)
  const out: IndexPoint[] = []
  if (covered <= 0) return out

  const steps = monthDiff(from, to)
  for (let i = 0; i <= steps; i++) {
    const p = addMonths(from, i)
    let total = 0
    for (const cat of leaves) {
      const w = (profile.weights[cat.id] ?? 0) / covered
      const cc = categoryChange(dataset, cat.mapping, from, p)
      total += w * cc.change
    }
    const personal = 100 * (1 + total)
    const o = indexAtOrBefore(dataset, ALL_ITEMS, p)
    const ob = indexAtOrBefore(dataset, ALL_ITEMS, from)
    out.push({
      period: p,
      personal: Number.isFinite(personal) ? personal : null,
      official: o && ob ? (o.index / ob.index) * 100 : null,
    })
  }
  return out
}

function addMonths(p: Period, n: number): Period {
  const total = toY(p) * 12 + (toM(p) - 1) + n
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

/* ------------------------------ budget inflation ------------------------------ */

export interface BudgetLine {
  categoryId: string
  label: string
  weight: number
  rate: number // effective rate over the period (fraction)
  source: SourceKind
  detail: string
}

export interface BudgetInflation {
  from: Period
  to: Period
  months: number
  total: number
  annualized: number
  lines: BudgetLine[]
}

/** How a profile's full cash requirement moves over `from`→`to`. Uses
 *  PassThrough per line — NOT the same as Personal CPI. */
export function budgetInflation(
  profile: PiiProfile,
  dataset: BlsDataset,
  from: Period,
  to: Period,
): BudgetInflation | null {
  if (from >= to) return null
  const months = monthDiff(from, to)
  const totalW = profile.categories.reduce((a, c) => a + (profile.weights[c.id] ?? 0), 0)
  if (totalW <= 0) return null

  const lines: BudgetLine[] = []
  let total = 0
  for (const cat of profile.categories) {
    const w = (profile.weights[cat.id] ?? 0) / totalW
    const pt = cat.passThrough
    if (pt.mode === 'fixed') {
      lines.push({ categoryId: cat.id, label: cat.label, weight: w, rate: 0, source: 'user', detail: 'Fixed — no price pass-through' })
      continue
    }
    if (pt.mode === 'custom') {
      const rate = Math.pow(1 + pt.rate / 100, months / 12) - 1
      lines.push({ categoryId: cat.id, label: cat.label, weight: w, rate, source: 'user', detail: `Pass-through ${pt.rate}%/yr` })
      total += w * rate
      continue
    }
    const cc = categoryChange(dataset, cat.mapping, from, to)
    lines.push({
      categoryId: cat.id,
      label: cat.label,
      weight: w,
      rate: cc.change,
      source: cc.source,
      detail: cc.sourceDetail,
    })
    total += w * cc.change
  }

  lines.sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate))
  return { from, to, months, total, annualized: annualize(total, months), lines }
}

/* ------------------------------ scenarios ------------------------------ */

/** Merge a scenario's sparse overrides into a working copy. Pure. */
export function applyScenario(profile: PiiProfile, scenario: PiiScenario | undefined): PiiProfile {
  if (!scenario) return profile
  return {
    ...profile,
    label: scenario.label,
    weights: { ...profile.weights, ...scenario.weightOverrides },
    future: { ...profile.future, ...scenario.assumptionOverrides },
    spending: { ...profile.spending, ...scenario.spendingOverrides },
  }
}

export function effectiveAssumptions(
  profile: PiiProfile,
  dataset: BlsDataset,
  asOf: Period,
): Map<string, number> {
  const m = new Map<string, number>()
  for (const cat of profile.categories) {
    m.set(cat.id, forwardAssumption(profile, dataset, cat, asOf))
  }
  return m
}

/* ------------------------------ forward + forecast ------------------------------ */

export interface ForwardPoint {
  year: number
  /** Personal CPI change vs base year (cumulative, fraction). */
  change: number
  cash: number
}

/** Expected personal CPI and spending dollars, one point per year from
 *  baseYear+1 out to baseYear+`years`. `baseSpend` is the total annual spend
 *  the forecast is anchored to. */
export function forwardForecast(
  profile: PiiProfile,
  dataset: BlsDataset,
  asOf: Period,
  baseSpend: number,
  years: number,
  assumptionOverrides?: Record<string, number>,
): ForwardPoint[] | null {
  const out: ForwardPoint[] = []
  const leaves = profile.categories.filter((c) => c.mapping.kind !== 'excluded')
  const covered = leaves.reduce((a, c) => a + (profile.weights[c.id] ?? 0), 0)
  if (covered <= 0 || !Number.isFinite(baseSpend)) return null

  const totalW = profile.categories.reduce((a, c) => a + (profile.weights[c.id] ?? 0), 0)
  const spendByCat = profile.spending
  const spendTotal = totalW > 0 ? Object.values(spendByCat).reduce((a, b) => a + b, 0) : 0
  const anchor = spendTotal > 0 ? spendTotal : baseSpend

  for (let y = 1; y <= years; y++) {
    let change = 0
    for (const cat of leaves) {
      const w = (profile.weights[cat.id] ?? 0) / covered
      const rate = assumptionOverrides?.[cat.id] ?? forwardAssumption(profile, dataset, cat, asOf)
      change += w * (Math.pow(1 + rate / 100, y) - 1)
    }
    const cash =
      spendTotal > 0
        ? Object.entries(spendByCat).reduce((a, [cid, v]) => {
            const cat = profile.categories.find((c) => c.id === cid)
            const rate = cat ? (assumptionOverrides?.[cid] ?? forwardAssumption(profile, dataset, cat, asOf)) : 0
            return a + v * Math.pow(1 + rate / 100, y)
          }, 0)
        : anchor * Math.pow(1 + annualize(change, 12), y)
    out.push({ year: toY(asOf) + y, change, cash })
  }
  return out
}

/* ------------------------------ weight generation ------------------------------ */

/** Weights from a spend map (annual $, per category id). Only non-zero, positive
 *  entries count; normalized over leaves. */
export function weightsFromSpend(
  categories: PersonalCategory[],
  spend: Record<string, number>,
): { weights: Record<string, number>; skipped: string[] } {
  const leaves = categories.filter((c) => c.mapping.kind !== 'excluded')
  const skipped = leaves.filter((c) => !(spend[c.id] > 0)).map((c) => c.id)
  const total = leaves.reduce((a, c) => a + (spend[c.id] ?? 0), 0)
  const weights: Record<string, number> = {}
  if (total > 0) {
    for (const c of leaves) weights[c.id] = Math.max(0, (spend[c.id] ?? 0) / total)
  } else {
    for (const c of leaves) weights[c.id] = 1 / Math.max(1, leaves.length)
  }
  return { weights, skipped }
}

/** Weight shape for a profile whose weights should sum to 1 over ALL leaves
 *  (used when the user explicitly balances weights by hand). */
export function renormalize(profile: PiiProfile): Record<string, number> {
  const leaves = profile.categories.filter((c) => c.mapping.kind !== 'excluded')
  const total = leaves.reduce((a, c) => a + (profile.weights[c.id] ?? 0), 0)
  if (total <= 0) return profile.weights
  const out: Record<string, number> = {}
  for (const c of leaves) out[c.id] = Math.max(0, (profile.weights[c.id] ?? 0) / total)
  return out
}