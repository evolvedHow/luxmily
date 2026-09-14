import { cohortById, cohortScale } from '../data/benchmarks'
import type { Budget, BudgetCategory, BudgetTheme } from './types'
import { allocate, boundsFor } from './solver'
import type { ResolvedBudget, ResolvedCategory, ResolvedTheme } from './types'

function benchDollars(c: BudgetCategory, income: number, takeHome: number, scale: number): number {
  if (c.pctOf === 'gross') return income * c.avg
  if (c.pctOf === 'takehome') return takeHome * c.avg
  return c.avg * scale
}

function medianDollars(c: BudgetCategory, income: number, takeHome: number, scale: number): number | undefined {
  if (c.median === undefined) return undefined
  if (c.pctOf === 'gross') return income * c.median
  if (c.pctOf === 'takehome') return takeHome * c.median
  return c.median * scale
}

/** Distinct sources backing this theme's rows (theme-level + each category). */
function distinctSources(t: BudgetTheme): { label: string; url?: string }[] {
  const seen = new Map<string, { label: string; url?: string }>()
  const add = (label: string, url?: string) => {
    if (!label) return
    if (!seen.has(label)) seen.set(label, { label, url })
  }
  add(t.benchSource, undefined)
  for (const c of t.cats) add(c.source, c.url)
  return [...seen.values()]
}

/**
 * The single entry point the UI calls. Theme shares always sum to 1 — the solver
 * re-normalizes whichever theme the user drags so the percentages stay enforced
 * green. Dollars are the user's own: a category plan over a theme's allocation is
 * reported red, and observed spend is never recorded or auto-fixed — the app only
 * says what it means: % of cap, vs plan, and what's free to reallocate.
 */
export function resolve(budget: Budget): ResolvedBudget {
  const cap = Math.max(0, budget.takeHome)
  const cohort = cohortById(budget.cohortId)
  const scale = cohortScale(cohort)
  const income = Math.max(0, budget.incomeMonthly)

  const themeBounds = budget.themes.map((t) => boundsFor(t.id, 'elastic', Math.max(0, t.share)))
  const themeAlloc = allocate(1, themeBounds)

  const themes: ResolvedTheme[] = budget.themes.map((t) => {
    const share = themeAlloc.alloc[t.id] ?? 0
    const allocation = cap * share

    const cats: ResolvedCategory[] = t.cats.map((c) => {
      const plan = Math.max(0, c.plan)
      const observed = Math.max(0, c.observed)
      const median = medianDollars(c, income, cap, scale)
      const delta = observed > 0 ? observed - plan : 0
      return {
        id: c.id,
        themeId: t.id,
        label: c.label,
        lock: c.lock,
        plan,
        observed,
        observedPct: cap > 0 ? observed / cap : 0,
        delta,
        deltaPct: plan > 0 ? delta / plan : 0,
        benchAvg: Math.round(benchDollars(c, income, cap, scale)),
        benchMedian: median === undefined ? undefined : Math.round(median),
        benchMedianNote: c.medianNote,
        benchSource: c.source,
        benchUrl: c.url,
        payFirst: c.payFirst,
        flex: c.flex,
        surplus: observed > 0 ? Math.max(0, plan - observed) : 0,
      }
    })

    const planTotal = cats.reduce((s, c) => s + c.plan, 0)
    const observedTotal = cats.reduce((s, c) => s + c.observed, 0)
    return {
      id: t.id,
      label: t.label,
      payFirst: t.payFirst,
      targetShare: t.share,
      share,
      allocation,
      planTotal,
      observedTotal,
      planOver: Math.max(0, planTotal - allocation),
      observedOverPlan: cats.reduce((s, c) => s + Math.max(0, c.delta), 0),
      reallocatable: cats.reduce((s, c) => s + c.surplus, 0),
      benchShare: t.benchShare,
      benchSource: t.benchSource,
      sources: distinctSources(t),
      cats,
    }
  })

  const totalPlan = themes.reduce((s, t) => s + t.planTotal, 0)
  const totalObserved = themes.reduce((s, t) => s + t.observedTotal, 0)
  const totalPlanOver = themes.reduce((s, t) => s + t.planOver, 0)
  const observedOverPlan = themes.reduce((s, t) => s + t.observedOverPlan, 0)
  const reallocatable = themes.reduce((s, t) => s + t.reallocatable, 0)
  const payFirst = themes.flatMap((t) => t.cats.filter((c) => c.payFirst))

  return {
    incomeMonthly: income,
    takeHome: cap,
    cap,
    cohortId: budget.cohortId,
    cohortLabel: budget.cohortLabel,
    themes,
    payFirst,
    totalPlan,
    totalObserved,
    totalPlanOver,
    observedOverPlan,
    reallocatable,
    buffer: cap - totalPlan,
    ok: totalPlanOver === 0,
  }
}