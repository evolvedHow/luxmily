import {
  cohortById,
  cohortScale,
  THEMES,
  themeShare,
  type CatDef,
} from '../data/benchmarks'
import type { Budget, BudgetCategory, BudgetLocation, BudgetTheme } from './types'

export const catKey = (themeId: string, catId: string) => `${themeId}.${catId}`

/**
 * The pristine, benchmark-derived starting point. Because `scaffold` is a pure
 * function of (cap, income, cohort, location), this can be recomputed at any
 * time — which is what both the per-theme Reset button and the pII baseline
 * rely on. Nothing needs to be frozen at onboarding.
 */
export interface Scaffold {
  /** Category plan $, keyed `${theme}.${cat}`. */
  plan: Record<string, number>
}

/**
 * Area multiplier for a category's dollar benchmark. Percent-of-income rails
 * (401(k) %, emergency %) are income-share-based and unaffected by cost of
 * living; everything in dollars scales with the area's COL, and Rent/Mortgage —
 * the line that changes most across regions — carries the area rent factor too.
 */
function locFactor(def: CatDef, loc?: BudgetLocation): number {
  if (def.bench.pctOf) return 1
  const cola = loc?.cola ?? 1
  const rent = loc && def.id === 'shelter' && loc.rentFactor > 0 ? loc.rentFactor : 1
  return cola * rent
}

function benchMonthly(def: CatDef, incomeMonthly: number, takeHome: number, scale: number, loc?: BudgetLocation): number {
  if (def.bench.pctOf === 'gross') return incomeMonthly * def.bench.avg
  if (def.bench.pctOf === 'takehome') return takeHome * def.bench.avg
  return def.bench.avg * scale * locFactor(def, loc)
}

/** Bench-level (pre-cohort-scale) dollar benchmark, adjusted for area only. */
function benchDollar(def: CatDef, loc?: BudgetLocation): number {
  return def.bench.pctOf ? def.bench.avg : def.bench.avg * locFactor(def, loc)
}

function medianDollar(def: CatDef, loc?: BudgetLocation): number | undefined {
  if (def.bench.median === undefined) return undefined
  return def.bench.pctOf ? def.bench.median : def.bench.median * locFactor(def, loc)
}

function fitToTarget(plans: { id: string; plan: number }[], target: number): number[] {
  const sum = plans.reduce((s, p) => s + p.plan, 0)
  if (sum <= 0 || target <= 0) return plans.map((p) => p.plan)
  const f = target / sum
  const scaled = plans.map((p) => Math.round(p.plan * f))
  const fix = Math.round(target - scaled.reduce((s, v) => s + v, 0))
  if (scaled.length > 0 && fix !== 0) scaled[0] += fix
  return scaled
}

/**
 * Build the starting plan from an income answer: cohort → theme shares →
 * benchmark-scaled category plans that fit each theme's allocation. Pay-yourself-
 * first fields keep their benchmark rail values; slack becomes the Investments
 * (flex) line instead of being silently dropped.
 */
export function scaffold(cap: number, incomeMonthly: number, cohortId: string, loc?: BudgetLocation): Scaffold {
  const cohort = cohortById(cohortId)
  const scale = cohortScale(cohort)
  const plan: Record<string, number> = {}

  for (const t of THEMES) {
    const allocation = cap * themeShare(cohortId, t.id)
    const rows = [] as { id: string; key: string; plan: number }[]

    for (const c of t.cats) {
      const key = catKey(t.id, c.id)
      if (c.flex) {
        plan[key] = 0
        continue
      }
      const v = Math.max(0, benchMonthly(c, incomeMonthly, cap, scale, loc))
      rows.push({ id: c.id, key, plan: Math.round(v) })
    }

    if (t.payFirst) {
      const raw = rows.reduce((s, r) => s + r.plan, 0)
      const flexKey = catKey(t.id, 'investments')
      if (raw < allocation) {
        plan[flexKey] = Math.round(allocation - raw)
        for (const r of rows) plan[r.key] = r.plan
      } else {
        plan[flexKey] = 0
        const fitted = fitToTarget(rows, allocation)
        rows.forEach((r, i) => (plan[r.key] = fitted[i]))
      }
    } else {
      const raw = rows.reduce((s, r) => s + r.plan, 0)
      if (raw > allocation && raw > 0) {
        const fitted = fitToTarget(rows, allocation)
        rows.forEach((r, i) => (plan[r.key] = fitted[i]))
      } else {
        for (const r of rows) plan[r.key] = r.plan
      }
    }
  }

  return { plan }
}

export interface BudgetInput {
  incomeMonthly: number
  takeHome: number
  cohortId: string
  plan: Record<string, number>
  /** Locks keyed by theme id AND by `${theme}.${cat}`. Absent = unlocked. */
  locked: Record<string, boolean>
}

export function buildBudget(input: BudgetInput, loc?: BudgetLocation): Budget {
  const cohort = cohortById(input.cohortId)
  const scale = cohortScale(cohort)
  const income = Math.max(0, input.incomeMonthly)
  const takeHome = Math.max(0, input.takeHome)

  const themes: BudgetTheme[] = THEMES.map((t) => ({
    id: t.id,
    label: t.label,
    locked: !!input.locked[t.id],
    payFirst: !!t.payFirst,
    benchShare: themeShare(cohort.id, t.id),
    benchSource: t.bench.source,
    cats: t.cats.map((c): BudgetCategory => {
      const key = catKey(t.id, c.id)
      const plan = input.plan[key] ?? Math.round(Math.max(0, benchMonthly(c, income, takeHome, scale, loc)))
      const median = medianDollar(c, loc)
      return {
        id: c.id,
        label: c.label,
        plan,
        locked: !!input.locked[key],
        payFirst: !!c.payFirst,
        flex: !!c.flex,
        // Percent-of-income rails stay as fractions; dollar benchmarks are the
        // area-adjusted raw level (cohort scaling happens at display time).
        avg: c.bench.pctOf ? c.bench.avg : Math.round(benchDollar(c, loc)),
        median: median === undefined ? undefined : c.bench.pctOf ? median : Math.round(median),
        medianNote: c.bench.medianNote,
        source: c.bench.source,
        url: c.bench.url,
        pctOf: c.bench.pctOf,
      }
    }),
  }))

  return {
    incomeMonthly: input.incomeMonthly,
    takeHome: input.takeHome,
    cohortId: cohort.id,
    cohortLabel: cohort.label,
    ...(loc ? { location: loc } : {}),
    themes,
  }
}