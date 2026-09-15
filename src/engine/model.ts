import {
  cohortById,
  cohortScale,
  THEMES,
  themeShare,
  type CatDef,
} from '../data/benchmarks'
import type { Budget, BudgetCategory, BudgetTheme, LockMode } from './types'

export const catKey = (themeId: string, catId: string) => `${themeId}.${catId}`

export interface Scaffold {
  /** Theme target shares, keyed by theme id. */
  share: Record<string, number>
  /** Category plan $, keyed `${theme}.${cat}`. */
  plan: Record<string, number>
  /** Category lock, keyed `${theme}.${cat}`. */
  catLock: Record<string, LockMode>
  /** Observed spend stays empty until the user checks a line. */
  observed: Record<string, number>
}

function benchMonthly(def: CatDef, incomeMonthly: number, takeHome: number, scale: number): number {
  if (def.bench.pctOf === 'gross') return incomeMonthly * def.bench.avg
  if (def.bench.pctOf === 'takehome') return takeHome * def.bench.avg
  return def.bench.avg * scale
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
export function scaffold(cap: number, incomeMonthly: number, cohortId: string): Scaffold {
  const cohort = cohortById(cohortId)
  const scale = cohortScale(cohort)
  const share: Record<string, number> = {}
  const plan: Record<string, number> = {}
  const catLock: Record<string, LockMode> = {}
  const observed: Record<string, number> = {}

  for (const t of THEMES) {
    const targetShare = themeShare(cohortId, t.id)
    share[t.id] = targetShare
    const allocation = cap * targetShare
    const rows = [] as { id: string; key: string; plan: number }[]

    for (const c of t.cats) {
      const key = catKey(t.id, c.id)
      catLock[key] = c.lock
      observed[key] = 0
      if (c.flex) {
        plan[key] = 0
        continue
      }
      const v = Math.max(0, benchMonthly(c, incomeMonthly, cap, scale))
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

  return { share, plan, catLock, observed }
}

export interface BudgetInput {
  incomeMonthly: number
  takeHome: number
  cohortId: string
  share: Record<string, number>
  plan: Record<string, number>
  observed: Record<string, number>
  catLock: Record<string, LockMode>
}

export function buildBudget(input: BudgetInput): Budget {
  const cohort = cohortById(input.cohortId)
  const scale = cohortScale(cohort)
  const income = Math.max(0, input.incomeMonthly)
  const takeHome = Math.max(0, input.takeHome)

  const themes: BudgetTheme[] = THEMES.map((t) => ({
    id: t.id,
    label: t.label,
    share: input.share[t.id] ?? themeShare(cohort.id, t.id),
    payFirst: !!t.payFirst,
    benchShare: themeShare(cohort.id, t.id),
    benchSource: t.bench.source,
    cats: t.cats.map((c): BudgetCategory => {
      const key = catKey(t.id, c.id)
      const plan = input.plan[key] ?? Math.round(Math.max(0, benchMonthly(c, income, takeHome, scale)))
      return {
        id: c.id,
        label: c.label,
        plan,
        observed: input.observed[key] ?? 0,
        lock: input.catLock[key] ?? c.lock,
        payFirst: !!c.payFirst,
        flex: !!c.flex,
        avg: c.bench.avg,
        median: c.bench.median,
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
    themes,
  }
}